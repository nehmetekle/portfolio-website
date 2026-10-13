/* ════════════════════════════════════════
   PNT.OS — window manager + terminal
════════════════════════════════════════ */

const CV_URL = 'uploads/Paul%20Nehme%20Tekle%20-%20CV.pdf';

// Desktop apps. `tpl` points at a <template> in index.html; `href` opens a link instead of a window.
const APPS = {
  readme:    { title: 'welcome.md',  glyph: '✦',  tpl: 'tpl-readme',    w: 440, h: 400 },
  about:     { title: 'about.txt',   glyph: '▣',  tpl: 'tpl-about',     w: 540, h: 520 },
  career:    { title: 'career/',     glyph: '▤',  tpl: 'tpl-career',    w: 620, h: 580 },
  projects:  { title: 'projects/',   glyph: '◆',  tpl: 'tpl-projects',  w: 620, h: 580 },
  skills:    { title: 'skills.sh',   glyph: '❯',  tpl: 'tpl-skills',    w: 580, h: 540 },
  education: { title: 'education/',  glyph: '◎',  tpl: 'tpl-education', w: 480, h: 320 },
  contact:   { title: 'contact.app', glyph: '✉',  tpl: 'tpl-contact',   w: 500, h: 500 },
  terminal:  { title: 'terminal',    glyph: '>_', w: 580, h: 600 },
  cv:        { title: 'CV.pdf',      glyph: '⇩',  href: CV_URL },
};

const desktop     = document.getElementById('desktop');
const iconList    = document.getElementById('desktop-icons');
const taskbarWins = document.getElementById('taskbar-windows');
const isSmall     = () => window.matchMedia('(max-width: 720px)').matches;
const isTouch     = window.matchMedia('(pointer: coarse)').matches;

const windows = new Map();   // appId -> { el, taskBtn }
let zTop = 10;
let cascade = 0;

/* ─── Clock ──────────────────────────────── */
(function clock() {
  const el = document.getElementById('clock');
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  };
  tick();
  setInterval(tick, 10_000);
})();

/* ─── Desktop icons ──────────────────────── */
Object.entries(APPS).forEach(([id, app]) => {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'desk-icon';
  btn.dataset.app = id;
  btn.innerHTML = `<span class="desk-glyph" aria-hidden="true">${app.glyph}</span><span>${app.title}</span>`;

  // Mouse: click selects, double-click opens. Touch & keyboard (detail 0): open right away.
  btn.addEventListener('click', e => {
    iconList.querySelectorAll('.desk-icon').forEach(b => b.classList.toggle('selected', b === btn));
    if (isTouch || e.detail === 0) openApp(id, btn);
  });
  btn.addEventListener('dblclick', () => openApp(id, btn));

  li.appendChild(btn);
  iconList.appendChild(li);
});

desktop.addEventListener('pointerdown', e => {
  if (e.target === desktop) iconList.querySelectorAll('.selected').forEach(b => b.classList.remove('selected'));
});

/* ─── Window manager ─────────────────────── */
// Animate a window between its own box and another element (icon, taskbar button)
function morph(win, otherEl, reverse = false) {
  if (FX.reduceMotion || !otherEl) return null;
  const a = otherEl.getBoundingClientRect(), b = win.getBoundingClientRect();
  if (!a.width || !b.width) return null;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const away = { transform: `translate(${dx}px, ${dy}px) scale(${Math.max(0.06, a.width / b.width)})`, opacity: 0 };
  const home = { transform: 'none', opacity: 1 };
  return win.animate(reverse ? [home, away] : [away, home], {
    duration: reverse ? 300 : 440,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  });
}

