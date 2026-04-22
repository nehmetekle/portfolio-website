/* ════════════════════════════════════════
   PORTFOLIO SCRIPT — Paul Nehme Tekle
════════════════════════════════════════ */

/* ─── Splash intro → hero handoff ───────── */
(function initSplash() {
  const splash  = document.getElementById('splash');
  const tag     = document.getElementById('splash-tag');
  const name1   = document.getElementById('splash-name-1');
  const name2   = document.getElementById('splash-name-2');
  const role    = document.getElementById('splash-role');

  // Keep hero name invisible until we hand off
  const heroName = document.getElementById('hero-name');
  gsap.set(heroName, { opacity: 0 });

  document.body.classList.add('splash-active');

  const tl = gsap.timeline();

  // 1 — </> tag drops in
  tl.to(tag,  { opacity: 1, duration: 0.5, ease: 'back.out(1.7)', delay: 0.2 })
  // 2 — name lines rise up
    .to([name1, name2], {
      opacity: 1, y: 0,
      duration: 0.6, stagger: 0.12, ease: 'power3.out'
    }, '-=0.1')
  // 3 — role fades in
    .to(role, { opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=0.2')
  // 4 — hold
    .to({}, { duration: 0.65 })
  // 5 — tag + role fade out
    .to([tag, role], { opacity: 0, duration: 0.3, ease: 'power2.in' })
  // 6 — name lines fly to hero position
    .add(() => {
      // Measure target (hero name) position
      const heroRect  = heroName.getBoundingClientRect();
      const n1Rect    = name1.getBoundingClientRect();
      const n2Rect    = name2.getBoundingClientRect();

      // Scale factor: hero font is ~same display font, compare heights
      const heroNameEl  = heroName.querySelector('.hero-line');
      const heroAccEl   = heroName.querySelector('.hero-line-accent');
      const heroN1Rect  = heroNameEl  ? heroNameEl.getBoundingClientRect()  : heroRect;
      const heroN2Rect  = heroAccEl   ? heroAccEl.getBoundingClientRect()   : heroRect;

      const scaleN1 = heroN1Rect.height / (n1Rect.height || 1);
      const scaleN2 = heroN2Rect.height / (n2Rect.height || 1);

      gsap.to(name1, {
        x: heroN1Rect.left - n1Rect.left,
        y: heroN1Rect.top  - n1Rect.top,
        scale: scaleN1,
        transformOrigin: 'top left',
        duration: 0.75, ease: 'power3.inOut'
      });
      gsap.to(name2, {
        x: heroN2Rect.left - n2Rect.left,
        y: heroN2Rect.top  - n2Rect.top,
        scale: scaleN2,
        transformOrigin: 'top left',
        duration: 0.75, ease: 'power3.inOut'
      });
    })
  // 7 — at end of flight: show hero name, remove splash
    .to({}, {
      duration: 0.75,
      onComplete() {
        gsap.set(heroName, { opacity: 1 });
        splash.remove();
        document.body.classList.remove('splash-active');
        // Kick off rest of hero entrance (badge, typed, tagline, actions)
        heroEntranceAfterSplash();
      }
    });
})();

function heroEntranceAfterSplash() {
  gsap.set(['#hero-badge', '.hero-typed-wrap', '#hero-tagline', '#hero-actions', '#hero-scroll', '.hero-location'], { opacity: 0, y: 20 });
  gsap.set(['#hero-scroll', '.hero-location'], { y: 0 });
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl
    .to('#hero-badge',      { opacity: 1, y: 0, duration: 0.7 })
    .to('.hero-typed-wrap', { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
    .to('#hero-tagline',    { opacity: 1, y: 0, duration: 0.6 }, '-=0.45')
    .to('#hero-actions',    { opacity: 1, y: 0, duration: 0.6 }, '-=0.45')
    .to('#hero-scroll',     { opacity: 1, duration: 0.5 },       '-=0.3')
    .to('.hero-location',   { opacity: 1, duration: 0.5 },       '-=0.45');
}

/* ─── Smooth scroll (Lenis) ─────────────── */
const lenis = new Lenis({
  duration: 1.2,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  smoothWheel: true,
});
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Wire GSAP ScrollTrigger to Lenis
gsap.registerPlugin(ScrollTrigger);
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ─── Custom cursor ──────────────────────── */
const cursor = document.getElementById('cursor');
const cursorFollower = document.getElementById('cursor-follower');
let mouseX = 0, mouseY = 0;
let followerX = 0, followerY = 0;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursor.style.left = mouseX + 'px';
  cursor.style.top  = mouseY + 'px';
});

(function animateFollower() {
  followerX += (mouseX - followerX) * 0.1;
  followerY += (mouseY - followerY) * 0.1;
  cursorFollower.style.left = followerX + 'px';
  cursorFollower.style.top  = followerY + 'px';
  requestAnimationFrame(animateFollower);
})();

/* ─── Nav scroll state ───────────────────── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ─── Mobile menu ────────────────────────── */
const burger = document.getElementById('nav-burger');
const mobileMenu = document.getElementById('mobile-menu');
burger.addEventListener('click', () => {
  burger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
  document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    burger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  });
});

