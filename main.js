// main.js

// ---------------------------
// HERO SLIDER (igual que antes)
// ---------------------------
(function () {
  const slider = document.querySelector("[data-slider]");
  if (!slider) return;

  const track = slider.querySelector("[data-slider-track]");
  const slides = Array.from(slider.querySelectorAll("[data-slide]"));
  const btnPrev = slider.querySelector("[data-slider-prev]");
  const btnNext = slider.querySelector("[data-slider-next]");
  const dotsRoot = slider.closest(".hero")?.querySelector("[data-slider-dots]");
  const viewport = slider.querySelector("[data-slider-viewport]");

  if (!track || slides.length === 0 || !btnPrev || !btnNext || !dotsRoot || !viewport) return;

  let index = 0;
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  dotsRoot.innerHTML = "";
  const dots = slides.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hero-dot-btn";
    b.setAttribute("aria-label", `Ir al slide ${i + 1}`);
    b.addEventListener("click", () => goTo(i));
    dotsRoot.appendChild(b);
    return b;
  });

  function updateAria() {
    slides.forEach((s, i) => {
      s.setAttribute("aria-hidden", i === index ? "false" : "true");
      s.tabIndex = i === index ? 0 : -1;
      s.setAttribute("aria-label", `${i + 1} de ${slides.length}`);
    });
    dots.forEach((d, i) => d.setAttribute("aria-current", i === index ? "true" : "false"));
  }

  function applyTransform() {
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    applyTransform();
    updateAria();
  }

  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }

  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);

  slider.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    currentX = startX;
    track.style.transition = "none";
    viewport.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    currentX = e.clientX;
    const dx = currentX - startX;
    const width = viewport.getBoundingClientRect().width || 1;
    const pct = (dx / width) * 100;
    track.style.transform = `translateX(calc(-${index * 100}% + ${pct}%))`;
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;

    const dx = currentX - startX;
    const width = viewport.getBoundingClientRect().width || 1;
    const threshold = Math.min(80, width * 0.12);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.style.transition = reduceMotion ? "none" : "transform 360ms ease";

    if (dx > threshold) prev();
    else if (dx < -threshold) next();
    else goTo(index);
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);

  goTo(0);
})();


/// ---------------------------
// SELECTED MARQUEE (A): infinito, suave, editorial
// - duplica items para loop sin salto
// - pausa en hover/focus
// - pausa temporal en interacción (wheel/drag/touch) y luego retoma
// - pausa mientras lightbox está abierto y retoma al cerrar
// - respeta prefers-reduced-motion
// ---------------------------
(function () {
  const viewport = document.querySelector("[data-marquee-viewport]");
  const track = document.querySelector("[data-marquee-track]");
  if (!viewport || !track) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const originalItems = Array.from(track.children);
  if (originalItems.length === 0) return;

  // Clonar una vez para loop
  originalItems.forEach((node) => track.appendChild(node.cloneNode(true)));

  let raf = null;
  let offset = 0;

  // Control de pausas (editorial): hover/focus + interacción + lightbox
  let hoverPaused = false;
  let interactionPaused = false;
  let lightboxPaused = false;

  const SPEED = 0.35; // px por frame aprox
  let wheelTimer = null;
  let pointerDown = false;

  function getHalfWidth() {
    const half = track.scrollWidth / 2;
    return Number.isFinite(half) ? half : 0;
  }

  function isPaused() {
    return hoverPaused || interactionPaused || lightboxPaused;
  }

  function step() {
    if (!isPaused()) {
      offset -= SPEED;
      const half = getHalfWidth();
      if (half > 0 && Math.abs(offset) >= half) offset = 0;
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
    }
    raf = requestAnimationFrame(step);
  }

  // Pausa por hover/focus
  viewport.addEventListener("mouseenter", () => (hoverPaused = true));
  viewport.addEventListener("mouseleave", () => (hoverPaused = false));
  viewport.addEventListener("focusin", () => (hoverPaused = true));
  viewport.addEventListener("focusout", () => (hoverPaused = false));

  // Pausa temporal por wheel (retoma sola)
  viewport.addEventListener(
    "wheel",
    () => {
      interactionPaused = true;
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        interactionPaused = false;
      }, 900);
    },
    { passive: true }
  );

  // Pausa mientras el usuario arrastra/toca, retoma al soltar
  viewport.addEventListener("pointerdown", () => {
    pointerDown = true;
    interactionPaused = true;
  });

  function releasePointerPause() {
    if (!pointerDown) return;
    pointerDown = false;
    interactionPaused = false;
  }

  viewport.addEventListener("pointerup", releasePointerPause);
  viewport.addEventListener("pointercancel", releasePointerPause);
  viewport.addEventListener("pointerleave", releasePointerPause);

  // Nudges con flechas (pausa breve y retoma)
  const btnPrev = viewport.querySelector("[data-marquee-prev]");
  const btnNext = viewport.querySelector("[data-marquee-next]");

  function normalizeOffset() {
    const half = getHalfWidth();
    if (half <= 0) return;
    while (offset > 0) offset -= half;
    while (Math.abs(offset) >= half) offset += half;
  }

  function nudge(dir) {
    interactionPaused = true;

    const first = track.querySelector(".carousel-card");
    const cardW = first ? first.getBoundingClientRect().width : 480;
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap || "24") || 24;
    const jump = cardW + gap;

    offset += dir * jump;
    normalizeOffset();

    track.style.transition = "transform 360ms ease";
    track.style.transform = `translate3d(${offset}px, 0, 0)`;

    window.setTimeout(() => {
      track.style.transition = "";
      interactionPaused = false;
    }, 380);
  }

  btnPrev?.addEventListener("click", () => nudge(+1));
  btnNext?.addEventListener("click", () => nudge(-1));

  // Lightbox: pausar abierto, retomar al cerrar
  document.addEventListener("lightbox:open", () => {
    lightboxPaused = true;
  });
  document.addEventListener("lightbox:close", () => {
    lightboxPaused = false;
  });

  raf = requestAnimationFrame(step);
})();