// `origin` is the element the window should grow out of (optional)
function openApp(id, origin) {
  const app = APPS[id];
  if (!app) return false;
  document.dispatchEvent(new CustomEvent('pnt:open', { detail: { id } }));
  if (app.href) { window.open(app.href, '_blank', 'noopener'); return true; }

  const existing = windows.get(id);
  if (existing) { restore(id); return true; }
  FX.sfx.open();

  const win = document.createElement('section');
  win.className = 'win';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', app.title);
  win.innerHTML = `
    <header class="win-bar">
      <span class="win-title"><b aria-hidden="true">${app.glyph}</b>${app.title}</span>
      <div class="win-ctrls">
        <button type="button" data-act="min" aria-label="Minimize">–</button>
        <button type="button" data-act="max" aria-label="Maximize">□</button>
        <button type="button" data-act="close" aria-label="Close">×</button>
      </div>
    </header>
    <div class="win-body"></div>`;

  const body = win.querySelector('.win-body');
  if (id === 'terminal') body.appendChild(createTerminal());
  else body.appendChild(document.getElementById(app.tpl).content.cloneNode(true));

  // Size + cascade position, kept inside the desktop
  const dw = desktop.clientWidth, dh = desktop.clientHeight;
  const w = Math.min(app.w, dw - 16);
  const h = Math.min(app.h, dh - 16);
  const iconsRight = isSmall() ? 0 : iconList.offsetLeft + iconList.offsetWidth;
  const left = Math.min(iconsRight + 24 + cascade * 32, Math.max(8, dw - w - 8));
  const top  = Math.min(20 + cascade * 28,  Math.max(8, dh - h - 8));
  cascade = (cascade + 1) % 8;
  Object.assign(win.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });

  win.addEventListener('pointerdown', () => focusWin(id));
  win.querySelector('.win-ctrls').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'close') closeWin(id);
    if (act === 'min') minimize(id);
    if (act === 'max') win.classList.toggle('maximized');
  });
  win.querySelector('.win-bar').addEventListener('dblclick', e => {
    if (!e.target.closest('button') && !isSmall()) win.classList.toggle('maximized');
  });
  makeDraggable(win);

  win.querySelector('.copy-email')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    navigator.clipboard?.writeText(btn.dataset.email).then(() => {
      btn.textContent = 'Copied ✓';
      setTimeout(() => (btn.textContent = 'Copy email'), 1800);
    });
  });

  const taskBtn = document.createElement('button');
  taskBtn.type = 'button';
  taskBtn.className = 'task-btn';
  taskBtn.textContent = app.title;
  taskBtn.addEventListener('click', () => {
    const isFront = win.classList.contains('focused') && !win.classList.contains('minimized');
    isFront ? minimize(id) : restore(id);
  });
  taskbarWins.appendChild(taskBtn);

  desktop.appendChild(win);
  windows.set(id, { el: win, taskBtn });
  if (origin) {
    win.classList.add('no-pop');
    morph(win, origin);
  }
  focusWin(id);
  return true;
}

function focusWin(id) {
  windows.forEach(({ el, taskBtn }, key) => {
    const on = key === id;
    el.classList.toggle('focused', on);
    taskBtn.classList.toggle('active', on);
  });
  const w = windows.get(id);
  if (!w) return;
  w.el.style.zIndex = ++zTop;
  w.el.querySelector('.term-input')?.focus({ preventScroll: true });
}

function restore(id) {
  const w = windows.get(id);
  if (w.el.classList.contains('minimized')) {
    w.el.classList.remove('minimized');
    w.taskBtn.classList.remove('min');
    morph(w.el, w.taskBtn);
  }
  focusWin(id);
}

function minimize(id) {
  const w = windows.get(id);
  w.el.classList.remove('focused');
  w.taskBtn.classList.add('min');
  w.taskBtn.classList.remove('active');
  const hide = () => w.el.classList.add('minimized');
  const anim = morph(w.el, w.taskBtn, true);
  anim ? (anim.onfinish = hide) : hide();
  focusTopmost(id);
}

function closeWin(id) {
  const w = windows.get(id);
  if (!w) return;
  FX.sfx.close();
  windows.delete(id);
  w.taskBtn.remove();
  const anim = FX.reduceMotion ? null : w.el.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.94)' }],
    { duration: 170, easing: 'ease-in' }
  );
  anim ? (anim.onfinish = () => w.el.remove()) : w.el.remove();
  focusTopmost();
}

