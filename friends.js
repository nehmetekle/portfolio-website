/* ════════════════════════════════════════
   PNT.OS friends — Null the cat, bugs for Byte to chase,
   and live Paris weather on the desktop
════════════════════════════════════════ */
const FRIENDS = (() => {
  const desktop = document.getElementById('desktop');
  const pick = list => list[(Math.random() * list.length) | 0];

  /* ─── Speech bubble shared by the critters ── */
  function bubbleFor(el) {
    const bubble = document.createElement('span');
    bubble.className = 'pet-bubble';
    bubble.hidden = true;
    el.prepend(bubble);
    let timer = 0;
    return (html, ms = 3200) => {
      clearTimeout(timer);
      bubble.innerHTML = html;
      bubble.hidden = false;
      bubble.classList.toggle('left', el.getBoundingClientRect().left > window.innerWidth - 260);
      timer = setTimeout(() => (bubble.hidden = true), ms);
    };
  }

  /* ─── Null the cat ─────────────────────── */
  const CAT_SVG = `
    <svg class="cat-sprite" viewBox="0 0 16 13" width="48" height="39" shape-rendering="crispEdges" aria-hidden="true">
      <g class="c-tail"><rect x="11" y="9" width="3" height="2" fill="#f59e5b"/><rect x="13" y="5" width="2" height="5" fill="#f59e5b"/><rect x="13" y="5" width="2" height="1" fill="#d9783a"/></g>
      <rect x="4" y="5" width="6" height="1" fill="#f59e5b"/>
      <rect x="3" y="6" width="9" height="6" fill="#f59e5b"/>
      <rect x="6" y="7" width="1" height="3" fill="#d9783a"/>
      <rect x="8" y="7" width="1" height="3" fill="#d9783a"/>
      <rect x="10" y="7" width="1" height="3" fill="#d9783a"/>
      <rect x="3" y="9" width="3" height="3" fill="#ffd9b0"/>
      <rect x="1" y="0" width="1" height="1" fill="#f59e5b"/>
      <rect x="6" y="0" width="1" height="1" fill="#f59e5b"/>
      <rect x="1" y="1" width="6" height="5" fill="#f59e5b"/>
      <rect x="2" y="1" width="1" height="1" fill="#ff9fb2"/>
      <rect x="5" y="1" width="1" height="1" fill="#ff9fb2"/>
      <g class="c-eyes"><rect x="2" y="3" width="1" height="1" fill="#14321f"/><rect x="5" y="3" width="1" height="1" fill="#14321f"/></g>
      <rect x="3" y="4" width="2" height="1" fill="#ff9fb2"/>
      <rect x="3" y="12" width="2" height="1" fill="#ffd9b0"/>
      <rect x="6" y="12" width="2" height="1" fill="#ffd9b0"/>
    </svg>`;
  const CAT_W = 48, CAT_H = 39;
  const CAT_LINES = [
    'mrrp. 🐈',
    'I\'m Null. Not undefined.',
    '*purrs in binary* 01110000',
    'I sit on warm windows 🔥',
    'meow (that means "hire Paul")',
    'Byte thinks he\'s the mascot. Cute.',
  ];

  const cat = {
    el: null, say: null, x: 0, y: 0, perch: null, hop: null, alarmed: false, pets: 0,

    spawn() {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cat';
      el.setAttribute('aria-label', 'Null, the desktop cat — click to pet');
      el.innerHTML = `${CAT_SVG}<span class="cat-hearts" aria-hidden="true"></span>`;
      desktop.appendChild(el);
      this.el = el;
      this.say = bubbleFor(el);
      const ground = this.groundPos();
      this.x = ground.x;
      this.y = -60;    // drops in from above
      el.addEventListener('click', () => this.pet());
      this.hopTo(this.pickPerch());
      setInterval(() => this.check(), 2500);
      requestAnimationFrame(() => this.loop());
    },

    // Frontmost window with room above its title bar
    pickPerch() {
      const wins = [...desktop.querySelectorAll('.win:not(.minimized):not(.maximized)')]
        .filter(w => w.offsetTop > 44 && w.offsetWidth > 260);
      wins.sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0));
      return wins[0] || null;
    },

    groundPos() {
      return { x: desktop.clientWidth * 0.62, y: desktop.clientHeight - CAT_H - 2 };
    },

    perchPos(win) {
      if (!win) return this.groundPos();
      return { x: win.offsetLeft + win.offsetWidth - 120, y: win.offsetTop - CAT_H + 4 };
    },

    hopTo(win) {
      this.perch = win;
      this.alarmed = false;
      desktop.appendChild(this.el);   // paint above the window it lands on
      this.hop = { fromX: this.x, fromY: this.y, start: performance.now(), dur: FX.reduceMotion ? 1 : 650 };
      this.el.classList.add('hopping');
    },

    check() {
      const perchGone = this.perch && (!this.perch.isConnected || this.perch.classList.contains('minimized') || this.perch.classList.contains('maximized'));
      const best = this.pickPerch();
      if (perchGone || (best !== this.perch && !this.hop)) {
        if (perchGone && Math.random() < 0.5) this.say('hey! I was sleeping on that 😾', 2200);
        this.hopTo(best);
      }
    },

    loop() {
      const target = this.perchPos(this.perch);
      if (this.hop) {
        const p = Math.min(1, (performance.now() - this.hop.start) / this.hop.dur);
        const e = p * p * (3 - 2 * p);
        const arc = Math.sin(p * Math.PI) * 70;
        this.x = this.hop.fromX + (target.x - this.hop.fromX) * e;
        this.y = this.hop.fromY + (target.y - this.hop.fromY) * e - arc;
        if (p === 1) { this.hop = null; this.el.classList.remove('hopping'); }
      } else {
        this.x = target.x;
        this.y = target.y;
      }
      this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
      this.el.style.zIndex = this.perch ? this.perch.style.zIndex : 2;

      // Riding along while someone drags her window around
      if (this.perch?.classList.contains('dragging') && !this.alarmed) {
        this.alarmed = true;
        FX.sfx.meow();
        this.say('mrrow?! 🙀', 1800);
      } else if (this.perch && !this.perch.classList.contains('dragging')) {
        this.alarmed = false;
      }
      requestAnimationFrame(() => this.loop());
    },

    pet() {
      FX.sfx.purr();
      this.say(pick(CAT_LINES));
      const hearts = this.el.querySelector('.cat-hearts');
      hearts.innerHTML = '<i>♥</i><i>♥</i><i>♥</i>';
      setTimeout(() => (hearts.innerHTML = ''), 1400);
      if (++this.pets === 1) LIFE.unlock('catperson');
    },
  };

  /* ─── Bugs ─────────────────────────────── */
  const BUG_SVG = `
    <svg viewBox="0 0 10 10" width="26" height="26" shape-rendering="crispEdges" aria-hidden="true">
      <g class="b-legs-a"><rect x="3" y="2" width="1" height="1" fill="#1a2e05"/><rect x="5" y="7" width="1" height="1" fill="#1a2e05"/></g>
      <g class="b-legs-b"><rect x="5" y="2" width="1" height="1" fill="#1a2e05"/><rect x="3" y="7" width="1" height="1" fill="#1a2e05"/></g>
      <rect x="2" y="3" width="5" height="4" fill="#a3e635"/>
      <rect x="4" y="3" width="1" height="4" fill="#4d7c0f"/>
      <rect x="2" y="4" width="1" height="1" fill="#4d7c0f"/>
      <rect x="6" y="5" width="1" height="1" fill="#4d7c0f"/>
      <rect x="7" y="4" width="2" height="2" fill="#1a2e05"/>
      <rect x="9" y="3" width="1" height="1" fill="#1a2e05"/>
      <rect x="9" y="6" width="1" height="1" fill="#1a2e05"/>
    </svg>`;
  const BUG_SIZE = 26;
  let bugsFixed = 0, userSquashes = 0, nextBugAt = 0, bug = null;

  function updateBugCount() {
    const el = document.getElementById('bug-count');
    el.hidden = false;
    el.textContent = `🐛 ${bugsFixed} bug${bugsFixed === 1 ? '' : 's'} fixed`;
  }

  function spawnBug() {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bug';
    el.setAttribute('aria-label', 'A bug — click to squash it');
    el.innerHTML = BUG_SVG;
    desktop.appendChild(el);

    const fromLeft = Math.random() < 0.5;
    const b = bug = {
      el, alive: true, grounded: false, chased: false,
      x: fromLeft ? -BUG_SIZE : desktop.clientWidth,
      y: 60 + Math.random() * (desktop.clientHeight * 0.5),
      angle: fromLeft ? 0 : Math.PI,
      mode: 'wander',
      modeUntil: performance.now() + 6000 + Math.random() * 4000,
      catch() { squash(b, false); },
    };
    el.addEventListener('click', () => squash(b, true));
    FX.sfx.tick();

    let last = performance.now();
    (function crawl(now) {
      if (!b.alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const groundY = desktop.clientHeight - BUG_SIZE - 2;

      if (b.mode === 'wander') {
        b.angle += (Math.random() - 0.5) * 6 * dt;
        // Bounce off the edges, but only when heading outwards (it spawns just off-screen)
        const cos = Math.cos(b.angle), sin = Math.sin(b.angle);
        if ((b.x < 40 && cos < 0) || (b.x > desktop.clientWidth - BUG_SIZE - 40 && cos > 0)) b.angle = Math.PI - b.angle;
        if ((b.y < 10 && sin < 0) || (b.y > groundY - 40 && sin > 0)) b.angle = -b.angle;
        if (now > b.modeUntil) b.mode = 'descend';
      } else if (b.mode === 'descend') {
        b.angle += (Math.atan2(groundY - b.y, 0.3) - b.angle) * 3 * dt;
        if (b.y >= groundY) {
          b.y = groundY;
          b.mode = 'ground';
          b.grounded = true;
          b.angle = Math.random() < 0.5 ? 0 : Math.PI;
          b.chased = LIFE.pet.chase(b);
        }
      } else {
        // Escapes off the edge if nobody catches it
        if (b.x < -BUG_SIZE * 2 || b.x > desktop.clientWidth + BUG_SIZE) { remove(b); return; }
      }

      const speed = b.mode === 'ground' ? 38 : 60;
      b.x += Math.cos(b.angle) * speed * dt;
      b.y += Math.sin(b.angle) * speed * dt;
      if (b.mode === 'descend') b.x = Math.max(0, Math.min(desktop.clientWidth - BUG_SIZE, b.x));
      el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.angle}rad)`;
      requestAnimationFrame(crawl);
    })(last);
  }

  function remove(b) {
    b.alive = false;
    b.el.remove();
    if (bug === b) bug = null;
    nextBugAt = Date.now() + 30_000 + Math.random() * 25_000;
  }

  function squash(b, byVisitor) {
    if (!b.alive) return;
    b.alive = false;
    FX.sfx.squash();
    b.el.classList.add('splat');
    b.el.disabled = true;
    setTimeout(() => remove(b), 900);
    bugsFixed++;
    updateBugCount();
    if (byVisitor) {
      if (b.chased) LIFE.pet.say('Hey, that one was mine! 😤', 2400);
      else if (userSquashes === 0) LIFE.pet.say('Nice catch! 🐛✔', 2200);
      if (++userSquashes === 3) LIFE.unlock('debugger');
    }
  }

  function bugLoop() {
    const busy = bug || LIFE.idleFor() > 20_000 || LIFE.saverOn();
    if (!busy && Date.now() > nextBugAt) spawnBug();
  }

  /* ─── Live Paris weather ───────────────── */
  let weatherText = 'weather: unavailable right now';

  async function loadWeather() {
    const forced = new URLSearchParams(location.search).get('weather');   // e.g. ?weather=rain to preview
    let code, temp, isDay = 1;
    if (forced) {
      code = { clear: 0, cloudy: 2, fog: 45, rain: 63, snow: 73, storm: 95 }[forced] ?? 0;
      temp = 12;
    } else {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code,is_day');
        const { current } = await res.json();
        code = current.weather_code;
        temp = Math.round(current.temperature_2m);
        isDay = current.is_day;
      } catch {
        return;
      }
    }

    const kind =
      code >= 95 ? 'storm' :
      (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' :
      (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? 'rain' :
      code === 45 || code === 48 ? 'fog' :
      code >= 1 && code <= 3 ? 'cloudy' : 'clear';
    const [icon, label] = {
      storm:  ['⛈️', 'thunderstorm'],
      snow:   ['❄️', 'snowing'],
      rain:   ['🌧️', 'raining'],
      fog:    ['🌫️', 'foggy'],
      cloudy: [isDay ? '⛅' : '☁️', 'cloudy'],
      clear:  [isDay ? '☀️' : '🌙', isDay ? 'sunny' : 'clear night'],
    }[kind];

    const line = document.getElementById('w-weather');
    line.textContent = `${icon} ${temp}°C · ${label} in Paris`;
    line.hidden = false;
    weatherText = `${icon}  Paris right now: <span class="warn">${temp}°C</span>, ${label}` +
      (['rain', 'snow', 'storm'].includes(kind) ? '\n<span class="muted">(look at the desktop 👀)</span>' : '');

    if (['rain', 'snow', 'storm'].includes(kind) && !FX.reduceMotion) precipitation(kind);
    const comments = {
      rain: 'It\'s raining in Paris ☔ good day to code inside',
      snow: 'It\'s snowing in Paris! ❄️ My circuits are cold',
      storm: 'Thunderstorm in Paris ⛈️ I\'m hiding under the taskbar',
      clear: isDay ? 'Sunny in Paris ☀️ Paul should go outside. He won\'t.' : null,
    };
    if (comments[kind]) setTimeout(() => LIFE.pet.say(comments[kind]), 9000);
  }

  function precipitation(kind) {
    const canvas = document.createElement('canvas');
    canvas.className = 'precip';
    desktop.appendChild(canvas);
    const c = canvas.getContext('2d');
    const resize = () => { canvas.width = desktop.clientWidth; canvas.height = desktop.clientHeight; };
    resize();
    window.addEventListener('resize', resize);

    const snow = kind === 'snow';
    const parts = Array.from({ length: snow ? 90 : 140 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: snow ? 20 + Math.random() * 40 : 500 + Math.random() * 400,
      r: snow ? 1 + Math.random() * 2.2 : 10 + Math.random() * 14,
      p: Math.random() * Math.PI * 2,
    }));
    let flash = 0, nextFlash = performance.now() + 5000, last = performance.now();

    (function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.strokeStyle = 'rgba(190,205,255,0.28)';
      c.fillStyle = 'rgba(235,240,255,0.75)';
      c.lineWidth = 1;
      for (const d of parts) {
        d.y += d.v * dt;
        if (snow) {
          d.p += dt;
          d.x += Math.sin(d.p) * 18 * dt;
          c.beginPath();
          c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          c.fill();
        } else {
          d.x -= d.v * 0.15 * dt;
          c.beginPath();
          c.moveTo(d.x, d.y);
          c.lineTo(d.x + d.r * 0.15, d.y - d.r);
          c.stroke();
        }
        if (d.y > canvas.height + 20) { d.y = -20; d.x = Math.random() * (canvas.width + 100); }
      }
      if (kind === 'storm') {
        if (now > nextFlash) {
          flash = 1;
          nextFlash = now + 6000 + Math.random() * 9000;
          setTimeout(() => FX.sfx.thunder(), 300 + Math.random() * 700);
        }
        if (flash > 0) {
          c.fillStyle = `rgba(220,230,255,${flash * 0.35})`;
          c.fillRect(0, 0, canvas.width, canvas.height);
          flash = Math.max(0, flash - dt * 2.5);
        }
      }
      requestAnimationFrame(frame);
    })(last);
  }

  /* ─── Start with the rest of the desktop ── */
  document.addEventListener('pnt:ready', () => {
    loadWeather();
    setTimeout(() => cat.spawn(), 6000);
    if (!FX.reduceMotion) {
      nextBugAt = Date.now() + 15_000;
      setInterval(bugLoop, 1000);
    }
  }, { once: true });

  return {
    weatherReport: () => weatherText,
    bugsReport: () => `🐛 bugs fixed so far: <span class="warn">${bugsFixed}</span> <span class="muted">(${userSquashes} by you)</span>`,
  };
})();