// ---------------------------
// LIGHTBOX — imagen pura + UI afuera (navegable)
// ---------------------------
(function () {
  const all = Array.from(document.querySelectorAll(".carousel-card[data-lightbox]"));
  if (all.length === 0) return;

  // Solo items originales (la segunda mitad son clones del marquee)
  const items = all.slice(0, Math.ceil(all.length / 2));

  const modal = document.createElement("div");
  modal.className = "lightbox";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="lightbox__backdrop" data-lb-close></div>

    <div class="lightbox__topbar" aria-hidden="false">
      <div></div>
      <button class="lightbox__close" type="button" data-lb-close aria-label="Cerrar">×</button>
    </div>

    <button class="lightbox__navbtn lightbox__navbtn--prev" type="button" data-lb-prev aria-label="Anterior">‹</button>
    <button class="lightbox__navbtn lightbox__navbtn--next" type="button" data-lb-next aria-label="Siguiente">›</button>

    <div class="lightbox__stage" role="dialog" aria-modal="true" aria-label="Vista ampliada">
      <!-- aquí se inserta la media -->
    </div>

    <div class="lightbox__meta" aria-live="polite"></div>
  `;
  document.body.appendChild(modal);

  const stage = modal.querySelector(".lightbox__stage");
  const meta = modal.querySelector(".lightbox__meta");
  const closeEls = Array.from(modal.querySelectorAll("[data-lb-close]"));
  const prevBtn = modal.querySelector("[data-lb-prev]");
  const nextBtn = modal.querySelector("[data-lb-next]");

  let lastFocus = null;
  let currentIndex = 0;

  function getMetaText(card) {
    const caption = card.querySelector(".caption");
    if (!caption) return "";
    const parts = Array.from(caption.querySelectorAll("span"))
      .map((s) => s.textContent?.trim())
      .filter(Boolean);
    return parts.join(" · ");
  }

  function render(index) {
    const card = items[index];
    if (!card) return;

    // Limpiar stage
    stage.innerHTML = "";

    // Preferimos un <img> si existe dentro del item (en el futuro, cuando uses imágenes reales)
    const img = card.querySelector(".selected-media img");
    if (img) {
      const clone = img.cloneNode(true);
      clone.classList.add("lightbox__img");
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      stage.appendChild(clone);
    } else {
      // Si no hay img, clonamos el placeholder pero sin caja
      const ph = document.createElement("div");
      ph.className = "lightbox__placeholder";
      stage.appendChild(ph);
    }

    meta.textContent = getMetaText(card);
  }

  function openAt(index) {
    lastFocus = document.activeElement;
    currentIndex = index;

    render(currentIndex);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.dispatchEvent(new CustomEvent("lightbox:open"));

    modal.querySelector("[data-lb-close]")?.focus();
  }

  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    document.dispatchEvent(new CustomEvent("lightbox:close"));

    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function prev() {
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    render(currentIndex);
  }

  function next() {
    currentIndex = (currentIndex + 1) % items.length;
    render(currentIndex);
  }

  items.forEach((card, idx) => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      openAt(idx);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAt(idx);
      }
    });
  });

  closeEls.forEach((el) => el.addEventListener("click", close));
  prevBtn?.addEventListener("click", prev);
  nextBtn?.addEventListener("click", next);

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });
})();

// ---------------------------
// Menu toggle (panel) — overlay editorial
// - Botón siempre visible (Menu/Close)
// - Cierra con backdrop, Escape y click en links
// - Bloquea scroll del body cuando está abierto
// ---------------------------
(() => {
  const btn = document.querySelector("[data-menu-toggle]");
  const panel = document.querySelector("[data-menu-panel]");
  const backdrop = document.querySelector("[data-menu-backdrop]");
  if (!btn || !panel || !backdrop) return;

  const links = Array.from(panel.querySelectorAll("a[href]"));

  const open = () => {
    document.documentElement.classList.add("is-menu-open");
    btn.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    btn.textContent = "Close";
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    document.documentElement.classList.remove("is-menu-open");
    btn.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    btn.textContent = "Menu";
    document.body.style.overflow = "";
  };

  btn.addEventListener("click", () => {
    const isOpen = document.documentElement.classList.contains("is-menu-open");
    isOpen ? close() : open();
  });

  backdrop.addEventListener("click", close);
  links.forEach((a) => a.addEventListener("click", () => close()));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();