/* ─── Hero canvas — Constellation network ── */
(function initCanvas() {
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, nodes, mouse = { x: -9999, y: -9999 };

  const COUNT = 90;
  const MAX_DIST = 140;
  const MOUSE_DIST = 180;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function makeNode() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.6,
    };
  }
  nodes = Array.from({ length: COUNT }, makeNode);

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.x = -9999; mouse.y = -9999;
  });

  const RED = '255,51,77';
  const ORANGE = '255,140,66';

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Update
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;

      // Mouse repulsion
      const dx = n.x - mouse.x;
      const dy = n.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < MOUSE_DIST) {
        const force = (MOUSE_DIST - d) / MOUSE_DIST * 0.8;
        n.x += (dx / d) * force;
        n.y += (dy / d) * force;
      }
    });

    // Draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < MAX_DIST) {
          const alpha = (1 - d / MAX_DIST) * 0.35;
          const color = (i + j) % 3 === 0 ? ORANGE : RED;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${color},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    nodes.forEach((n, i) => {
      const dx = n.x - mouse.x;
      const dy = n.y - mouse.y;
      const md = Math.hypot(dx, dy);
      const nearMouse = md < MOUSE_DIST;
      const color = i % 3 === 0 ? ORANGE : RED;
      const alpha = nearMouse ? 0.9 : 0.5;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.fill();

      if (nearMouse) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},0.06)`;
        ctx.fill();
      }
    });

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ─── Typewriter ─────────────────────────── */
(function typewriter() {
  const el = document.getElementById('typed-text');
  const phrases = [
    'Full Stack Developer',
    'Technical Lead',
    'AI Systems Builder',
    'Blockchain Engineer',
    'Problem Solver',
  ];
  let pIdx = 0, cIdx = 0, deleting = false;
  const SPEED_TYPE = 80, SPEED_DEL = 40, PAUSE = 1800;

  function tick() {
    const phrase = phrases[pIdx];
    if (!deleting) {
      el.textContent = phrase.slice(0, cIdx + 1);
      cIdx++;
      if (cIdx === phrase.length) {
        deleting = true;
        setTimeout(tick, PAUSE);
        return;
      }
    } else {
      el.textContent = phrase.slice(0, cIdx - 1);
      cIdx--;
      if (cIdx === 0) {
        deleting = false;
        pIdx = (pIdx + 1) % phrases.length;
      }
    }
    setTimeout(tick, deleting ? SPEED_DEL : SPEED_TYPE);
  }
  setTimeout(tick, 1800);
})();

/* ─── Hero entrance — driven by heroEntranceAfterSplash() above ── */

/* ─── Section reveals (IntersectionObserver) */
(function setupReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        // Stagger siblings in same parent
        const siblings = [...e.target.parentElement.querySelectorAll('[data-reveal]:not(.revealed)')];
        const idx = siblings.indexOf(e.target);
        setTimeout(() => {
          e.target.classList.add('revealed');
        }, idx * 80);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
})();

/* ─── VanillaTilt ────────────────────────── */
(function initTilt() {
  const els = document.querySelectorAll('[data-tilt]');
  VanillaTilt.init(els, {
    max: 8,
    speed: 500,
    glare: false,
    'max-glare': 0.08,
    scale: 1.01,
  });
  // Override per-element options from data attrs
  els.forEach(el => {
    if (el.vanillaTilt) {
      const max = parseFloat(el.dataset.tiltMax);
      const speed = parseFloat(el.dataset.tiltSpeed);
      const glare = el.dataset.tiltGlare === 'true';
      const maxGlare = parseFloat(el.dataset.tiltMaxGlare) || 0;
      el.vanillaTilt.destroy();
      VanillaTilt.init(el, { max, speed, glare, 'max-glare': maxGlare, scale: 1.01 });
    }
  });
})();

/* ─── Path SVG draw animation ───────────── */
(function initPathDraw() {
  const track = document.getElementById('path-track');
  if (!track) return;

  // Get actual path length
  const len = track.getTotalLength();
  track.style.strokeDasharray = len;
  track.style.strokeDashoffset = len;

  ScrollTrigger.create({
    trigger: '#experience',
    start: 'top 70%',
    end: 'bottom 30%',
    scrub: 1.2,
    onUpdate: self => {
      const offset = len * (1 - self.progress);
      track.style.strokeDashoffset = offset;
    }
  });

  // Animate nodes as path reaches them
  const nodes = [
    { el: document.getElementById('node-freelance'), progress: 0.35 },
    { el: document.getElementById('node-yoovo'),     progress: 0.75 },
  ];
  const triggered = new Set();

  ScrollTrigger.create({
    trigger: '#experience',
    start: 'top 70%',
    end: 'bottom 30%',
    onUpdate: self => {
      nodes.forEach(({ el, progress }) => {
        if (self.progress >= progress && !triggered.has(el)) {
          triggered.add(el);
          const dot = el.querySelector('.path-node-dot');
          const ring = el.querySelector('.path-node-ring');
          gsap.fromTo(dot,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }
          );
          gsap.fromTo(ring,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out', delay: 0.1 }
          );
        }
      });
    }
  });
})();

/* ─── Skill pills stagger animation ─────── */
(function animateSkillPills() {
  document.querySelectorAll('.skill-block').forEach(block => {
    const pills = block.querySelectorAll('.skill-pills span');
    ScrollTrigger.create({
      trigger: block,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        gsap.fromTo(pills,
          { opacity: 0, y: 12, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.04, ease: 'power3.out' }
        );
      }
    });
  });
})();

/* ─── Nav active link highlight ─────────── */
(function navHighlight() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a');

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => io.observe(s));
})();

/* ─── Glowing card effect on hover ──────── */
document.querySelectorAll('.proj-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const glow = card.querySelector('.proj-glow');
    if (glow) {
      glow.style.left = (x - 100) + 'px';
      glow.style.top  = (y - 100) + 'px';
    }
  });
});

/* ─── Smooth anchor scroll ───────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    }
  });
});

/* ─── Nav active style ───────────────────── */
const navStyle = document.createElement('style');
navStyle.textContent = `.nav-links a.active { color: #fff; }`;
document.head.appendChild(navStyle);

/* ─── Parallax hero content ──────────────── */
window.addEventListener('scroll', () => {
  const hero = document.getElementById('hero');
  const heroContent = hero.querySelector('.hero-content');
  const scrollY = window.scrollY;
  if (scrollY < hero.offsetHeight) {
    heroContent.style.transform = `translateY(${scrollY * 0.18}px)`;
    heroContent.style.opacity = 1 - scrollY / (hero.offsetHeight * 0.7);
  }
}, { passive: true });

/* ─── Stats counter animation ────────────── */
(function animateCounters() {
  const stats = [
    { el: document.querySelector('.stat-card:nth-child(1) .stat-num'), target: 3, suffix: '+' },
    { el: document.querySelector('.stat-card:nth-child(2) .stat-num'), target: 15, suffix: '+' },
    { el: document.querySelector('.stat-card:nth-child(3) .stat-num'), target: 10, suffix: '+' },
  ];

  stats.forEach(({ el, target, suffix }) => {
    if (!el) return;
    let triggered = false;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !triggered) {
        triggered = true;
        let count = 0;
        const step = Math.ceil(target / 40);
        const timer = setInterval(() => {
          count = Math.min(count + step, target);
          el.innerHTML = count + `<span>${suffix}</span>`;
          if (count >= target) clearInterval(timer);
        }, 30);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el.closest('.stat-card'));
  });
})();
