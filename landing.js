/* ════════════════════════════════════════
   PNT.OS LANDING — boot sequence
════════════════════════════════════════ */
(function boot() {
  const screen   = document.getElementById('boot');
  const log      = document.getElementById('boot-log');
  const progress = document.getElementById('boot-progress');
  const skipBtn  = document.getElementById('boot-skip');

  const LINES = [
    ['hi',   'PNT.OS v1.0 — (c) 2026 Paul Nehme Tekle'],
    ['',     ''],
    ['ok',   '[  OK  ] Mounting /home/paul'],
    ['ok',   '[  OK  ] Loading modules: angular react dotnet python'],
    ['ok',   '[  OK  ] Starting agentic-ai.service'],
    ['ok',   '[  OK  ] Restoring career/ (2023 — present)'],
    ['warn', '[ INFO ] Locating user… Paris, FR'],
    ['ok',   '[  OK  ] Reached target: portfolio.target'],
    ['',     ''],
    ['',     'loading environment & portfolio data…'],
  ];
  const STEP_MS = 190;

  let finished = false;
  const timers = [];

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    sessionStorage.setItem('pnt-booted', '1');
    screen.classList.add('done');
    document.body.classList.add('booted');
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') finish();
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sessionStorage.getItem('pnt-booted') || reduceMotion) {
    screen.style.display = 'none';
    finish();
    return;
  }

  skipBtn.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);

  LINES.forEach(([cls, text], i) => {
    timers.push(setTimeout(() => {
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text || ' ';
      log.appendChild(line);
      progress.style.width = `${((i + 1) / LINES.length) * 100}%`;
    }, i * STEP_MS));
  });

  const end = LINES.length * STEP_MS;
  timers.push(setTimeout(() => {
    const ready = document.createElement('div');
    ready.className = 'hi';
    ready.innerHTML = 'SYSTEM READY <span class="boot-caret"></span>';
    log.appendChild(ready);
  }, end + 150));
  timers.push(setTimeout(finish, end + 900));
})();

/* ─── "Enter world": dive into the monitor ── */
(function enterWorld() {
  const card = document.querySelector('.env-card');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('a[href="world.html"]').forEach(link => {
    link.addEventListener('click', e => {
      if (reduceMotion || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();

      // Grow from the preview card, or from the centre if it's scrolled out of view
      let r = card.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) {
        r = { left: innerWidth * 0.3, top: innerHeight * 0.35, width: innerWidth * 0.4, height: innerHeight * 0.3 };
      }
      const screen = document.createElement('div');
      screen.className = 'enter-screen';
      screen.innerHTML = '<span>connecting to paul@pnt<span class="boot-caret"></span></span>';
      Object.assign(screen.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      document.body.appendChild(screen);
      document.body.classList.add('entering');

      requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('full')));
      setTimeout(() => (location.href = link.href), 1150);
    });
  });

  // Coming back with the browser's Back button restores the page as it was left
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    document.querySelector('.enter-screen')?.remove();
    document.body.classList.remove('entering');
  });
})();