// `except` skips a window that is mid-minimize and not hidden yet
function focusTopmost(except) {
  let best = null, bestZ = -1;
  windows.forEach(({ el }, key) => {
    const z = +el.style.zIndex || 0;
    if (key !== except && !el.classList.contains('minimized') && z > bestZ) { best = key; bestZ = z; }
  });
  if (best) focusWin(best);
}

function makeDraggable(win) {
  const bar = win.querySelector('.win-bar');
  let startX, startY, origX, origY;

  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button') || isSmall() || win.classList.contains('maximized')) return;
    startX = e.clientX; startY = e.clientY;
    origX = win.offsetLeft; origY = win.offsetTop;
    bar.setPointerCapture(e.pointerId);
    win.classList.add('dragging');
  });
  bar.addEventListener('pointermove', e => {
    if (!win.classList.contains('dragging')) return;
    // Keep at least part of the title bar on screen so the window can be grabbed again
    const maxX = desktop.clientWidth - 80;
    const maxY = desktop.clientHeight - 38;
    win.style.left = `${Math.max(80 - win.offsetWidth, Math.min(maxX, origX + e.clientX - startX))}px`;
    win.style.top  = `${Math.max(0, Math.min(maxY, origY + e.clientY - startY))}px`;
  });
  const stop = () => win.classList.remove('dragging');
  bar.addEventListener('pointerup', stop);
  bar.addEventListener('pointercancel', stop);
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const focused = [...windows].find(([, w]) => w.el.classList.contains('focused'));
  if (focused) closeWin(focused[0]);
});

document.getElementById('taskbar-start').addEventListener('click', () => openApp('terminal'));

/* ─── Terminal ───────────────────────────── */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const OPENABLE = Object.fromEntries(
  Object.entries(APPS).flatMap(([id, app]) => [[id, id], [app.title.replace(/\/$/, ''), id]])
);

// [what you type, what it runs when clicked, description]
const HELP = [
  ['whoami',      'whoami',        'who is paul?'],
  ['about',       'about',         'open about.txt'],
  ['career',      'career',        'open career/'],
  ['projects',    'projects',      'open projects/'],
  ['skills',      'skills',        'run skills.sh'],
  ['education',   'education',     'open education/'],
  ['contact',     'contact',       'open contact.app'],
  ['cv',          'cv',            'download my CV'],
  ['ls',          'ls',            'list desktop files'],
  ['open <file>', 'open projects', 'open any desktop file'],
  ['neofetch',    'neofetch',      'system info'],
  ['history',     'history',       'commands you ran'],
  ['achievements', 'achievements', 'your progress (9 to find)'],
  ['weather',     'weather',       'live weather in Paris'],
  ['bugs',        'bugs',          'how many bugs got fixed'],
  ['byte',        'byte',          'call Byte over'],
  ['matrix',      'matrix',        'follow the white rabbit'],
  ['hack',        'hack',          'don\'t.'],
  ['clear',       'clear',         'clear the screen'],
  ['exit',        'exit',          'log out and reboot'],
];
// Shortcut buttons pinned to the top of the terminal
const QUICK_CMDS = ['help', 'whoami', 'about', 'career', 'projects', 'skills', 'contact', 'neofetch', 'matrix', 'clear'];

const runButton = (label, cmd) =>
  `<button type="button" class="term-run" data-cmd="${cmd}">${escapeHtml(label)}</button>`;

