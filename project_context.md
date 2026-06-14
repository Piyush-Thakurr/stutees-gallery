# Stutee's Gallery — Project Context & Handoff Summary

---

## Project Goal
A high-fidelity, premium interactive art exhibition and e-commerce portfolio for Stutee's Art Gallery. Features a fixed glassmorphism header, GSAP-driven scroll-pinned canvas reveal animation, brush-stroke SVG masking pipeline, responsive product grid, OTP-based phone authentication, persistent cart system, multi-step checkout flow, and live order tracking.

---

## Current Status
**Frontend: 100% Complete**
All pages, animations, cart logic, auth system, and checkout flow are fully built and working. Git repository initialized and connected to GitHub. Ready for backend integration.

---

## Live URLs
- **GitHub Repo:** `https://github.com/Piyush-Thakurr/stutees-gallery`
- **GitHub Pages:** `https://piyush-thakurr.github.io/stutees-gallery/` *(enable in repo Settings → Pages)*
- **Previous Netlify deploy:** Superseded by GitHub — no longer primary

---

## Folder Structure
```
artworkflow/
├── index.html          ← Main gallery page (entry point)
├── product.html        ← Dynamic artwork detail viewer (?id= param)
├── checkout.html       ← Multi-step checkout + OTP verification
├── .gitignore          ← Ignores .vscode/, node_modules/, logs
│
├── assets/
│   ├── css/
│   │   ├── index.css       ← Global design tokens + gallery layout
│   │   └── checkout.css    ← Checkout-specific styles
│   ├── js/
│   │   ├── auth.js         ← OTP auth, user profile, order history system
│   │   ├── script.js       ← GSAP animations, cart logic, scroll timeline
│   │   └── checkout.js     ← Checkout form, payment flow, order placement
│   └── images/
│       ├── imgfinal.jpeg   ← Hero centerpiece painting
│       ├── img1–img11.jpeg ← Product card artwork images
│       └── artwork_painting.png
│
└── project_context.md  ← This file
```

---

## Pages & What They Do

### `index.html`
- Fixed glassmorphism header with cart badge + auth icon
- GSAP ScrollTrigger pinned viewport with 3-phase scroll timeline:
  - Phase 1 (0–35%): Brush stroke SVG mask reveal of hero painting
  - Phase 2 (35–75%): Scale down gallery wall from 2.6x → 1x
  - Phase 3 (75–100%): Stagger fade-in of product cards + shop details
- Mobile fallback: all animations skipped, content immediately visible
- Click on any card → redirects to `product.html?id=N`

### `product.html`
- Reads `?id=` URL param → renders matching artwork from `artworkData` object
- Shows full image, title, price, description
- Add to Cart → writes to shared `sc_cart` in localStorage
- Cart icon → redirects to `checkout.html`

### `checkout.html`
- Pulls cart from `sc_cart` localStorage key
- Multi-step form: cart review → shipping details → OTP phone verification → confirmation
- On success: saves order to `sc_orders`, clears cart, shows order reference

---

## Key JavaScript Systems

### Cart System (`sc_cart` in localStorage)
- Shared across all 3 pages via localStorage + sessionStorage sync
- `persistCart(arr)` writes to both storages
- `loadCart()` prefers localStorage, falls back to sessionStorage
- Badge count updates on every page load

### Auth System (`auth.js`)
- Injected into every page's header automatically on DOM ready
- Stores user as `sc_user` in localStorage: `{ name, phone, email, address }`
- OTP is simulated client-side (4-digit, stored temporarily as `sc_otp_temp`)
- Profile panel has 3 tabs: Cart preview / Order history / Live order tracking
- Order status auto-calculates from timestamp elapsed (Confirmed → Delivered over 4 days)
- Exports `window.GalleryAuth` for cross-page access

### Animation System (`script.js`)
- GSAP 3.12.5 + ScrollTrigger via CDN
- `gsap.matchMedia()` handles desktop (>992px) vs mobile (≤992px) breakpoints
- SVG brush strokes use `strokeDashoffset` animation for paint reveal effect
- Scroll progress bar in header synced to ScrollTrigger `onUpdate`

---

## Git Setup

| Thing | Value |
|---|---|
| Git initialized at | `C:\Users\piyus\Downloads\webdev\one\artworkflow` |
| Remote | `origin → github.com/Piyush-Thakurr/stutees-gallery` |
| Branch | `main` |
| First commit | `Initial commit — Stutee's Gallery` |

### Daily workflow to push changes:
```powershell
git add .
git commit -m "describe what you changed"
git push
```

---

## How to Run Locally
Just open `index.html` in a browser — no build step, no server needed.
For best results use VS Code's **Live Server** extension (right-click `index.html` → Open with Live Server).

---

## Known Issues / Decisions
- OTP is currently **simulated client-side** — not connected to a real SMS provider (Twilio etc.). This is intentional until backend is built.
- Payment is **UI-only** — no real payment gateway connected yet (Razorpay integration is the next step).
- All artwork data (`artworkData` object) is **hardcoded in `product.html`** — will move to a database once backend exists.
- Image paths use relative paths (`assets/images/`) — do not move HTML files into subfolders or paths will break.

---

## Roadmap — What's Next Before Launch

### Stage 1 — Backend (Node.js + Express)
- [ ] Set up Node.js + Express server
- [ ] Learn REST API concepts (GET, POST, routes, middleware)
- [ ] Build `/api/orders` endpoint to store real orders
- [ ] Build `/api/auth` endpoint with real OTP via Twilio SMS
- [ ] Connect MongoDB or PostgreSQL to persist users + orders
- [ ] Move `artworkData` from hardcoded JS → database-driven API

### Stage 2 — Payment Integration
- [ ] Integrate Razorpay (India-first, easiest for INR)
- [ ] Test payment flow end to end in sandbox mode
- [ ] Store order + payment reference in database on success

### Stage 3 — System Design (Before Scale)
- [ ] Learn basic system design concepts: client-server model, APIs, databases, caching
- [ ] Understand how requests flow: Browser → Express server → Database → Response
- [ ] Learn about environment variables (`.env`) — never hardcode API keys
- [ ] Understand CORS, HTTPS, and basic security headers
- [ ] Learn about rate limiting (protect OTP endpoint from abuse)

### Stage 4 — Deployment (Production)
- [ ] Deploy backend to **Railway** or **Render** (free tier, beginner friendly)
- [ ] Deploy frontend to **Vercel** or keep on GitHub Pages
- [ ] Connect a custom domain (e.g. `stuteesgallery.com`) via Namecheap/GoDaddy
- [ ] Set up SSL certificate (free via Let's Encrypt / auto on Vercel)
- [ ] Set up environment variables in deployment dashboard (not in code)

### Stage 5 — Launch
- [ ] End-to-end test on real mobile devices
- [ ] Test real payment with ₹1 transaction
- [ ] Test real OTP delivery
- [ ] Share live URL

---

## Learning Resources (Recommended Order)
1. **Node.js + Express basics** → [expressjs.com/en/starter](https://expressjs.com/en/starter/hello-world.html)
2. **MongoDB basics** → [mongodb.com/docs/manual/tutorial](https://www.mongodb.com/docs/manual/tutorial/getting-started/)
3. **Razorpay integration guide** → [razorpay.com/docs](https://razorpay.com/docs/)
4. **System Design primer** → [github.com/donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer)
5. **Deployment on Railway** → [docs.railway.app](https://docs.railway.app)

---

also need to modify the web for proper working on mobiles

*Last updated: June 2026 — Frontend complete, Git connected, backend roadmap defined.*