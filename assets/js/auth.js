/* =============================================
   AUTH.JS — Shared Login / User Profile System
   Stutee's Collection Fine Art Gallery
   Persists across sessions via localStorage
   ============================================= */

(function() {
  'use strict';

  /* ─── STORAGE KEYS ─── */
  const USER_KEY   = 'sc_user';      // { name, phone, email, address }
  const CART_KEY   = 'sc_cart';      // cart array (now in localStorage)
  const ORDERS_KEY = 'sc_orders';    // array of past order objects
  const OTP_KEY    = 'sc_otp_temp';  // temporary OTP during verification

  /* ─── UTILITIES ─── */
  function getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY))  || null; } catch(e) { return null; } }
  function getCart()   { 
    // Prefer localStorage, fall back to sessionStorage for backward compat
    try { 
      const ls = localStorage.getItem(CART_KEY);
      if (ls) return JSON.parse(ls);
      const ss = sessionStorage.getItem(CART_KEY);
      return ss ? JSON.parse(ss) : [];
    } catch(e) { return []; }
  }
  function saveCart(c) { 
    const s = JSON.stringify(c);
    localStorage.setItem(CART_KEY, s); 
    sessionStorage.setItem(CART_KEY, s); // keep sessionStorage in sync
  }
  function getOrders() { try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch(e) { return []; } }
  function saveOrders(o) { localStorage.setItem(ORDERS_KEY, JSON.stringify(o)); }

  function generateOTP() { return String(Math.floor(1000 + Math.random() * 9000)); }

  function formatPhone(raw) {
    return raw.replace(/\D/g, '').slice(0, 10);
  }

  /* ─── ORDER STATUS LOGIC ─── */
  const ORDER_STAGES = ['Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Out for Delivery', 'Delivered'];

  function getOrderStatus(order) {
    const now = Date.now();
    const elapsed = now - order.timestamp; // ms since order placed
    const day = 86400000;
    if (elapsed < 0.5 * day) return { stage: 0, label: 'Confirmed',       icon: '✓' };
    if (elapsed < 1   * day) return { stage: 1, label: 'Processing',      icon: '⚙' };
    if (elapsed < 2   * day) return { stage: 2, label: 'Dispatched',      icon: '📦' };
    if (elapsed < 3   * day) return { stage: 3, label: 'In Transit',      icon: '🚚' };
    if (elapsed < 4   * day) return { stage: 4, label: 'Out for Delivery', icon: '🏠' };
    return                           { stage: 5, label: 'Delivered',       icon: '🎨' };
  }

  /* ─── INJECT STYLES (once) ─── */
  function injectStyles() {
    if (document.getElementById('auth-styles')) return;
    const style = document.createElement('style');
    style.id = 'auth-styles';
    style.textContent = `
      /* ── Login Icon in Header ── */
      .auth-icon-btn {
        position: relative;
        cursor: pointer;
        color: var(--color-text-main, #f5f6f8);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid rgba(212,175,55,0.18);
        background: rgba(212,175,55,0.04);
        transition: all 0.35s ease;
        flex-shrink: 0;
      }
      .auth-icon-btn:hover {
        border-color: var(--color-accent, #d4af37);
        color: var(--color-accent, #d4af37);
        box-shadow: 0 0 12px rgba(212,175,55,0.2);
      }
      .auth-icon-btn.logged-in {
        border-color: var(--color-accent, #d4af37);
        background: rgba(212,175,55,0.12);
        color: var(--color-accent, #d4af37);
      }
      .auth-icon-btn .auth-dot {
        position: absolute;
        top: 0; right: 0;
        width: 8px; height: 8px;
        background: #4caf7d;
        border-radius: 50%;
        border: 1.5px solid #07080a;
        display: none;
      }
      .auth-icon-btn.logged-in .auth-dot { display: block; }

      /* ── Auth Overlay ── */
      #auth-overlay {
        position: fixed;
        inset: 0;
        background: rgba(7,8,10,0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 9990;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.35s ease;
      }
      #auth-overlay.open {
        opacity: 1;
        pointer-events: all;
      }

      /* ── Auth Panel ── */
      .auth-panel {
        background: rgba(12,14,18,0.98);
        border: 1px solid rgba(212,175,55,0.18);
        border-radius: 12px;
        width: 92%;
        max-width: 480px;
        max-height: 88vh;
        overflow-y: auto;
        padding: 36px 36px 28px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.06);
        position: relative;
        transform: translateY(20px);
        transition: transform 0.35s cubic-bezier(0.25,0.8,0.25,1);
        scrollbar-width: thin;
        scrollbar-color: rgba(212,175,55,0.2) transparent;
      }
      #auth-overlay.open .auth-panel { transform: translateY(0); }

      .auth-panel::-webkit-scrollbar { width: 4px; }
      .auth-panel::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 4px; }

      .auth-panel-close {
        position: absolute;
        top: 16px; right: 16px;
        background: none;
        border: none;
        color: rgba(255,255,255,0.3);
        font-size: 20px;
        cursor: pointer;
        line-height: 1;
        padding: 4px 8px;
        border-radius: 4px;
        transition: color 0.3s ease;
      }
      .auth-panel-close:hover { color: var(--color-accent, #d4af37); }

      /* ── Panel Views ── */
      .auth-view { display: none; }
      .auth-view.active { display: block; }

      .auth-eyebrow {
        font-size: 10px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: var(--color-accent, #d4af37);
        margin-bottom: 8px;
        opacity: 0.7;
      }
      .auth-title {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 26px;
        font-weight: 400;
        color: #f0f2f5;
        margin-bottom: 6px;
        line-height: 1.25;
      }
      .auth-subtitle {
        font-size: 13px;
        color: #7a8296;
        margin-bottom: 28px;
        line-height: 1.6;
      }

      /* ── Form Fields ── */
      .auth-field { margin-bottom: 18px; }
      .auth-label {
        display: block;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: #7a8296;
        margin-bottom: 8px;
      }
      .auth-input-wrap {
        display: flex;
        align-items: center;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 6px;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
        overflow: hidden;
      }
      .auth-input-wrap:focus-within {
        border-color: rgba(212,175,55,0.45);
        box-shadow: 0 0 0 3px rgba(212,175,55,0.06);
      }
      .auth-prefix {
        padding: 0 14px;
        font-size: 13px;
        color: #7a8296;
        border-right: 1px solid rgba(255,255,255,0.06);
        white-space: nowrap;
        height: 46px;
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }
      .auth-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #f0f2f5;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 14px;
        padding: 13px 14px;
        width: 100%;
      }
      .auth-input::placeholder { color: rgba(255,255,255,0.2); }

      /* ── OTP Boxes ── */
      .auth-otp-row {
        display: flex;
        gap: 10px;
        justify-content: flex-start;
        margin-bottom: 16px;
      }
      .auth-otp-digit {
        width: 50px;
        height: 56px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        color: #f0f2f5;
        font-size: 22px;
        font-weight: 600;
        text-align: center;
        outline: none;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
        caret-color: var(--color-accent, #d4af37);
        font-family: 'Inter', system-ui, sans-serif;
      }
      .auth-otp-digit:focus {
        border-color: rgba(212,175,55,0.5);
        box-shadow: 0 0 0 3px rgba(212,175,55,0.08);
      }

      /* ── Buttons ── */
      .auth-btn {
        width: 100%;
        padding: 14px 20px;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.35s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 4px;
      }
      .auth-btn-primary {
        background: var(--color-accent, #d4af37);
        color: #07080a;
        border: 1px solid var(--color-accent, #d4af37);
      }
      .auth-btn-primary:hover {
        background: #f3e5ab;
        border-color: #f3e5ab;
        box-shadow: 0 6px 20px rgba(212,175,55,0.3);
      }
      .auth-btn-ghost {
        background: transparent;
        color: var(--color-accent, #d4af37);
        border: 1px solid rgba(212,175,55,0.3);
        margin-top: 10px;
      }
      .auth-btn-ghost:hover {
        background: rgba(212,175,55,0.06);
        border-color: var(--color-accent, #d4af37);
      }
      .auth-btn-danger {
        background: transparent;
        color: #e05252;
        border: 1px solid rgba(220,80,80,0.3);
        margin-top: 10px;
      }
      .auth-btn-danger:hover {
        background: rgba(220,80,80,0.06);
        border-color: #e05252;
      }
      .auth-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
      }

      /* ── Small helper text ── */
      .auth-hint {
        font-size: 11px;
        color: #4a5060;
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .auth-hint span { color: var(--color-accent, #d4af37); }
      .auth-error {
        font-size: 12px;
        color: #e05252;
        margin-top: -12px;
        margin-bottom: 14px;
        display: none;
      }
      .auth-error.visible { display: block; }
      .auth-success-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #4caf7d;
        background: rgba(76,175,125,0.08);
        border: 1px solid rgba(76,175,125,0.2);
        border-radius: 20px;
        padding: 4px 12px;
        margin-bottom: 18px;
      }
      .auth-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 22px 0;
        color: rgba(255,255,255,0.1);
        font-size: 11px;
      }
      .auth-divider::before, .auth-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(255,255,255,0.07);
      }

      /* ── Profile View ── */
      .profile-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(212,175,55,0.12);
        border: 1.5px solid rgba(212,175,55,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-accent, #d4af37);
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 22px;
        font-weight: 400;
        margin-bottom: 14px;
      }
      .profile-name {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 22px;
        font-weight: 400;
        color: #f0f2f5;
        margin-bottom: 4px;
      }
      .profile-phone {
        font-size: 12px;
        color: #7a8296;
        margin-bottom: 24px;
        letter-spacing: 0.5px;
      }
      .profile-tabs {
        display: flex;
        gap: 0;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 24px;
        background: rgba(255,255,255,0.02);
      }
      .profile-tab {
        flex: 1;
        padding: 10px 6px;
        font-size: 10px;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-weight: 500;
        color: #7a8296;
        background: none;
        border: none;
        cursor: pointer;
        transition: all 0.25s ease;
        text-align: center;
      }
      .profile-tab:not(:last-child) {
        border-right: 1px solid rgba(255,255,255,0.06);
      }
      .profile-tab.active {
        color: #07080a;
        background: var(--color-accent, #d4af37);
      }
      .profile-tab-content { display: none; }
      .profile-tab-content.active { display: block; }

      /* ── Cart items in profile ── */
      .profile-cart-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .profile-cart-item:last-child { border-bottom: none; }
      .profile-cart-thumb {
        width: 40px;
        height: 40px;
        border-radius: 4px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        overflow: hidden;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        color: #4a5060;
        font-family: 'Playfair Display', Georgia, serif;
      }
      .profile-cart-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .profile-cart-info { flex: 1; }
      .profile-cart-name {
        font-size: 12px;
        font-weight: 500;
        color: #f0f2f5;
        margin-bottom: 2px;
      }
      .profile-cart-qty {
        font-size: 10px;
        color: #7a8296;
      }
      .profile-cart-price {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-accent, #d4af37);
        font-family: 'Playfair Display', Georgia, serif;
        flex-shrink: 0;
      }
      .profile-cart-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0 0;
        margin-top: 4px;
        border-top: 1px solid rgba(212,175,55,0.12);
        font-size: 13px;
        color: #f0f2f5;
        font-weight: 500;
      }
      .profile-cart-total-val {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 18px;
        color: var(--color-accent, #d4af37);
      }
      .profile-goto-checkout {
        display: block;
        margin-top: 14px;
        padding: 11px 20px;
        background: var(--color-accent, #d4af37);
        color: #07080a;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        border-radius: 5px;
        text-align: center;
        text-decoration: none;
        transition: background 0.3s ease;
      }
      .profile-goto-checkout:hover { background: #f3e5ab; }

      /* ── Order cards ── */
      .order-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 14px;
      }
      .order-card:last-child { margin-bottom: 0; }
      .order-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      .order-ref {
        font-size: 11px;
        letter-spacing: 1px;
        color: var(--color-accent, #d4af37);
        font-family: 'Courier New', monospace;
      }
      .order-date {
        font-size: 11px;
        color: #4a5060;
      }
      .order-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        letter-spacing: 0.5px;
        padding: 4px 10px;
        border-radius: 20px;
        margin-bottom: 10px;
      }
      .order-status-badge.delivered {
        background: rgba(76,175,125,0.1);
        color: #4caf7d;
        border: 1px solid rgba(76,175,125,0.2);
      }
      .order-status-badge.transit {
        background: rgba(212,175,55,0.1);
        color: var(--color-accent, #d4af37);
        border: 1px solid rgba(212,175,55,0.2);
      }
      .order-items-list {
        font-size: 12px;
        color: #7a8296;
        line-height: 1.7;
      }
      .order-total-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255,255,255,0.05);
        font-size: 12px;
        color: #7a8296;
      }
      .order-total-line strong {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 15px;
        color: var(--color-accent, #d4af37);
        font-weight: 400;
      }

      /* ── Tracking progress bar ── */
      .track-stages {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        position: relative;
        margin: 14px 0 6px;
      }
      .track-stages::before {
        content: '';
        position: absolute;
        top: 13px;
        left: 13px;
        right: 13px;
        height: 2px;
        background: rgba(255,255,255,0.07);
        z-index: 0;
      }
      .track-fill {
        position: absolute;
        top: 13px;
        left: 13px;
        height: 2px;
        background: var(--color-accent, #d4af37);
        box-shadow: 0 0 6px rgba(212,175,55,0.4);
        z-index: 1;
        transition: width 0.5s ease;
      }
      .track-stage {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        position: relative;
        z-index: 2;
        flex: 0 0 auto;
      }
      .track-dot {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.1);
        background: #07080a;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: #4a5060;
        transition: all 0.4s ease;
      }
      .track-dot.done {
        border-color: var(--color-accent, #d4af37);
        background: rgba(212,175,55,0.15);
        color: var(--color-accent, #d4af37);
      }
      .track-dot.current {
        border-color: var(--color-accent, #d4af37);
        background: var(--color-accent, #d4af37);
        color: #07080a;
        box-shadow: 0 0 10px rgba(212,175,55,0.4);
      }
      .track-label {
        font-size: 8px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #4a5060;
        text-align: center;
        max-width: 48px;
        line-height: 1.3;
        white-space: normal;
      }
      .track-label.active { color: var(--color-accent, #d4af37); }

      /* ── Profile Edit fields ── */
      .profile-edit-row {
        display: flex;
        gap: 10px;
        margin-bottom: 14px;
      }
      .profile-edit-row .auth-field { margin-bottom: 0; flex: 1; }
      .profile-save-notice {
        font-size: 11px;
        color: #4caf7d;
        margin-top: 8px;
        display: none;
      }
      .profile-save-notice.visible { display: block; }

      /* ── Empty states ── */
      .auth-empty {
        text-align: center;
        padding: 28px 12px;
        color: #4a5060;
        font-size: 13px;
      }
      .auth-empty svg { margin-bottom: 10px; color: rgba(212,175,55,0.25); }

      /* ── Auth toast ── */
      #auth-toast {
        position: fixed;
        bottom: -70px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-accent, #d4af37);
        color: #07080a;
        padding: 12px 26px;
        border-radius: 30px;
        font-size: 12px;
        font-weight: 500;
        z-index: 99999;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        transition: bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
        max-width: 90vw;
        text-align: center;
        white-space: nowrap;
      }
      #auth-toast.show { bottom: 40px; }
      #auth-toast.auth-toast-err {
        background: #e05252;
        color: #fff;
      }

      /* ── Logged-in notification banner ── */
      #auth-welcome-banner {
        position: fixed;
        top: -80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(12,14,18,0.97);
        border: 1px solid rgba(212,175,55,0.3);
        color: #f0f2f5;
        padding: 12px 28px 12px 18px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 99998;
        box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 20px rgba(212,175,55,0.08);
        transition: top 0.5s cubic-bezier(0.25,0.8,0.25,1);
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: none;
        white-space: nowrap;
      }
      #auth-welcome-banner.show { top: 90px; }
      #auth-welcome-banner .wb-dot {
        width: 8px; height: 8px;
        background: #4caf7d;
        border-radius: 50%;
        flex-shrink: 0;
        box-shadow: 0 0 6px #4caf7d;
      }
      #auth-welcome-banner .wb-name {
        color: var(--color-accent, #d4af37);
        font-family: 'Playfair Display', Georgia, serif;
        font-weight: 400;
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── SHOW AUTH TOAST ─── */
  let _toastEl = null, _toastTimer = null;
  function authToast(msg, isErr = false) {
    if (!_toastEl) {
      _toastEl = document.createElement('div');
      _toastEl.id = 'auth-toast';
      document.body.appendChild(_toastEl);
    }
    _toastEl.textContent = msg;
    _toastEl.className = 'show' + (isErr ? ' auth-toast-err' : '');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { _toastEl.className = ''; }, 3200);
  }

  /* ─── WELCOME BANNER ─── */
  function showWelcomeBanner(name) {
    let b = document.getElementById('auth-welcome-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'auth-welcome-banner';
      document.body.appendChild(b);
    }
    b.innerHTML = `<div class="wb-dot"></div> Welcome back, <span class="wb-name">${name}</span> — you're now signed in.`;
    setTimeout(() => b.classList.add('show'), 50);
    setTimeout(() => b.classList.remove('show'), 4000);
  }

  /* ─── BUILD THE OVERLAY ─── */
  function buildOverlay() {
    if (document.getElementById('auth-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="auth-panel" id="auth-panel">
        <button class="auth-panel-close" id="auth-close" aria-label="Close">✕</button>

        <!-- ── VIEW: LOGIN ── -->
        <div class="auth-view active" id="av-login">
          <div class="auth-eyebrow">Gallery Access</div>
          <h2 class="auth-title">Sign In</h2>
          <p class="auth-subtitle">Enter your mobile number to receive a verification code and sign into your collector account.</p>

          <div class="auth-field">
            <label class="auth-label" for="auth-login-phone">Mobile Number</label>
            <div class="auth-input-wrap">
              <div class="auth-prefix">🇮🇳 +91</div>
              <input type="tel" id="auth-login-phone" class="auth-input" placeholder="98765 43210" maxlength="10" inputmode="numeric">
            </div>
          </div>
          <div class="auth-error" id="auth-login-err">Please enter a valid 10-digit mobile number.</div>

          <button class="auth-btn auth-btn-primary" id="auth-send-otp">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.38 2 2 0 0 1 3.58 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.07-1.07a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            Send Verification Code
          </button>
        </div>

        <!-- ── VIEW: OTP ── -->
        <div class="auth-view" id="av-otp">
          <div class="auth-eyebrow">Verification</div>
          <h2 class="auth-title">Enter Code</h2>
          <p class="auth-subtitle" id="av-otp-hint">A 4-digit code has been sent to your number.</p>

          <div class="auth-otp-row" id="auth-otp-boxes">
            <input type="text" class="auth-otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]*" aria-label="OTP digit 1">
            <input type="text" class="auth-otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]*" aria-label="OTP digit 2">
            <input type="text" class="auth-otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]*" aria-label="OTP digit 3">
            <input type="text" class="auth-otp-digit" maxlength="1" inputmode="numeric" pattern="[0-9]*" aria-label="OTP digit 4">
          </div>
          <div class="auth-error" id="auth-otp-err">Incorrect code. Please try again.</div>

          <div class="auth-hint">Check your messages. For demo purposes, your OTP is: <span id="auth-otp-demo">----</span></div>

          <button class="auth-btn auth-btn-primary" id="auth-verify-otp">Verify & Sign In</button>
          <button class="auth-btn auth-btn-ghost" id="auth-resend-otp">Resend Code</button>
        </div>

        <!-- ── VIEW: PROFILE ── -->
        <div class="auth-view" id="av-profile">
          <div class="profile-avatar" id="profile-avatar-initial">S</div>
          <div class="profile-name" id="profile-display-name">Collector</div>
          <div class="profile-phone" id="profile-display-phone">+91 ——</div>

          <div class="profile-tabs">
            <button class="profile-tab active" data-tab="pt-cart">Cart</button>
            <button class="profile-tab" data-tab="pt-orders">Orders</button>
            <button class="profile-tab" data-tab="pt-track">Track</button>
            <button class="profile-tab" data-tab="pt-edit">Profile</button>
          </div>

          <!-- Cart Tab -->
          <div class="profile-tab-content active" id="pt-cart"></div>

          <!-- Orders Tab -->
          <div class="profile-tab-content" id="pt-orders"></div>

          <!-- Track Tab -->
          <div class="profile-tab-content" id="pt-track"></div>

          <!-- Edit Profile Tab -->
          <div class="profile-tab-content" id="pt-edit">
            <div class="auth-field">
              <label class="auth-label" for="pe-name">Full Name</label>
              <div class="auth-input-wrap">
                <input type="text" id="pe-name" class="auth-input" placeholder="Your full name" autocomplete="name">
              </div>
            </div>
            <div class="auth-field">
              <label class="auth-label" for="pe-email">Email Address</label>
              <div class="auth-input-wrap">
                <input type="email" id="pe-email" class="auth-input" placeholder="your@email.com" autocomplete="email">
              </div>
            </div>
            <div class="auth-field">
              <label class="auth-label" for="pe-address">Delivery Address</label>
              <div class="auth-input-wrap">
                <input type="text" id="pe-address" class="auth-input" placeholder="Street, City, Pin code" autocomplete="street-address">
              </div>
            </div>
            <div class="auth-field">
              <label class="auth-label">Mobile Number</label>
              <div class="auth-input-wrap" style="opacity:0.5;pointer-events:none;">
                <div class="auth-prefix">+91</div>
                <input type="tel" id="pe-phone" class="auth-input" readonly>
              </div>
            </div>
            <button class="auth-btn auth-btn-primary" id="pe-save">Save Changes</button>
            <div class="profile-save-notice" id="pe-saved">✓ Profile updated successfully.</div>
            <button class="auth-btn auth-btn-danger" id="auth-logout">Sign Out</button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    /* ── Wire up events ── */

    // Close
    document.getElementById('auth-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });

    // Send OTP
    document.getElementById('auth-send-otp').addEventListener('click', handleSendOTP);
    document.getElementById('auth-login-phone').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSendOTP();
    });

    // Resend OTP
    document.getElementById('auth-resend-otp').addEventListener('click', handleSendOTP);

    // Verify OTP
    document.getElementById('auth-verify-otp').addEventListener('click', handleVerifyOTP);

    // OTP digit auto-advance
    document.querySelectorAll('.auth-otp-digit').forEach((inp, idx, all) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^0-9]/g, '');
        if (inp.value && idx < all.length - 1) all[idx + 1].focus();
        if (inp.value && idx === all.length - 1) handleVerifyOTP();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) all[idx - 1].focus();
      });
      inp.addEventListener('paste', e => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        [...text].slice(0, 4).forEach((ch, i) => { if (all[i]) all[i].value = ch; });
        const lastFilled = Math.min(text.length, 4) - 1;
        if (all[lastFilled]) all[lastFilled].focus();
      });
    });

    // Profile tabs
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.profile-tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        const tc = document.getElementById(tab.dataset.tab);
        if (tc) { tc.classList.add('active'); }
        if (tab.dataset.tab === 'pt-cart')   renderProfileCart();
        if (tab.dataset.tab === 'pt-orders') renderProfileOrders();
        if (tab.dataset.tab === 'pt-track')  renderProfileTrack();
        if (tab.dataset.tab === 'pt-edit')   populateEditForm();
      });
    });

    // Save profile
    document.getElementById('pe-save').addEventListener('click', () => {
      const user = getUser() || {};
      user.name    = document.getElementById('pe-name').value.trim()    || user.name;
      user.email   = document.getElementById('pe-email').value.trim()   || user.email;
      user.address = document.getElementById('pe-address').value.trim() || user.address;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      refreshProfileHeader();
      const notice = document.getElementById('pe-saved');
      if (notice) { notice.classList.add('visible'); setTimeout(() => notice.classList.remove('visible'), 2500); }
      authToast('Profile updated.');
    });

    // Logout
    document.getElementById('auth-logout').addEventListener('click', () => {
      localStorage.removeItem(USER_KEY);
      closeOverlay();
      refreshHeaderIcon();
      authToast('You have been signed out.');
    });
  }

  /* ─── VIEW SWITCHER ─── */
  function showView(id) {
    document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  /* ─── OPEN / CLOSE ─── */
  function openOverlay() {
    buildOverlay();
    const overlay = document.getElementById('auth-overlay');
    const user = getUser();
    if (user) {
      showView('av-profile');
      refreshProfileHeader();
      renderProfileCart();
    } else {
      showView('av-login');
      // reset fields
      const ph = document.getElementById('auth-login-phone');
      if (ph) ph.value = '';
      document.querySelectorAll('.auth-otp-digit').forEach(d => d.value = '');
      document.getElementById('auth-login-err').classList.remove('visible');
    }
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ─── OTP FLOW ─── */
  function handleSendOTP() {
    const ph = document.getElementById('auth-login-phone');
    if (!ph) return;
    const phone = formatPhone(ph.value);
    if (phone.length !== 10) {
      document.getElementById('auth-login-err').classList.add('visible');
      return;
    }
    document.getElementById('auth-login-err').classList.remove('visible');

    const otp = generateOTP();
    localStorage.setItem(OTP_KEY, JSON.stringify({ otp, phone, ts: Date.now() }));

    // Show OTP view
    showView('av-otp');
    document.getElementById('av-otp-hint').textContent = `A 4-digit code has been sent to +91 ${phone.slice(0,5)} ${phone.slice(5)}.`;
    const demoEl = document.getElementById('auth-otp-demo');
    if (demoEl) demoEl.textContent = otp;

    // Reset boxes
    document.querySelectorAll('.auth-otp-digit').forEach(d => d.value = '');
    const firstBox = document.querySelector('.auth-otp-digit');
    if (firstBox) setTimeout(() => firstBox.focus(), 100);

    authToast(`Verification code sent to +91 ${phone.slice(0,5)} XXXXX`);
  }

  function handleVerifyOTP() {
    const digits = [...document.querySelectorAll('.auth-otp-digit')].map(i => i.value).join('');
    if (digits.length < 4) {
      document.getElementById('auth-otp-err').classList.add('visible');
      return;
    }
    let stored;
    try { stored = JSON.parse(localStorage.getItem(OTP_KEY)); } catch(e) {}
    if (!stored || digits !== stored.otp) {
      document.getElementById('auth-otp-err').classList.add('visible');
      return;
    }

    document.getElementById('auth-otp-err').classList.remove('visible');
    localStorage.removeItem(OTP_KEY);

    // Create / update user
    const existing = getUser() || {};
    const user = {
      name:    existing.name    || '',
      phone:   stored.phone,
      email:   existing.email   || '',
      address: existing.address || ''
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    refreshHeaderIcon();
    showView('av-profile');
    refreshProfileHeader();
    renderProfileCart();

    // Reset tabs to Cart
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelector('.profile-tab[data-tab="pt-cart"]')?.classList.add('active');
    document.getElementById('pt-cart')?.classList.add('active');

    showWelcomeBanner(user.name || `+91 ${stored.phone.slice(0,5)}XXXXX`);
    authToast('Signed in successfully!');
  }

  /* ─── REFRESH PROFILE HEADER IN PANEL ─── */
  function refreshProfileHeader() {
    const user = getUser();
    if (!user) return;
    const nameEl  = document.getElementById('profile-display-name');
    const phoneEl = document.getElementById('profile-display-phone');
    const avatEl  = document.getElementById('profile-avatar-initial');
    if (nameEl)  nameEl.textContent  = user.name  || 'Valued Collector';
    if (phoneEl) phoneEl.textContent = user.phone ? `+91 ${user.phone.slice(0,5)} ${user.phone.slice(5)}` : '';
    if (avatEl)  avatEl.textContent  = (user.name || 'C')[0].toUpperCase();
  }

  function populateEditForm() {
    const user = getUser() || {};
    const safe = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    safe('pe-name',    user.name);
    safe('pe-email',   user.email);
    safe('pe-address', user.address);
    safe('pe-phone',   user.phone);
  }

  /* ─── CATALOG for price lookup ─── */
  const CATALOG = {
    "Lotus Eyes of Grace":                  { price: 1450, img: "img9.jpeg"     },
    "The Cosmic Herdsman":                  { price: 899,  img: "img7.jpeg"     },
    "Artistic Representation of the Lord":  { price: 1280, img: "img11.jpeg"    },
    "Little Makhan Chor":                   { price: 820,  img: "img8.jpeg"     },
    "The Midnight Flutist":                 { price: 3850, img: "imgfinal.jpeg" },
    
  };

  /* ─── RENDER CART TAB ─── */
  function renderProfileCart() {
    const el = document.getElementById('pt-cart');
    if (!el) return;
    const cart = getCart();
    if (!cart || cart.length === 0) {
      el.innerHTML = `<div class="auth-empty"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg><p>Your cart is empty.<br><a href="index.html" style="color:var(--color-accent,#d4af37);text-decoration:none;">Browse the collection →</a></p></div>`;
      return;
    }
    let total = 0;
    const items = cart.map(item => {
      const name = item.title || item.name || 'Artwork';
      const entry = CATALOG[name] || {};
      const price = entry.price || (item.price ? parseFloat(String(item.price).replace(/,/g,'')) : 0);
      const qty = item.qty || 1;
      total += price * qty;
      const img = entry.img ? `<img src="${entry.img}" alt="${name}">` : '<span style="font-size:8px;text-align:center;padding:2px;">ART</span>';
      return `<div class="profile-cart-item">
        <div class="profile-cart-thumb">${img}</div>
        <div class="profile-cart-info">
          <div class="profile-cart-name">${name}</div>
          <div class="profile-cart-qty">Qty: ${qty}</div>
        </div>
        <div class="profile-cart-price">₹${(price * qty).toLocaleString('en-IN')}</div>
      </div>`;
    }).join('');

    el.innerHTML = `${items}
      <div class="profile-cart-total">
        <span>Total</span>
        <span class="profile-cart-total-val">₹${total.toLocaleString('en-IN')}</span>
      </div>
      <a class="profile-goto-checkout" href="checkout.html">Proceed to Checkout →</a>`;
  }

  /* ─── RENDER ORDERS TAB ─── */
  function renderProfileOrders() {
    const el = document.getElementById('pt-orders');
    if (!el) return;
    const orders = getOrders();
    if (!orders.length) {
      el.innerHTML = `<div class="auth-empty"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg><p>No orders yet.<br>Your acquisitions will appear here.</p></div>`;
      return;
    }
    el.innerHTML = orders.slice().reverse().map(order => {
      const status = getOrderStatus(order);
      const isDelivered = status.stage === 5;
      const dateStr = new Date(order.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const itemList = (order.items || []).map(i => `${i.title || i.name} (×${i.qty||1})`).join(', ');
      return `<div class="order-card">
        <div class="order-card-top">
          <span class="order-ref">${order.ref}</span>
          <span class="order-date">${dateStr}</span>
        </div>
        <div class="order-status-badge ${isDelivered ? 'delivered' : 'transit'}">
          ${status.icon} ${status.label}
        </div>
        <div class="order-items-list">${itemList || '—'}</div>
        <div class="order-total-line">
          <span>Order Total</span>
          <strong>₹${(order.total || 0).toLocaleString('en-IN')}</strong>
        </div>
      </div>`;
    }).join('');
  }

  /* ─── RENDER TRACKING TAB ─── */
  const STAGE_LABELS = ['Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivery', 'Delivered'];
  const STAGE_ICONS  = ['✓', '⚙', '📦', '🚚', '🏠', '🎨'];

  function renderProfileTrack() {
    const el = document.getElementById('pt-track');
    if (!el) return;
    const orders = getOrders();
    const active = orders.filter(o => getOrderStatus(o).stage < 5);

    if (!orders.length) {
      el.innerHTML = `<div class="auth-empty"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><p>No active orders to track.<br>Place an order to see live updates here.</p></div>`;
      return;
    }

    el.innerHTML = (active.length ? active : orders.slice(-1)).map(order => {
      const status = getOrderStatus(order);
      const pct = (status.stage / (STAGE_LABELS.length - 1)) * 100;

      const dots = STAGE_LABELS.map((lbl, i) => {
        const cls = i < status.stage ? 'done' : i === status.stage ? 'current' : '';
        return `<div class="track-stage">
          <div class="track-dot ${cls}">${i <= status.stage ? STAGE_ICONS[i] : ''}</div>
          <div class="track-label ${i === status.stage ? 'active' : ''}">${lbl}</div>
        </div>`;
      }).join('');

      return `<div class="order-card">
        <div class="order-card-top">
          <span class="order-ref">${order.ref}</span>
          <span class="order-date">Est. 3–5 days</span>
        </div>
        <div class="track-stages">
          <div class="track-fill" style="width:calc(${pct}% - 26px)"></div>
          ${dots}
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--color-accent,#d4af37);text-align:center;letter-spacing:0.5px;">
          ${status.icon} ${status.label}
        </div>
      </div>`;
    }).join('');
  }

  /* ─── INJECT LOGIN ICON INTO HEADER ─── */
  function injectHeaderIcon() {
    // Works for both index.html (gallery-header) and checkout.html styles
    const headerRight = document.querySelector('.header-right') || document.querySelector('.header-order-count');
    if (!headerRight || document.querySelector('.auth-icon-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'auth-icon-btn';
    btn.id = 'auth-header-btn';
    btn.setAttribute('aria-label', 'Account / Sign In');
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.innerHTML = `
      <div class="auth-dot"></div>
      <svg id="auth-icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>`;

    // For checkout.html (header-order-count is the right section)
    if (document.querySelector('.checkout-header')) {
      const countEl = document.querySelector('.header-order-count');
      if (countEl) {
        countEl.style.display = 'flex';
        countEl.style.flexDirection = 'row';
        countEl.style.alignItems = 'center';
        countEl.style.gap = '18px';
        // Insert the auth button before the count text
        const countFlex = document.createElement('div');
        countFlex.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;';
        const itemCount = document.getElementById('header-item-count');
        const total     = document.querySelector('.header-order-total');
        if (itemCount) countFlex.appendChild(itemCount.cloneNode(true));
        if (total)     countFlex.appendChild(total.cloneNode(true));
        // Just append btn to right of header directly
        countEl.insertBefore(btn, countEl.firstChild);
      }
    } else {
      // gallery header — insert before cart icon
      const cartIcon = headerRight.querySelector('.cart-icon');
      if (cartIcon) headerRight.insertBefore(btn, cartIcon);
      else headerRight.appendChild(btn);
    }

    btn.addEventListener('click', openOverlay);
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openOverlay(); });
    refreshHeaderIcon();
  }

  function refreshHeaderIcon() {
    const btn = document.getElementById('auth-header-btn');
    if (!btn) return;
    const user = getUser();
    if (user) {
      btn.classList.add('logged-in');
      btn.title = `Signed in as ${user.name || '+91 ' + user.phone}`;
    } else {
      btn.classList.remove('logged-in');
      btn.title = 'Sign In';
    }
  }

  /* ─── PUBLIC: save an order after checkout success ─── */
  function saveOrder(ref, items, total) {
    const orders = getOrders();
    orders.push({ ref, items, total, timestamp: Date.now() });
    saveOrders(orders);
    // Clear cart after order
    localStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(CART_KEY);
  }

  /* ─── INIT ─── */
  function init() {
    injectStyles();
    // Slight delay to let page header render first
    setTimeout(injectHeaderIcon, 80);

    // Sync: if user is logged in and cart exists in either storage, merge
    const user = getUser();
    if (user) {
      const lsCart = (() => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch(e) { return []; }})();
      const ssCart = (() => { try { return JSON.parse(sessionStorage.getItem(CART_KEY)) || []; } catch(e) { return []; }})();
      if (!lsCart.length && ssCart.length) {
        saveCart(ssCart); // Promote sessionStorage cart to localStorage
      } else if (lsCart.length && !ssCart.length) {
        sessionStorage.setItem(CART_KEY, JSON.stringify(lsCart)); // Sync other direction
      }
    }

    // If sessionStorage has cart (from browsing this session) and user is logged in, save to localStorage
    if (user) {
      const ssCart = (() => { try { return JSON.parse(sessionStorage.getItem(CART_KEY)); } catch(e) { return null; }})();
      if (ssCart && ssCart.length) saveCart(ssCart);
    }
  }

  /* ─── EXPORTS ─── */
  window.GalleryAuth = {
    getUser,
    getCart,
    saveCart,
    getOrders,
    saveOrder,
    openPanel: openOverlay,
    closePanel: closeOverlay,
    authToast
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