const COMMANDS = {
  help: () => [
    'available commands <span class="muted">(click one, or type it)</span>:',
    ...HELP.map(([label, cmd, desc]) => `  ${runButton(label, cmd)}${' '.repeat(14 - label.length)}<span class="muted">${desc}</span>`),
    '',
    '<span class="muted">tips: ↑/↓ for history · Tab to autocomplete · Esc closes a window</span>',
  ].join('\n'),

  whoami: () => 'Paul Nehme Tekle — Full Stack Developer · Agentic AI\nParis, France · currently at YOOVO + Master\'s at Éstiam\n<span class="muted">type `about` for the long version</span>',

  ls: () => Object.values(APPS).map(a => a.title).join('    '),

  neofetch: () => [
    '<span class="err">   ██████  </span>  <span class="warn">paul</span>@<span class="warn">pnt</span>',
    '<span class="err">   ██   ██ </span>  ──────────────',
    '<span class="err">   ██████  </span>  <span class="warn">OS</span>:      PNT.OS v1.0',
    '<span class="err">   ██      </span>  <span class="warn">Host</span>:    Paris, FR',
    '<span class="err">   ██      </span>  <span class="warn">Uptime</span>:  3+ years in production',
    '             <span class="warn">Shell</span>:   TypeScript / C# / Python',
    '             <span class="warn">Stack</span>:   Angular · React · .NET · AWS',
    '             <span class="warn">Focus</span>:   Agentic AI',
  ].join('\n'),

  date: () => new Date().toLocaleString('en-GB', { timeZone: 'Europe/Paris' }) + ' (Paris)',

  cv: () => { window.open(CV_URL, '_blank', 'noopener'); return `opening <a href="${CV_URL}" target="_blank" rel="noopener">CV.pdf</a>…`; },

  sudo: () => '<span class="err">paul is not in the sudoers file.</span> But he is open to new roles → try `contact`',

  exit: () => { setTimeout(logout, 400); return 'logging out…'; },

  achievements: () => LIFE.achievementsReport(),
  weather: () => FRIENDS.weatherReport(),
  bugs: () => FRIENDS.bugsReport(),
  byte: () => { LIFE.pet.poke(); return '<span class="muted">Byte: beep boop! 🤖</span>'; },

  matrix: () => { FX.matrix(desktop); return '<span class="muted">wake up, visitor… (click to exit)</span>'; },

  hack: (args, print) => {
    const steps = [
      ['warn', 'bypassing firewall…'],
      ['warn', 'decrypting /home/paul/secrets…'],
      ['ok',   '[██████████] 100%'],
      ['err',  'ACCESS DENIED'],
      ['',     'nice try 😄 — no need to hack in, just type <span class="warn">contact</span>'],
    ];
    steps.forEach(([cls, text], i) => setTimeout(() => {
      if (cls === 'err') FX.sfx.error(); else FX.sfx.tick();
      print(cls ? `<span class="${cls}">${text}</span>` : text);
    }, 450 * (i + 1)));
    return '<span class="muted">initiating hack.exe…</span>';
  },
};
['about', 'career', 'projects', 'skills', 'education', 'contact'].forEach(id => {
  COMMANDS[id] = () => { openApp(id); return `<span class="muted">opened ${APPS[id].title}</span>`; };
});
Object.assign(COMMANDS, {
  experience: COMMANDS.career, work: COMMANDS.career, hire: COMMANDS.contact,
  logout: COMMANDS.exit, reboot: COMMANDS.exit, '?': COMMANDS.help,
});

