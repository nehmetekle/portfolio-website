/* ════════════════════════════════════════
   PNT.OS — window manager + terminal
════════════════════════════════════════ */

const CV_URL = 'uploads/Paul%20Nehme%20Tekle%20-%20CV.pdf';

// Desktop apps. `tpl` points at a <template> in world.html; `href` opens a link instead of a window.
const APPS = {
  readme:    { title: 'welcome.md',  glyph: '✦',  tpl: 'tpl-readme',    w: 440, h: 400 },
  about:     { title: 'about.txt',   glyph: '▣',  tpl: 'tpl-about',     w: 540, h: 520 },
  career:    { title: 'career/',     glyph: '▤',  tpl: 'tpl-career',    w: 620, h: 580 },
  projects:  { title: 'projects/',   glyph: '◆',  tpl: 'tpl-projects',  w: 620, h: 580 },
  skills:    { title: 'skills.sh',   glyph: '❯',  tpl: 'tpl-skills',    w: 580, h: 540 },
  education: { title: 'education/',  glyph: '◎',  tpl: 'tpl-education', w: 480, h: 320 },
  contact:   { title: 'contact.app', glyph: '✉',  tpl: 'tpl-contact',   w: 500, h: 500 },
  terminal:  { title: 'terminal',    glyph: '>_', w: 620, h: 600 },
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
    if (isTouch || e.detail === 0) openApp(id);
  });
  btn.addEventListener('dblclick', () => openApp(id));

  li.appendChild(btn);
  iconList.appendChild(li);
});

desktop.addEventListener('pointerdown', e => {
  if (e.target === desktop) iconList.querySelectorAll('.selected').forEach(b => b.classList.remove('selected'));
});

/* ─── Window manager ─────────────────────── */
function openApp(id) {
  const app = APPS[id];
  if (!app) return false;
  if (app.href) { window.open(app.href, '_blank', 'noopener'); return true; }

  const existing = windows.get(id);
  if (existing) { restore(id); return true; }

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
  w.el.classList.remove('minimized');
  w.taskBtn.classList.remove('min');
  focusWin(id);
}

function minimize(id) {
  const w = windows.get(id);
  w.el.classList.add('minimized');
  w.el.classList.remove('focused');
  w.taskBtn.classList.add('min');
  w.taskBtn.classList.remove('active');
  focusTopmost();
}

function closeWin(id) {
  const w = windows.get(id);
  if (!w) return;
  w.el.remove();
  w.taskBtn.remove();
  windows.delete(id);
  focusTopmost();
}

function focusTopmost() {
  let best = null, bestZ = -1;
  windows.forEach(({ el }, key) => {
    const z = +el.style.zIndex || 0;
    if (!el.classList.contains('minimized') && z > bestZ) { best = key; bestZ = z; }
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
  ['clear',       'clear',         'clear the screen'],
  ['pro',         'pro',           'go to the professional view'],
  ['exit',        'exit',          'log out'],
];
// Shortcut buttons pinned to the top of the terminal
const QUICK_CMDS = ['help', 'whoami', 'about', 'career', 'projects', 'skills', 'contact', 'neofetch', 'cv', 'clear'];

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

  pro: () => { setTimeout(() => (location.href = 'professional.html'), 400); return 'switching to professional view…'; },
  exit: () => { setTimeout(() => (location.href = './'), 400); return 'logging out…'; },
};
['about', 'career', 'projects', 'skills', 'education', 'contact'].forEach(id => {
  COMMANDS[id] = () => { openApp(id); return `<span class="muted">opened ${APPS[id].title}</span>`; };
});
Object.assign(COMMANDS, {
  experience: COMMANDS.career, work: COMMANDS.career, hire: COMMANDS.contact,
  professional: COMMANDS.pro, logout: COMMANDS.exit, '?': COMMANDS.help,
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
    print(fn ? fn(args) : `<span class="err">command not found: ${escapeHtml(cmd)}</span> — type \`help\``);
  }

  input.addEventListener('keydown', e => {
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

/* ─── Power on + login ───────────────────── */
function openStartupWindows() {
  if (!isSmall()) {
    openApp('terminal');
    const term = windows.get('terminal').el;
    term.style.left = `${Math.max(8, desktop.clientWidth - term.offsetWidth - 40)}px`;
    term.style.top  = `${Math.max(8, desktop.clientHeight - term.offsetHeight - 40)}px`;
  }
  // Small delay so the two windows pop in one after the other
  setTimeout(() => openApp('readme'), isSmall() ? 0 : 260);
}

(function powerOn() {
  const power  = document.getElementById('power');
  const user   = document.getElementById('login-user');
  const pass   = document.getElementById('login-pass');
  const status = document.getElementById('login-status');
  const skip   = document.getElementById('power-skip');

  sessionStorage.setItem('pnt-booted', '1');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sessionStorage.getItem('pnt-logged-in') || reduceMotion) {
    power.remove();
    openStartupWindows();
    return;
  }

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    sessionStorage.setItem('pnt-logged-in', '1');
    document.removeEventListener('keydown', onKey);
    power.classList.add('off');
    document.body.classList.add('logged-in');
    setTimeout(openStartupWindows, 350);
    setTimeout(() => power.remove(), 900);
  }
  function onKey(e) {
    if (['Enter', 'Escape', ' '].includes(e.key)) finish();
  }
  skip.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);

  // Type text one character at a time starting at `start` ms; returns when it ends
  function typeInto(el, text, start, speed = 70) {
    [...text].forEach((ch, i) => at(start + i * speed, () => (el.textContent += ch)));
    return start + text.length * speed;
  }

  // 0–900ms: CRT warm-up (CSS animation). Then the login form types itself in.
  let t = typeInto(user, 'visitor', 1300);
  t = typeInto(pass, '••••••••', t + 250, 55);
  at(t + 300, () => { status.textContent = 'authenticating…'; });
  at(t + 1000, () => { status.textContent = 'access granted — welcome to paul\'s workstation'; status.classList.add('ok'); });
  at(t + 1900, finish);
})();
