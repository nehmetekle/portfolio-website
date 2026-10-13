/* ════════════════════════════════════════
   PNT.OS life — desktop pet, widgets, notifications,
   achievements and screensaver.
   Listens to events fired by world.js:
     pnt:ready  desktop is shown after login
     pnt:open   { id }   an app was opened
     pnt:cmd    { name } a terminal command ran
════════════════════════════════════════ */
const LIFE = (() => {
  const desktop = document.getElementById('desktop');
  const isSmall = () => window.matchMedia('(max-width: 720px)').matches;
  const pick = list => list[(Math.random() * list.length) | 0];

  /* ─── Notifications ────────────────────── */
  const toastBox = document.createElement('div');
  toastBox.className = 'toasts';
  toastBox.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastBox);

  function toast(icon, title, text, { onClick, ms = 5500 } = {}) {
    const el = document.createElement(onClick ? 'button' : 'div');
    el.className = 'toast';
    if (onClick) el.type = 'button';
    el.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><span class="toast-text"><b>${title}</b><span>${text}</span></span>`;
    toastBox.appendChild(el);
    FX.sfx.notify();

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    };
    el.addEventListener('click', () => { onClick?.(); dismiss(); });
    setTimeout(dismiss, ms);
  }

  /* ─── Achievements (remembered across visits) ── */
  const ACHIEVEMENTS = {
    explorer:  ['🧭', 'Explorer',      'opened 4 different windows'],
    networker: ['🤝', 'Networker',     'found the contact card'],
    recruiter: ['📄', 'Recruiter mode', 'grabbed the CV'],
    neo:       ['🐇', 'Neo',           'entered the matrix'],
    hacker:    ['🕶️', 'Script kiddie', 'tried to hack Paul'],
    friend:    ['🤖', 'Best friends',  'Byte likes you now'],
  };
  const TOTAL = Object.keys(ACHIEVEMENTS).length;
  const unlocked = new Set(JSON.parse(localStorage.getItem('pnt-achievements') || '[]'));

  function unlock(key) {
    if (unlocked.has(key)) return;
    unlocked.add(key);
    localStorage.setItem('pnt-achievements', JSON.stringify([...unlocked]));
    const [icon, name, desc] = ACHIEVEMENTS[key];
    toast(icon, `Achievement unlocked: ${name}`, `${desc} · ${unlocked.size}/${TOTAL}`);
  }

  // Terminal listing, used by the `achievements` command in world.js
  function achievementsReport() {
    const rows = Object.entries(ACHIEVEMENTS).map(([key, [icon, name, desc]]) =>
      unlocked.has(key)
        ? `  <span class="ok">✔</span> ${icon} ${name} <span class="muted">— ${desc}</span>`
        : `  <span class="muted">○ ??? — keep exploring</span>`
    );
    return [`achievements: <span class="warn">${unlocked.size}/${TOTAL}</span>`, ...rows].join('\n');
  }

  /* ─── Widgets ──────────────────────────── */
  // What Paul is "probably" doing, by the hour in Paris
  const ROUTINE = [
    [0,  '😴 Paul is asleep — probably dreaming in TypeScript'],
    [7,  '☕ Paul is making coffee'],
    [9,  '💻 Paul is shipping features'],
    [12, '🍝 Paul is at lunch'],
    [14, '🤖 Paul is building AI agents'],
    [18, '📚 Paul is studying for his Master\'s'],
    [20, '🌙 Paul is hacking on side projects'],
  ];

  function updateWidgets() {
    const now = new Date();
    const hour = +now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Paris' });
    const greet = hour < 5 ? 'Up late? 🌙' : hour < 12 ? 'Good morning ☀️' : hour < 18 ? 'Good afternoon 👋' : 'Good evening 🌆';
    document.getElementById('w-greet').textContent = `${greet}, visitor`;
    document.getElementById('w-time').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    document.getElementById('w-date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }) + ' · Paris';
    document.getElementById('w-status').textContent = ROUTINE.filter(([h]) => hour >= h).pop()[1];
  }

  /* ─── Byte, the desktop robot ──────────── */
  const SPRITE = `
    <svg class="pet-sprite" viewBox="0 0 16 16" width="56" height="56" shape-rendering="crispEdges" aria-hidden="true">
      <rect class="p-led" x="7" y="0" width="2" height="2" fill="#ff334d"/>
      <rect x="7" y="2" width="2" height="1" fill="#6b7799"/>
      <rect x="2" y="5" width="1" height="3" fill="#aab3c8"/>
      <rect x="13" y="5" width="1" height="3" fill="#aab3c8"/>
      <rect x="3" y="3" width="10" height="7" fill="#dde3ef"/>
      <rect x="4" y="4" width="8" height="5" fill="#0c1020"/>
      <g class="p-eyes"><rect x="5" y="5" width="2" height="2" fill="#4ade80"/><rect x="9" y="5" width="2" height="2" fill="#4ade80"/></g>
      <rect class="p-mouth" x="6" y="8" width="4" height="1" fill="#4ade80" opacity="0.6"/>
      <rect class="p-arm-l" x="2" y="10" width="2" height="3" fill="#aab3c8"/>
      <rect class="p-arm-r" x="12" y="10" width="2" height="3" fill="#aab3c8"/>
      <rect x="4" y="10" width="8" height="4" fill="#ff334d"/>
      <rect class="p-core" x="7" y="11" width="2" height="2" fill="#ff8c42"/>
      <rect class="p-leg-l" x="5" y="14" width="2" height="2" fill="#6b7799"/>
      <rect class="p-leg-r" x="9" y="14" width="2" height="2" fill="#6b7799"/>
    </svg>`;

  const CLICK_LINES = [
    'Hi! I\'m Byte, Paul\'s desktop robot 🤖',
    'Paul built me between two deploys.',
    'psst… type <code>matrix</code> in the terminal',
    'I run on coffee and Agentic AI ☕',
    'Paul is open to work — tell your recruiter friends!',
    'Beep boop. That tickles.',
    'Try <code>hack</code> in the terminal. I dare you.',
    'Have you found all the achievements? Type <code>achievements</code>',
  ];
  const IDLE_LINES = [
    'la la la… 🎵',
    'I wonder what\'s in projects/ 👀',
    '*beep*',
    'Paul pushed code today. Probably.',
    'Double-click an icon, I won\'t tell anyone.',
  ];
  const OPEN_LINES = {
    about:     'That\'s Paul! He\'s cool, I promise.',
    career:    'YOOVO → where the AI magic happens ✨',
    projects:  'The crypto one is my favourite 🚗💰',
    skills:    'So many skills. I only know "beep".',
    education: 'Master\'s at Éstiam — Paul never stops learning 🎓',
    contact:   'Yes! Say hi to Paul 👋',
    cv:        'A recruiter?! Quick, everybody look professional!',
    terminal:  'Type <code>help</code> if you get lost!',
  };

  const pet = {
    el: null, sprite: null, bubble: null,
    x: 0, dir: 1, target: 0, state: 'idle', until: 0, clicks: 0, bubbleTimer: 0,

    spawn() {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pet';
      el.setAttribute('aria-label', 'Byte, the desktop robot — click to say hi');
      el.innerHTML = `<span class="pet-bubble" hidden></span>${SPRITE}<span class="pet-zzz" aria-hidden="true">z<i>z</i><i>z</i></span>`;
      desktop.appendChild(el);
      this.el = el;
      this.sprite = el.querySelector('.pet-sprite');
      this.bubble = el.querySelector('.pet-bubble');
      this.x = this.minX();
      el.addEventListener('click', () => this.poke());
      this.setState('walk');
      requestAnimationFrame(t => this.loop(t, t));
      setTimeout(() => this.say('Oh hi! 👋 Welcome to Paul\'s desktop'), 1200);
    },

    minX() { return isSmall() ? 8 : 120; },
    maxX() { return desktop.clientWidth - 68; },

    setState(state, ms = 0) {
      this.state = state;
      this.until = performance.now() + ms;
      this.el.classList.toggle('walking', state === 'walk');
      this.el.classList.toggle('sleeping', state === 'sleep');
      if (state === 'walk') {
        this.target = this.minX() + Math.random() * (this.maxX() - this.minX());
        this.dir = this.target > this.x ? 1 : -1;
      }
    },

    loop(now, last) {
      const dt = Math.min(0.05, (now - last) / 1000);
      if (this.state === 'walk') {
        this.x += this.dir * 46 * dt;
        if ((this.dir > 0 && this.x >= this.target) || (this.dir < 0 && this.x <= this.target)) {
          this.setState('idle', 2500 + Math.random() * 4000);
          if (Math.random() < 0.3) this.say(pick(IDLE_LINES));
        }
      } else if (this.state === 'idle' && now > this.until) {
        this.setState('walk');
      }
      this.x = Math.max(this.minX(), Math.min(this.maxX(), this.x));
      this.el.style.transform = `translateX(${this.x}px)`;
      this.sprite.style.transform = `scaleX(${this.dir})`;
      requestAnimationFrame(t => this.loop(t, now));
    },

    say(html, ms = 3800) {
      clearTimeout(this.bubbleTimer);
      this.bubble.innerHTML = html;
      this.bubble.hidden = false;
      // Keep the bubble on screen near the right edge
      this.bubble.classList.toggle('left', this.x > desktop.clientWidth - 260);
      this.bubbleTimer = setTimeout(() => (this.bubble.hidden = true), ms);
    },

    poke() {
      if (this.state === 'sleep') { this.wake(); return; }
      FX.sfx.chirp();
      this.el.classList.remove('jump');
      void this.el.offsetWidth;   // restart the jump animation
      this.el.classList.add('jump');
      this.say(pick(CLICK_LINES));
      this.setState('idle', 3000);
      if (++this.clicks === 5) unlock('friend');
    },

    sleep() {
      if (this.state === 'sleep') return;
      this.setState('sleep');
      this.bubble.hidden = true;
    },

    wake() {
      if (this.state !== 'sleep') return;
      FX.sfx.chirp();
      this.say('Huh?! I wasn\'t sleeping! 😳', 2500);
      this.setState('idle', 2500);
    },

    react(id) {
      if (OPEN_LINES[id] && this.state !== 'sleep') this.say(OPEN_LINES[id]);
    },
  };

  /* ─── Screensaver + idle ───────────────── */
  const SLEEP_AFTER = 25_000, SAVER_AFTER = 70_000;
  let lastInput = Date.now(), saver = null;

  function startSaver() {
    if (saver || FX.reduceMotion) return;
    saver = document.createElement('div');
    saver.className = 'screensaver';
    saver.innerHTML = '<span class="saver-logo">PNT<i>.</i></span><span class="saver-hint">move the mouse to wake up</span>';
    desktop.appendChild(saver);
    const logo = saver.querySelector('.saver-logo');
    const colors = ['#ff334d', '#ff8c42', '#4ade80', '#a78bfa', '#38bdf8'];
    let x = 80, y = 80, vx = 1.6, vy = 1.3, ci = 0;
    (function bounce() {
      if (!saver) return;
      const maxX = saver.clientWidth - logo.offsetWidth, maxY = saver.clientHeight - logo.offsetHeight;
      x += vx; y += vy;
      if (x <= 0 || x >= maxX) { vx *= -1; ci++; }
      if (y <= 0 || y >= maxY) { vy *= -1; ci++; }
      x = Math.max(0, Math.min(maxX, x));
      y = Math.max(0, Math.min(maxY, y));
      logo.style.transform = `translate(${x}px, ${y}px)`;
      logo.style.setProperty('--dot', colors[ci % colors.length]);
      requestAnimationFrame(bounce);
    })();
  }

  function onInput() {
    lastInput = Date.now();
    if (saver) {
      saver.remove();
      saver = null;
    }
    if (pet.el) pet.wake();
  }

  /* ─── Start once the desktop is shown ──── */
  function start() {
    document.body.classList.add('alive');
    updateWidgets();
    setInterval(updateWidgets, 15_000);
    pet.spawn();

    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(type =>
      document.addEventListener(type, onInput, { passive: true })
    );
    setInterval(() => {
      const idle = Date.now() - lastInput;
      if (idle > SLEEP_AFTER) pet.sleep();
      if (idle > SAVER_AFTER) startSaver();
    }, 1000);

    setTimeout(() => toast('👋', 'Paul', 'Thanks for stopping by! Everything here is clickable — even the robot.'), 2600);
    setTimeout(() => {
      if (!opened.has('contact')) {
        toast('💼', 'Paul is open to work', 'Click here to see how to reach him →', { onClick: () => openApp('contact'), ms: 8000 });
      }
    }, 40_000);
  }

  const opened = new Set();
  document.addEventListener('pnt:ready', start, { once: true });
  document.addEventListener('pnt:open', e => {
    const { id } = e.detail;
    opened.add(id);
    if (id === 'contact') unlock('networker');
    if (id === 'cv') unlock('recruiter');
    if (opened.size >= 4) unlock('explorer');
    if (pet.el) pet.react(id);
  });
  document.addEventListener('pnt:cmd', e => {
    if (e.detail.name === 'matrix') unlock('neo');
    if (e.detail.name === 'hack') unlock('hacker');
  });

  return { toast, achievementsReport };
})();
