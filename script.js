/* ============================================
   Portfolio — Interactive JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ---- DOM References ----
  const cursorGlow = document.getElementById('cursorGlow');
  const wheelToggle = document.getElementById('wheelToggle');
  const optionWheel = document.getElementById('optionWheel');

  // ---- Cursor Glow (desktop only) ----
  if (window.matchMedia('(pointer: fine)').matches) {
    let glowX = 0, glowY = 0;
    let currentX = 0, currentY = 0;

    document.addEventListener('mousemove', (e) => {
      glowX = e.clientX;
      glowY = e.clientY;
    });

    function animateGlow() {
      currentX += (glowX - currentX) * 0.08;
      currentY += (glowY - currentY) * 0.08;
      cursorGlow.style.transform = `translate(${currentX - 300}px, ${currentY - 300}px)`;
      requestAnimationFrame(animateGlow);
    }

    animateGlow();
  } else {
    cursorGlow.style.display = 'none';
  }

  // ---- Option Wheel Navigation ----
  const wheelItems = Array.from(optionWheel.querySelectorAll('.option-wheel__item'));
  const wheelCount = wheelItems.length;
  const wheelSectionIds = wheelItems.map(el => el.dataset.section);

  // Wheel configuration
  const WC = {
    fontSize: 1.8,
    spacing: 1.5,
    curve: 1,
    tilt: 8,
    blur: 2,
    fade: 0.3,
    minOpacity: 0.08,
    smoothing: 200,
    side: 'left',
    loop: false,
  };

  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const rowH = Math.max(WC.fontSize * WC.spacing * remPx, 1);

  let wheelPos = 0;
  let wheelTarget = 0;
  let wheelSelected = 0;
  let wheelRafId = null;
  let wheelLastTime = 0;
  let wheelScrollTimer = null;
  let wheelDragState = null;
  let wheelDragMoved = false;
  let isWheelNavigating = false;
  let wheelNavTimeout = null;

  // Color interpolation (var(--text-tertiary) → var(--text-primary))
  const colA = [107, 114, 128]; // #6b7280
  const colB = [240, 242, 245]; // #f0f2f5
  function mixColor(t) {
    return `rgb(${Math.round(colA[0] + (colB[0] - colA[0]) * t)}, ${Math.round(colA[1] + (colB[1] - colA[1]) * t)}, ${Math.round(colA[2] + (colB[2] - colA[2]) * t)})`;
  }

  // rAF animation loop — frame-rate independent exponential smoothing
  function wheelRunFrame(now) {
    const dt = Math.min((now - wheelLastTime) / 1000, 0.05);
    wheelLastTime = now;
    const tau = Math.max(WC.smoothing, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let next = wheelPos + (wheelTarget - wheelPos) * k;
    const settled = Math.abs(wheelTarget - next) < 0.001;
    if (settled) next = wheelTarget;
    wheelPos = next;

    const mirror = WC.side === 'right' ? -1 : 1;
    const tiltRad = (WC.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? rowH / tiltRad : 0;

    for (let i = 0; i < wheelCount; i++) {
      const el = wheelItems[i];
      let d = i - next;
      if (WC.loop && wheelCount > 1) {
        d = ((d % wheelCount) + wheelCount) % wheelCount;
        if (d > wheelCount / 2) d -= wheelCount;
      }
      const dist = Math.abs(d);
      let x = 0, y = d * rowH, rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang);
        x = -mirror * R * (1 - Math.cos(ang)) * WC.curve;
        rot = (mirror * ang * 180) / Math.PI;
      }
      el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      el.style.opacity = String(Math.max(WC.minOpacity, 1 - dist * WC.fade));
      el.style.filter = WC.blur > 0 ? `blur(${(dist * WC.blur).toFixed(2)}px)` : 'none';

      const p = Math.max(0, 1 - Math.min(dist, 1));
      el.style.color = mixColor(p);
      el.style.fontWeight = (i === wheelSelected) ? '600' : '300';
    }

    wheelRafId = settled ? null : requestAnimationFrame(wheelRunFrame);
  }

  function wheelStartLoop() {
    if (wheelRafId != null) cancelAnimationFrame(wheelRafId);
    wheelLastTime = performance.now();
    wheelRafId = requestAnimationFrame(wheelRunFrame);
  }

  function wheelApplyTarget(value, snap) {
    let v = value;
    if (!WC.loop) v = Math.min(Math.max(v, 0), Math.max(wheelCount - 1, 0));
    if (snap) v = Math.round(v);
    wheelTarget = v;
    const idx = ((Math.round(v) % wheelCount) + wheelCount) % wheelCount;
    if (idx !== wheelSelected) {
      wheelSelected = idx;
      const sectionId = wheelSectionIds[idx];
      if (sectionId) {
        isWheelNavigating = true;
        if (wheelNavTimeout) clearTimeout(wheelNavTimeout);
        wheelNavTimeout = setTimeout(() => { isWheelNavigating = false; }, 1200);
        const section = document.getElementById(sectionId);
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
    }
    wheelStartLoop();
  }

  // Wheel / touchpad scroll (non-passive to prevent page scroll)
  optionWheel.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
    const step = Math.max(-1, Math.min(1, delta / rowH));
    wheelTarget += step;
    if (!WC.loop) wheelTarget = Math.min(Math.max(wheelTarget, 0), wheelCount - 1);
    wheelStartLoop();
    if (wheelScrollTimer) clearTimeout(wheelScrollTimer);
    wheelScrollTimer = setTimeout(() => wheelApplyTarget(wheelTarget, true), 140);
  }, { passive: false });

  // Pointer drag
  optionWheel.addEventListener('pointerdown', (e) => {
    wheelDragState = { y: e.clientY, start: wheelTarget, id: e.pointerId };
    wheelDragMoved = false;
    optionWheel.classList.add('option-wheel--dragging');
  });

  window.addEventListener('pointermove', (e) => {
    if (!wheelDragState) return;
    const dy = e.clientY - wheelDragState.y;
    if (!wheelDragMoved && Math.abs(dy) > 4) {
      wheelDragMoved = true;
      optionWheel.setPointerCapture(wheelDragState.id);
    }
    if (wheelDragMoved) {
      let v = wheelDragState.start - dy / rowH;
      if (!WC.loop) v = Math.min(Math.max(v, 0), wheelCount - 1);
      wheelTarget = v;
      wheelStartLoop();
    }
  });

  function wheelPointerEnd() {
    if (!wheelDragState) return;
    wheelDragState = null;
    optionWheel.classList.remove('option-wheel--dragging');
    if (wheelDragMoved) wheelApplyTarget(wheelTarget, true);
  }

  window.addEventListener('pointerup', wheelPointerEnd);
  window.addEventListener('pointercancel', wheelPointerEnd);

  // Click on individual items
  wheelItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      if (wheelDragMoved) return;
      wheelApplyTarget(index, true);
    });
  });

  // Keyboard navigation
  optionWheel.addEventListener('keydown', (e) => {
    let delta = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
    if (delta == null) return;
    e.preventDefault();
    wheelApplyTarget(Math.round(wheelTarget) + delta, true);
  });

  // Track active section on scroll → update wheel position
  function updateWheelFromScroll() {
    if (isWheelNavigating) return;
    const scrollPos = window.scrollY + window.innerHeight / 3;
    for (let i = wheelSectionIds.length - 1; i >= 0; i--) {
      const section = document.getElementById(wheelSectionIds[i]);
      if (section && section.offsetTop <= scrollPos) {
        if (i !== wheelSelected) {
          wheelSelected = i;
          wheelTarget = i;
          wheelStartLoop();
        }
        break;
      }
    }
  }

  window.addEventListener('scroll', updateWheelFromScroll, { passive: true });

  // Mobile wheel toggle
  wheelToggle.addEventListener('click', () => {
    wheelToggle.classList.toggle('active');
    optionWheel.classList.toggle('open');
    document.body.style.overflow = optionWheel.classList.contains('open') ? 'hidden' : '';
  });

  wheelItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        wheelToggle.classList.remove('active');
        optionWheel.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  });

  // Initialize wheel
  wheelStartLoop();
  updateWheelFromScroll();

  // ---- Scroll Reveal (Intersection Observer) ----
  const revealElements = document.querySelectorAll(
    '.section-label, .section-heading, .about-text, .about-skills, ' +
    '.timeline-item, .project-card, .research-card, .footer-cta, .footer-grid'
  );

  revealElements.forEach((el) => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -60px 0px',
    }
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  // ---- Staggered reveal for project cards ----
  const projectCards = document.querySelectorAll('.project-card');
  projectCards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 0.1}s`;
  });

  // ---- Skill tag tilt on hover (micro-interaction) ----
  const skillTags = document.querySelectorAll('.skill-tag');
  skillTags.forEach((tag) => {
    tag.addEventListener('mouseenter', () => {
      const randomRotate = (Math.random() - 0.5) * 4;
      tag.style.transform = `translateY(-2px) rotate(${randomRotate}deg)`;
    });
    tag.addEventListener('mouseleave', () => {
      tag.style.transform = '';
    });
  });

  // ---- Project card parallax tilt ----
  const cards = document.querySelectorAll('.project-card');
  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -3;
      const rotateY = ((x - centerX) / centerX) * 3;

      card.style.transform = `translateY(-4px) perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // ---- Smooth anchor scrolling ----
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ---- Scroll to Top button ----
  const scrollTopBtn = document.getElementById('scrollTopBtn');

  function handleScrollTopVisibility() {
    if (window.scrollY > 500) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', handleScrollTopVisibility, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---- Page loaded state ----
  document.body.classList.add('loaded');
});