function createTerminal() {
  const term = document.createElement('div');
  term.className = 'term';
  term.innerHTML = `
    <div class="term-cmds" aria-label="Quick commands">${QUICK_CMDS.map(c => runButton(c, c)).join('')}</div>
    <div class="term-out"><span class="muted">PNT.OS terminal v1.0 — logged in as visitor</span>\n</div>
    <label class="term-line"><span class="prompt">paul@pnt:~$</span><input class="term-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal input" /></label>`;

  const out = term.querySelector('.term-out');
  const input = term.querySelector('.term-input');
  const history = [];
  let hIdx = 0;

  const print = html => {
    out.insertAdjacentHTML('beforeend', html + '\n');
    if (term.parentElement) term.parentElement.scrollTop = term.parentElement.scrollHeight;
  };

  function run(raw) {
    const line = raw.trim();
    print(`<span class="prompt">paul@pnt:~$</span>${escapeHtml(raw)}`);
    if (!line) return;
    history.push(line);
    hIdx = history.length;

    const [cmd, ...args] = line.split(/\s+/);
    const name = cmd.toLowerCase();
    document.dispatchEvent(new CustomEvent('pnt:cmd', { detail: { name } }));

    if (name === 'clear') { out.innerHTML = ''; return; }
    if (name === 'echo') { print(escapeHtml(args.join(' '))); return; }
    if (name === 'history') { print(history.map((h, i) => `  ${i + 1}  ${escapeHtml(h)}`).join('\n')); return; }
    if (name === 'open' || name === 'cat' || name === 'cd') {
      const target = OPENABLE[(args[0] || '').toLowerCase().replace(/\/$/, '')];
      if (target && openApp(target)) print(`<span class="muted">opened ${APPS[target].title}</span>`);
      else print(`<span class="err">${name}: ${escapeHtml(args[0] || '')}: no such file</span> — try \`ls\``);
      return;
    }
    if (name === './skills.sh') { print(COMMANDS.skills()); return; }

    const fn = COMMANDS[name];
    if (!fn) FX.sfx.error();
    print(fn ? fn(args, print) : `<span class="err">command not found: ${escapeHtml(cmd)}</span> — type \`help\``);
  }

  input.addEventListener('keydown', e => {
    if (e.key.length === 1 || e.key === 'Backspace') FX.sfx.key();
    if (e.key === 'Enter') {
      run(input.value);
      input.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIdx > 0) input.value = history[--hIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hIdx = Math.min(history.length, hIdx + 1);
      input.value = history[hIdx] || '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const matches = Object.keys(COMMANDS).filter(c => c.startsWith(input.value.toLowerCase()));
      if (matches.length === 1) input.value = matches[0] + ' ';
      else if (matches.length > 1) print(matches.join('  '));
    }
  });
  term.addEventListener('click', e => {
    const btn = e.target.closest('.term-run');
    if (btn) run(btn.dataset.cmd);
    if (!window.getSelection().toString()) input.focus({ preventScroll: true });
  });

  // Show the command list as soon as the terminal opens, scrolled to its start
  setTimeout(() => {
    run('help');
    term.parentElement.scrollTop = 0;
  });

  return term;
}

/* ─── Buttons that open apps, log out, deep links ── */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-open]');
  if (btn) openApp(btn.dataset.open, btn);
});

function logout() {
  sessionStorage.removeItem('pnt-logged-in');
  location.href = location.pathname;
}
document.getElementById('logout').addEventListener('click', logout);

// Old section links (/#projects, /#experience…) open the matching window
const HASH_APPS = { about: 'about', experience: 'career', career: 'career', skills: 'skills', projects: 'projects', education: 'education', contact: 'contact' };
function openFromHash() {
  const id = HASH_APPS[location.hash.slice(1).toLowerCase()];
  if (id) openApp(id);
  return Boolean(id);
}
window.addEventListener('hashchange', openFromHash);

/* ─── Power on → boot log → login → desktop ── */
function openStartupWindows() {
  document.dispatchEvent(new CustomEvent('pnt:ready'));
  if (!isSmall()) {
    openApp('terminal');
    const term = windows.get('terminal').el;
    // Sit just left of the desktop widgets when they're showing
    const widgets = document.getElementById('widgets');
    const rightEdge = widgets.offsetParent ? widgets.offsetLeft - 24 : desktop.clientWidth - 40;
    term.style.left = `${Math.max(8, rightEdge - term.offsetWidth)}px`;
    term.style.top  = `${Math.max(8, desktop.clientHeight - term.offsetHeight - 40)}px`;
  }
  // Small delays so the windows pop in one after the other
  setTimeout(() => {
    openApp('readme');
    setTimeout(openFromHash, 260);
  }, isSmall() ? 0 : 260);
}

/* ─── Live wallpaper + sound toggle ─────── */
if (!FX.wallpaper(document.getElementById('wallpaper'))) {
  document.getElementById('wallpaper').remove();
}

(function soundToggle() {
  const btn = document.getElementById('sound-toggle');
  const render = () => {
    btn.textContent = FX.isMuted() ? '♪ muted' : '♪ sound';
    btn.setAttribute('aria-pressed', String(!FX.isMuted()));
  };
  btn.addEventListener('click', () => {
    FX.setMuted(!FX.isMuted());
    render();
    FX.sfx.open();
  });
  render();
})();

