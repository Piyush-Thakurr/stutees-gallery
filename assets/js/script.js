// Register GSAP ScrollTrigger Plugin
gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {
  const strokes = document.querySelectorAll(".brush-stroke");
  const cartBadge = document.querySelector(".cart-badge");
  const toast = document.getElementById("toast");
  let cartCount = 0;

  // Internal cart array — persists via GalleryAuth (localStorage) for logged-in users
  // Falls back to sessionStorage for guests
  function loadCart() {
    if (window.GalleryAuth) return window.GalleryAuth.getCart() || [];
    try { return JSON.parse(sessionStorage.getItem("sc_cart")) || []; } catch(e) { return []; }
  }
  function persistCart(arr) {
    const s = JSON.stringify(arr);
    sessionStorage.setItem("sc_cart", s);
    localStorage.setItem("sc_cart", s); // Always write to localStorage too
  }

  // Load existing cart (so badge reflects cart from previous pages)
  let sessionCart = loadCart();
  cartCount = sessionCart.reduce((acc, i) => acc + (i.qty || 1), 0);
  if (cartBadge) cartBadge.textContent = cartCount || 0;

  // Initialize paths stroke dash properties immediately
  strokes.forEach(stroke => {
    const len = stroke.getTotalLength();
    stroke.style.strokeDasharray = len;
    stroke.style.strokeDashoffset = len;
  });

  // Create responsive media query matches using GSAP matchMedia
  const mm = gsap.matchMedia();

  // DESKTOP ANIMATION WORKFLOW (Viewport > 992px)
  mm.add("(min-width: 993px)", () => {
    // 1. Initial State Setup
    gsap.set(".gallery-wall", { scale: 2.6 });
    gsap.set([".left-col .product-card", ".right-col .product-card", ".artwork-shop-details"], {
      opacity: 0,
      y: 40,
      visibility: "hidden"
    });
    gsap.set(".intro-overlay", { opacity: 1, y: 0 });

    // 2. Master Scrubbing Timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".scroll-track",
        start: "top top",
        end: "bottom bottom",
        scrub: 1.2, // Smooth follow scrub
        pin: ".sticky-viewport", // Pins viewport on scroll
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // Update custom progress bar in header
          document.getElementById("scroll-progress").style.width = `${self.progress * 100}%`;
        }
      }
    });

    /* 
      PHASE 1: 0% to 35% Scroll (Timeline units: 0 to 3.5)
      - Fade out intro texts
      - Progressively draw in the painting using brush strokes on the blank canvas
    */
    tl.to(".intro-overlay", {
      opacity: 0,
      y: -30,
      duration: 1.5,
      ease: "power2.out"
    }, 0);

    // Stagger reveal of brush stroke mask paths
    tl.to(strokes, {
      strokeDashoffset: 0,
      duration: 3.5,
      stagger: {
        each: 0.35,
        from: "start"
      },
      ease: "power2.inOut"
    }, 0.2);

    /*
      PHASE 2: 35% to 75% Scroll (Timeline units: 3.5 to 7.5)
      - Scale down the gallery wall from 2.6x to 1x
      - Transitions the huge painting into its balanced central slot in the grid
    */
    tl.to(".gallery-wall", {
      scale: 1,
      duration: 4.0,
      ease: "power2.inOut"
    }, 3.5);

    /*
      PHASE 3: 75% to 100% Scroll (Timeline units: 7.5 to 10.0)
      - Stagger fade-up entry of the left and right product card columns
      - Fade in the original painting store metadata and buy action panel
    */
    tl.to([".left-col .product-card", ".right-col .product-card"], {
      opacity: 1,
      y: 0,
      visibility: "visible",
      duration: 2.0,
      stagger: 0.15,
      ease: "power3.out"
    }, 7.5);

    tl.to(".artwork-shop-details", {
      opacity: 1,
      y: 0,
      visibility: "visible",
      duration: 1.5,
      ease: "power2.out"
    }, 8.2);

    return () => {
      // Optional cleanup block when transitioning breakpoints
    };
  });

  // MOBILE REVEAL FALLBACK (Viewport <= 992px)
  mm.add("(max-width: 992px)", () => {
    // Instantly reveal all details on mobile to support standard scrolling
    gsap.set(".gallery-wall", { scale: 1 });
    gsap.set([".product-card", ".artwork-shop-details", ".grid-block"], {
      opacity: 1,
      y: 0,
      visibility: "visible"
    });
    strokes.forEach(stroke => {
      stroke.style.strokeDashoffset = 0;
    });
    document.getElementById("scroll-progress").style.width = "100%";
  });


  /* --- INTERACTIVE ACTION LISTENERS --- */

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // Card Add to Cart triggers
  document.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".product-card");
      const title = card.querySelector("h3").textContent;

      // Track item in sessionCart
      const existing = sessionCart.find(i => i.name === title || i.title === title);
      if (existing) { existing.qty = (existing.qty || 1) + 1; }
      else { sessionCart.push({ name: title, title: title, qty: 1 }); }

      cartCount = sessionCart.reduce((acc, i) => acc + (i.qty || 1), 0);
      cartBadge.textContent = cartCount;

      // Persist cart to both storages
      persistCart(sessionCart);

      // Cart badge pop micro-animation
      gsap.fromTo(cartBadge,
        { scale: 0.7 },
        { scale: 1, duration: 0.35, ease: "back.out(2)" }
      );

      showToast(`Added "${title}" to your cart.`);
    });
  });

  // Original Painting Acquisition trigger
  const buyOriginalBtn = document.querySelector(".buy-original");
  if (buyOriginalBtn) {
    buyOriginalBtn.addEventListener("click", () => {
      showToast("Acquisition request sent. A private art advisor will contact you within 24 hours.");

      buyOriginalBtn.textContent = "Acquisition Pending";
      buyOriginalBtn.style.backgroundColor = "#8a91a0";
      buyOriginalBtn.style.borderColor = "#8a91a0";
      buyOriginalBtn.style.color = "#07080a";
      buyOriginalBtn.style.pointerEvents = "none";
    });
  }

  // Cart icon click → save cart & redirect to checkout
  const cartIconEl = document.querySelector(".cart-icon");
  if (cartIconEl) {
    cartIconEl.style.cursor = "pointer";
    cartIconEl.addEventListener("click", () => {
      if (sessionCart.length > 0) {
        persistCart(sessionCart);
        window.location.href = "checkout.html";
      } else {
        showToast("Your cart is empty — add items to begin checkout.");
      }
    });
  }
});

// Target both standard cards and the main central container canvas
document.querySelectorAll('.product-card, .central-canvas-container').forEach(item => {
  item.addEventListener('click', (e) => {
    // If they click the absolute action buttons directly, let the shopping cart process it instead
    if (e.target.classList.contains('add-to-cart') || e.target.classList.contains('buy-original')) {
      return;
    }
    
    // Grab the custom ID attribute value
    const id = item.getAttribute('data-id');
    
    // Redirect to our dynamic presentation viewer page
    if (id) {
      window.location.href = `product.html?id=${id}`;
    }
  });
});