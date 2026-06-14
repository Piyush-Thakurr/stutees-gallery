/* =============================================
   CHECKOUT.JS — Multi-step checkout logic
   Stutee's Collection Fine Art Gallery
   ============================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* ─────────────────────────────────────
     CART DATA & ORDER SUMMARY
     ───────────────────────────────────── */

  // Default catalog items with prices (matching your updated main gallery)
  const CATALOG = {
    "Lotus Eyes of Grace":                  { price: 1450, tag: "Stretched Canvas",  img: "img9.jpeg"     },
    "The Cosmic Herdsman":                  { price: 899,  tag: "Fine Art Print",    img: "img7.jpeg"     },
    "Artistic Representation of the Lord":  { price: 1280, tag: "Fine Art Print",    img: "img11.jpeg"    },
    "Little Makhan Chor":                   { price: 820,  tag: "Fine Art Print",    img: "img8.jpeg"     },
    "The Midnight Flutist":                 { price: 3500, tag: "Original Painting", img: "imgfinal.jpeg" }
  };

  // Load cart from sessionStorage (set by main gallery script.js)
  let cart = [];
  try {
    const raw = sessionStorage.getItem("sc_cart");
    if (raw) cart = JSON.parse(raw);
  } catch(e) {}

  // Safe fallback normalization: handles both .title and .name structures
  if (cart && cart.length > 0) {
    cart = cart.map(item => ({
      title: item.title || item.name || "Unknown Artwork",
      qty:   item.qty   || 1
    }));
  } else {
    // Fallback so the page is never empty during development
    cart = [
      { title: "Lotus Eyes of Grace", qty: 1 },
      { title: "The Cosmic Herdsman", qty: 1 }
    ];
  }

  const TAX_RATE           = 0.18;   // 18% GST
  const SHIPPING_THRESHOLD = 5000;   // Free shipping above ₹5,000

  function calculateTotals() {
    let subtotal = 0;
    cart.forEach(item => {
      const entry = CATALOG[item.title];
      if (entry) subtotal += entry.price * item.qty;
    });
    const shipping = (subtotal >= SHIPPING_THRESHOLD || subtotal === 0) ? 0 : 150;
    const tax      = subtotal * TAX_RATE;
    const total    = subtotal + shipping + tax;
    return { subtotal, shipping, tax, total };
  }

  function updateHeaderTotals(subtotal, shipping, tax, total) {
    const headerTotal     = document.getElementById("header-total");
    const headerItemCount = document.getElementById("header-item-count");
    if (headerTotal)     headerTotal.textContent     = `₹${total.toFixed(2)}`;
    if (headerItemCount) headerItemCount.textContent = `${cart.reduce((s, i) => s + i.qty, 0)} Item(s)`;
  }

  function renderSummary() {
    const summaryItems = document.getElementById("summary-items");
    if (!summaryItems) return;

    // Clear previous dynamic items but keep the empty-state element
    const emptyEl = document.getElementById("summary-empty");
    summaryItems.innerHTML = "";
    if (emptyEl) summaryItems.appendChild(emptyEl);

    const { subtotal, shipping, tax, total } = calculateTotals();
    let hasItems = false;

    cart.forEach(item => {
      const entry = CATALOG[item.title];
      if (!entry) return;   // skip unknown items
      hasItems = true;

      const price = entry.price * item.qty;
      const el    = document.createElement("div");
      el.className = "summary-item";
      el.innerHTML = `
        <div class="item-thumb">
          <img src="${entry.img}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">
        </div>
        <div class="item-info">
          <div class="item-name">${item.title}</div>
          <div class="item-variant">Qty: ${item.qty}</div>
        </div>
        <div class="item-price">₹${price.toFixed(2)}</div>
      `;
      summaryItems.appendChild(el);
    });

    // Show / hide empty state
    if (emptyEl) emptyEl.style.display = hasItems ? "none" : "flex";

    // Sidebar breakdown values
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("summary-subtotal", `₹${subtotal.toFixed(2)}`);
    set("summary-shipping", shipping === 0 ? "Free" : `₹${shipping.toFixed(2)}`);
    set("summary-tax",      subtotal > 0 ? `₹${tax.toFixed(2)}` : "—");
    set("summary-total",    `₹${total.toFixed(2)}`);
    set("grand-total-val",  `₹${total.toFixed(2)}`);

    // Free-shipping notice banner
    const noticeEl = document.getElementById("amount-notice");
    if (noticeEl) {
      if (subtotal > 0 && subtotal < SHIPPING_THRESHOLD) {
        const remaining = SHIPPING_THRESHOLD - subtotal;
        noticeEl.textContent = `Add ₹${remaining.toFixed(2)} more to unlock Free Secure Shipping.`;
        noticeEl.style.display = "block";
      } else {
        noticeEl.style.display = "none";
      }
    }

    updateHeaderTotals(subtotal, shipping, tax, total);
  }

  renderSummary();   // Initial render

  /* ─────────────────────────────────────
     AUTO-FILL CONTACT FROM SAVED PROFILE
     ───────────────────────────────────── */
  (function autofillContact() {
    // Give auth.js a moment to initialise
    setTimeout(() => {
      const user = window.GalleryAuth && window.GalleryAuth.getUser ? window.GalleryAuth.getUser() : null;
      if (!user) return;
      const safe = (id, val) => { const el = document.getElementById(id); if (el && !el.value && val) el.value = val; };
      safe('full-name',     user.name);
      safe('email-address', user.email);
      if (user.phone) {
        const ph = document.getElementById('phone-number');
        if (ph && !ph.value) ph.value = user.phone;
      }
      // Also pre-fill delivery address if saved
      if (user.address) {
        const parts = user.address.split(',').map(s => s.trim());
        safe('street-address', parts[0]);
        if (parts.length > 1) safe('city', parts[1]);
        if (parts.length > 2) safe('state', parts[2]);
        if (parts.length > 3) safe('postal-code', parts[3]);
      }
    }, 200);
  })();


  /* ─────────────────────────────────────
     STEP MULTI-NAVIGATION CONTROLLER
     ───────────────────────────────────── */

  // Maps step number → progress-bar fill percentage
  const PROGRESS = { 1: "33.3%", 2: "66.6%", 3: "100%" };

  function goToStep(stepNum) {
    // Hide all steps
    document.querySelectorAll(".checkout-step").forEach(s => s.classList.remove("active"));

    // Deactivate all nodes
    document.querySelectorAll(".step-node").forEach(n => n.classList.remove("active", "done"));
    document.querySelectorAll(".step-connector").forEach(c => c.classList.remove("filled"));

    // Show the target step
    const targetStep = document.getElementById(`step-${stepNum}`);
    if (targetStep) {
      targetStep.classList.add("active");
      if (window.gsap) {
        gsap.fromTo(targetStep,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }
        );
      }
    }

    // Update node states
    for (let i = 1; i <= 3; i++) {
      const node = document.getElementById(`node-${i}`);
      if (!node) continue;
      if (i < stepNum)       node.classList.add("done");
      else if (i === stepNum) node.classList.add("active");
    }

    // Fill connectors for completed steps
    for (let c = 1; c <= stepNum - 1; c++) {
      const connector = document.getElementById(`connector-${c}`);
      if (connector) connector.classList.add("filled");
    }

    // Animate progress fill bar
    const fillBar = document.getElementById("progress-fill");
    if (fillBar) fillBar.style.width = PROGRESS[stepNum] || "33.3%";

    const headerH  = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h") || "68");
    const progressH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--progress-h") || "4");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Step 1 → Step 2 (Contact → Address) ──
  const step1Next = document.getElementById("step1-next");
  if (step1Next) {
    step1Next.addEventListener("click", () => {
      const name  = document.getElementById("full-name")?.value.trim();
      const email = document.getElementById("email-address")?.value.trim();
      const phone = document.getElementById("phone-number")?.value.trim();

      if (!name || !email || !phone) {
        showToast("Please complete all contact fields.", true);
        return;
      }
      goToStep(2);
    });
  }

  // ── Step 2 back → Step 1 ──
  const step2Back = document.getElementById("step2-back");
  if (step2Back) {
    step2Back.addEventListener("click", () => goToStep(1));
  }

  // ── Step 2 → Step 3 (Address → Payment) ──
  const step2Next = document.getElementById("step2-next");
  if (step2Next) {
    step2Next.addEventListener("click", () => {
      const street = document.getElementById("street-address")?.value.trim();
      const city   = document.getElementById("city")?.value.trim();
      const state  = document.getElementById("state")?.value.trim();
      const postal = document.getElementById("postal-code")?.value.trim();

      if (!street || !city || !state || !postal) {
        showToast("Please complete all address fields.", true);
        return;
      }
      goToStep(3);
    });
  }

  // ── Step 3 back → Step 2 ──
  const step3Back = document.getElementById("step3-back");
  if (step3Back) {
    step3Back.addEventListener("click", () => goToStep(2));
  }

  // OTP send button — allows Step 1 "Proceed" to enable
  const sendOtpBtn   = document.getElementById("send-otp-btn");
  const otpPanel     = document.getElementById("otp-panel");
  const verifyOtpBtn = document.getElementById("verify-otp-btn");
  const step1NextBtn = document.getElementById("step1-next");

  if (sendOtpBtn && otpPanel) {
    sendOtpBtn.addEventListener("click", () => {
      const phone = document.getElementById("phone-number")?.value.trim();
      if (!phone) { showToast("Enter a phone number first.", true); return; }
      otpPanel.classList.add("open");
      sendOtpBtn.textContent = "Resend Code";
      showToast("Verification code sent to " + phone);
    });
  }

  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener("click", () => {
      const digits = [...document.querySelectorAll(".otp-digit")].map(i => i.value).join("");
      if (digits.length === 4) {
        showToast("Phone verified successfully.");
        if (step1NextBtn) step1NextBtn.disabled = false;
        const otpStatus = document.getElementById("otp-status");
        if (otpStatus) { otpStatus.textContent = "✓ Verified"; otpStatus.style.color = "var(--success, #4caf7d)"; }
      } else {
        showToast("Please enter all 4 digits.", true);
      }
    });
  }

  // OTP digit auto-advance
  document.querySelectorAll(".otp-digit").forEach((input, idx, all) => {
    input.addEventListener("input", () => {
      if (input.value && idx < all.length - 1) all[idx + 1].focus();
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !input.value && idx > 0) all[idx - 1].focus();
    });
  });


  /* ─────────────────────────────────────
     PAYMENT METHOD TAB SWITCHING
     ───────────────────────────────────── */

  document.querySelectorAll(".payment-radio").forEach(radio => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".payment-detail-panel").forEach(p => p.classList.remove("active"));
      document.querySelectorAll(".payment-method-card").forEach(c => c.classList.remove("selected"));

      const panelId = `panel-${radio.value}`;
      const panel   = document.getElementById(panelId);
      if (panel) panel.classList.add("active");
      radio.closest(".payment-method-card")?.classList.add("selected");
    });
  });

  // UPI tabs
  document.querySelectorAll(".upi-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".upi-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".upi-tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const panelEl = document.getElementById(tab.dataset.tab);
      if (panelEl) panelEl.classList.add("active");
    });
  });

  // UPI verify button (simulated)
  const upiVerifyBtn = document.getElementById("upi-verify-btn");
  if (upiVerifyBtn) {
    upiVerifyBtn.addEventListener("click", () => {
      const upiVal   = document.getElementById("upi-address")?.value.trim();
      const upiStatus = document.getElementById("upi-status");
      if (!upiVal) { showToast("Enter your UPI ID first.", true); return; }
      if (upiStatus) {
        upiStatus.textContent  = "✓ UPI ID verified";
        upiStatus.style.color  = "var(--success, #4caf7d)";
        upiStatus.style.fontSize = "13px";
        upiStatus.style.marginTop = "8px";
      }
      showToast("UPI ID verified successfully.");
    });
  }

  // Copy buttons (wire transfer)
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.closest(".copy-val")?.dataset.copy;
      if (val) {
        navigator.clipboard.writeText(val).then(() => showToast("Copied to clipboard."));
      }
    });
  });


  /* ─────────────────────────────────────
     CARD BRAND VALIDATOR DETECTOR
     ───────────────────────────────────── */

  const cardInput = document.getElementById("card-number");
  const cardBadge = document.getElementById("card-type-badge");

  if (cardInput && cardBadge) {
    cardInput.addEventListener("input", e => {
      let value = e.target.value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");

      // Auto-format with spacing
      let formatted = "";
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += " ";
        formatted += value[i];
      }
      e.target.value = formatted.slice(0, 19);

      if      (value.startsWith("4"))              { cardBadge.textContent = "VISA"; cardBadge.className = "card-type-indicator visa"; }
      else if (/^(5[1-5]|2[2-7])/.test(value))    { cardBadge.textContent = "MC";   cardBadge.className = "card-type-indicator mastercard"; }
      else if (/^3[47]/.test(value))               { cardBadge.textContent = "AMEX"; cardBadge.className = "card-type-indicator amex"; }
      else                                          { cardBadge.textContent = "CARD"; cardBadge.className = "card-type-indicator unknown"; }
    });
  }

  // Expiry auto-format
  const expiryInput = document.getElementById("card-expiry");
  if (expiryInput) {
    expiryInput.addEventListener("input", e => {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length > 2) e.target.value = value.slice(0, 2) + " / " + value.slice(2, 4);
      else                  e.target.value = value;
    });
  }

  // CVV restrict to digits
  const cvvInput = document.getElementById("card-cvv");
  if (cvvInput) {
    cvvInput.addEventListener("input", e => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    });
  }


  /* ─────────────────────────────────────
     ORDER FINALIZATION
     ───────────────────────────────────── */

  const placeOrderBtn = document.getElementById("place-order-btn");

  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", () => {
      // Detect active payment method
      const activePayment = document.querySelector(".payment-radio:checked")?.value || "card";

      if (activePayment === "card") {
        const cardNum = document.getElementById("card-number")?.value.replace(/\s/g, "");
        const expiry  = document.getElementById("card-expiry")?.value;
        const cvv     = document.getElementById("card-cvv")?.value;
        if (!cardNum || cardNum.length < 13 || !expiry || expiry.length < 4 || !cvv || cvv.length < 3) {
          showToast("Please complete all card details.", true);
          return;
        }
      } else if (activePayment === "upi") {
        const upiVal = document.getElementById("upi-address")?.value.trim();
        if (!upiVal) { showToast("Please enter and verify your UPI ID.", true); return; }
      }

      // Loading state
      const originalHTML     = placeOrderBtn.innerHTML;
      placeOrderBtn.innerHTML = `<span class="spinner"></span> Processing…`;
      placeOrderBtn.disabled  = true;

      setTimeout(() => {
        placeOrderBtn.innerHTML = originalHTML;
        placeOrderBtn.disabled  = false;

        // Generate order reference
        const ref = `ORDER-2026-${String(Date.now()).slice(-4)}`;
        const successRef   = document.getElementById("success-ref");
        const wireRef      = document.getElementById("wire-reference");
        if (successRef) successRef.textContent = ref;
        if (wireRef)    wireRef.textContent    = ref;

        // Persist order to user profile (persists across sessions)
        if (window.GalleryAuth && window.GalleryAuth.saveOrder) {
          const { total } = calculateTotals();
          window.GalleryAuth.saveOrder(ref, cart, total);
        } else {
          // Fallback: just clear cart
          sessionStorage.removeItem("sc_cart");
          localStorage.removeItem("sc_cart");
        }

        // Navigate to success screen
        goToStep("success");
        const successEl = document.getElementById("step-success");
        if (successEl) {
          successEl.classList.add("active");
          if (window.gsap) {
            gsap.fromTo(successEl,
              { opacity: 0, y: 28 },
              { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
            );
          }
        }
      }, 2200);
    });
  }


  /* ─────────────────────────────────────
     TOAST NOTIFICATIONS
     ───────────────────────────────────── */

  const coToast  = document.getElementById("co-toast");
  let toastTimer = null;

  function showToast(msg, isError = false) {
    if (!coToast) return;
    coToast.textContent = msg;
    coToast.className   = "co-toast show" + (isError ? " error-toast" : "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { coToast.className = "co-toast"; }, 3500);
  }

  // Make showToast available to inline HTML if ever needed
  window.checkoutShowToast = showToast;

});