(function powerOn() {
  const power     = document.getElementById('power');
  const gate      = document.getElementById('power-gate');
  const powerBtn  = document.getElementById('power-btn');
  const bootStage = document.getElementById('boot-stage');
  const bootLog   = document.getElementById('boot-log');
  const progress  = document.getElementById('boot-progress');
  const login     = document.getElementById('login');
  const user      = document.getElementById('login-user');
  const pass      = document.getElementById('login-pass');
  const status    = document.getElementById('login-status');
  const finale    = document.getElementById('finale');
  const finaleName = document.getElementById('finale-name');
  const skip      = document.getElementById('power-skip');

  if (sessionStorage.getItem('pnt-logged-in') || FX.reduceMotion) {
    power.remove();
    openStartupWindows();
    return;
  }

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let started = false, done = false;

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    sessionStorage.setItem('pnt-logged-in', '1');
    document.removeEventListener('keydown', onKey);
    power.classList.add('off');
    setTimeout(openStartupWindows, 350);
    setTimeout(() => power.remove(), 1000);
  }
  function onKey(e) {
    if (!['Enter', 'Escape', ' '].includes(e.key)) return;
    e.preventDefault();
    started ? finish() : start();
  }
  skip.addEventListener('click', finish);
  powerBtn.addEventListener('click', start);
  document.addEventListener('keydown', onKey);
  powerBtn.focus({ preventScroll: true });

  function typeInto(el, text, startAt, speed = 65) {
    [...text].forEach((ch, i) => at(startAt + i * speed, () => {
      el.textContent += ch;
      FX.sfx.key();
    }));
    return startAt + text.length * speed;
  }

  function start() {
    if (started) return;
    started = true;
    FX.sfx.powerOn();
    gate.classList.add('gone');
    power.classList.add('on');   // triggers the CRT warm-up animation

    // Boot log
    const BOOT_LINES = [
      ['hi',   'PNT.OS v1.0 — (c) 2026 Paul Nehme Tekle'],
      ['',     ''],
      ['ok',   '[  OK  ] Mounting /home/paul'],
      ['ok',   '[  OK  ] Loading modules: angular react dotnet python'],
      ['ok',   '[  OK  ] Starting agentic-ai.service'],
      ['ok',   '[  OK  ] Restoring career/ (2023 — present)'],
      ['warn', '[ INFO ] Locating user… Paris, FR'],
      ['ok',   '[  OK  ] Reached target: portfolio.target'],
    ];
    const BOOT_START = 1000, LINE_MS = 140;
    BOOT_LINES.forEach(([cls, text], i) => at(BOOT_START + i * LINE_MS, () => {
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = text || ' ';
      bootLog.appendChild(line);
      progress.style.width = `${((i + 1) / BOOT_LINES.length) * 100}%`;
      FX.sfx.tick();
    }));

    // Login types itself in
    const loginAt = BOOT_START + BOOT_LINES.length * LINE_MS + 400;
    at(loginAt, () => { bootStage.hidden = true; login.hidden = false; });
    let t = typeInto(user, 'visitor', loginAt + 450);
    t = typeInto(pass, '••••••••', t + 200, 50);
    at(t + 200, () => { status.textContent = 'authenticating…'; });
    at(t + 800, () => {
      status.textContent = 'access granted';
      status.classList.add('ok');
      FX.sfx.granted();
    });

    // Glitch, then the name decrypts on screen, then dive into the desktop
    at(t + 1500, () => {
      FX.sfx.glitch();
      power.classList.add('glitch');
      setTimeout(() => power.classList.remove('glitch'), 380);
    });
    at(t + 1750, async () => {
      login.hidden = true;
      finale.hidden = false;
      await FX.decrypt(finaleName, 'PAUL\nNEHME\nTEKLE', 1300, FX.sfx.tick);
      if (done) return;
      finale.classList.add('lit');
      timers.push(setTimeout(() => { FX.sfx.whoosh(); finish(); }, 1100));
    });
  }
})();
