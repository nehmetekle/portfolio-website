/* ════════════════════════════════════════
   PNT.OS wallpaper — a live pixel-art Paris skyline.
   Haussmann rooftops, the Seine and the Eiffel Tower, which glows gold
   after dark with its searchlight and sparkles for the first 5 minutes
   of every hour at night, like the real one. The sky follows the real
   time in Paris (sunrise, sunset, night) and the live weather.
   Preview a time of day with ?time=dawn|day|sunset|night
════════════════════════════════════════ */
const SKYLINE = (() => {
  const PX = 3;     // screen pixels per art pixel
  const PAD = 10;   // extra art pixels on each side of a layer, room for mouse parallax

  const PARIS = { tz: 'Europe/Paris', lon: 2.35, amp: 4.1, seed: 1789 };

  // Deterministic random so the city looks the same on every visit
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ─── Time of day in Paris ─────────────── */
  const PREVIEW = new URLSearchParams(location.search).get('time');

  function cityClock() {
    const cfg = PARIS;
    const now = new Date();
    const part = type => +new Intl.DateTimeFormat('en-GB', { timeZone: cfg.tz, [type]: 'numeric', hourCycle: 'h23' })
      .formatToParts(now).find(p => p.type === type).value;
    let hour = part('hour') + part('minute') / 60;
    let minute = part('minute');
    const offset = (part('hour') - now.getUTCHours() + 24) % 24;   // includes daylight saving
    const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const dayLength = 12.2 + cfg.amp * Math.sin((2 * Math.PI * (doy - 80)) / 365);
    const noon = 12 - cfg.lon / 15 + offset;
    const sunrise = noon - dayLength / 2, sunset = noon + dayLength / 2;
    // ?time= preview, placed relative to today's real sunrise and sunset
    const preview = { dawn: sunrise + 0.15, day: noon, sunset: sunset - 0.1, night: sunset + 3.5 }[PREVIEW];
    if (preview !== undefined) { hour = preview % 24; minute = 2; }
    return { hour, minute, sunrise, sunset };
  }

  // Sun elevation in [-1, 1]: >0 day, around 0 twilight, <0 night
  function sunElevation({ hour, sunrise, sunset }) {
    if (hour >= sunrise && hour <= sunset) return Math.sin(Math.PI * (hour - sunrise) / (sunset - sunrise));
    const sinceSet = hour > sunset ? hour - sunset : hour + 24 - sunset;
    return -Math.sin(Math.PI * sinceSet / (24 - (sunset - sunrise)));
  }

  /* ─── Colours ──────────────────────────── */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp01 = v => Math.min(1, Math.max(0, v));

  // [elevation, sky top, sky bottom]
  const SKY = [
    [-1,    '#04060f', '#0d0a1e'],
    [-0.25, '#070a1a', '#1c1233'],
    [-0.06, '#1d1a45', '#d0603f'],
    [0.06,  '#3d4f8f', '#f59a5b'],
    [0.25,  '#3f6aa8', '#9fbbd9'],
    [1,     '#355f9e', '#8fb0d6'],
  ];
  function skyAt(e) {
    for (let i = 1; i < SKY.length; i++) {
      if (e <= SKY[i][0]) {
        const [e0, t0, b0] = SKY[i - 1], [e1, t1, b1] = SKY[i];
        const t = (e - e0) / (e1 - e0);
        return [mix(hex(t0), hex(t1), t), mix(hex(b0), hex(b1), t)];
      }
    }
    return [hex(SKY.at(-1)[1]), hex(SKY.at(-1)[2])];
  }

  /* ─── Scene ────────────────────────────── */
  let canvas, c, W = 0, H = 0, scene = null;
  let cloudiness = 0.35, grey = 0;      // live weather
  const mouse = { x: 0.5, tx: 0.5 };
  const layers = { sky: null, far: null, landmark: null, near: null };
  let look = null, lastRender = 0;

  function windowsFor(r, w, h, stepX, stepY, chance) {
    const out = [];
    for (let wy = 5; wy < h - 3; wy += stepY) {
      for (let wx = 2; wx < w - 2; wx += stepX) out.push({ x: wx, y: wy, on: r() < chance, warm: r() < 0.8 });
    }
    return out;
  }

  function buildParis(r) {
    const ground = H - 9;   // the Seine below this line
    const towerX = Math.round(W * (W > 240 ? 0.8 : 0.55));
    const towerH = Math.round(Math.min(H * 0.6, W * 0.52));
    const towerHalf = Math.round(towerH * 0.2);

    const far = [];
    for (let x = -PAD; x < W + PAD; ) {
      const w = 8 + Math.floor(r() * 14), h = Math.round(H * (0.12 + r() * 0.12));
      far.push({ x, w, h });
      x += w - 1;
    }
    const near = [];
    for (let x = -PAD; x < W + PAD; ) {
      const w = 14 + Math.floor(r() * 18), h = Math.round(H * (0.07 + r() * 0.11));
      // Leave the Champ de Mars open so the tower's legs show
      if (x + w > towerX - towerHalf - 6 && x < towerX + towerHalf + 6) { x = towerX + towerHalf + 7; continue; }
      near.push({ x, w, h, roof: 3 + Math.floor(r() * 2), chimneys: [Math.floor(r() * (w - 4)) + 2, Math.floor(r() * (w - 4)) + 2], windows: windowsFor(r, w, h, 3, 4, 0.55) });
      x += w + (r() < 0.2 ? 2 : 0);
    }
    return { ground, towerX, towerH, towerHalf, far, near };
  }

  function build() {
    const r = rng(PARIS.seed);
    const base = buildParis(r);
    const stars = Array.from({ length: Math.round(W * H / 260) }, (_, i) => ({ x: Math.round(r() * W), y: Math.round(r() * (base.ground - 20)), group: i % 4, s: r() < 0.12 ? 2 : 1 }));
    const clouds = Array.from({ length: 7 }, (_, i) => ({ x: r() * W * 1.4, y: Math.round(H * (0.08 + r() * 0.26)), w: Math.round(18 + r() * 30), speed: 0.6 + r() * 1.2, puffs: Array.from({ length: 4 }, () => [r(), r()]), visible: i / 7 }));
    scene = { ...base, stars, clouds };
  }

  function makeLayer() {
    const el = document.createElement('canvas');
    el.width = W + PAD * 2;
    el.height = H;
    const ctx = el.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(PAD, 0);
    return { el, ctx };
  }

  function resize() {
    W = Math.ceil(canvas.clientWidth / PX);
    H = Math.ceil(canvas.clientHeight / PX);
    if (!W || !H) return;
    canvas.width = W;
    canvas.height = H;
    c.imageSmoothingEnabled = false;
    build();
    for (const k in layers) layers[k] = makeLayer();
    renderLayers();
    draw(performance.now());
  }

  /* ─── The Eiffel Tower ─────────────────── */
  // Proportions of the real tower: four curved legs under the great arch,
  // two platforms, the long tapering upper section, the top cabin and
  // antenna — with criss-cross ironwork.
  const F1 = 0.2, F2 = 0.45, F3 = 0.91;

  // Half-width of the tower's outline at height fraction f
  function towerHalfAt(f, hb) {
    if (f < F1) return hb * (1 - 0.42 * Math.pow(f / F1, 0.85));
    if (f < F2) return hb * (0.56 - 0.33 * Math.pow((f - F1) / (F2 - F1), 0.9));
    if (f < F3) return hb * (0.2 * Math.pow(1 - (f - F2) / (F3 - F2), 1.5) + 0.045);
    return hb * 0.06;
  }

  function eiffel(t, x0, base, h, hb, col) {
    const px = (x, y, color) => { t.fillStyle = color; t.fillRect(x, y, 1, 1); };
    const brace = (row, dx, period) => (row + dx) % period === 0 || (row - dx + 999) % period === 0;

    // Fill [inner, outer] on both sides of the centre line
    function span(y, inner, outer, row, period) {
      for (let dx = Math.floor(inner); dx <= Math.ceil(outer); dx++) {
        const edge = (inner > 0 && dx <= inner + 0.9) || dx >= outer - 0.9;
        for (const s of [-1, 1]) {
          const color = edge ? (s > 0 ? col.lit : col.edge) : brace(row, dx, period) ? col.brace : col.gap;
          px(x0 + s * dx, y, color);
        }
      }
    }

    const archLow = h * F1 * 0.5, archHigh = h * F1 * 0.92;
    for (let row = 0; row <= h; row++) {
      const f = row / h, y = base - row;
      const outer = towerHalfAt(f, hb);
      if (f < F1) {
        // Curved legs
        const legW = Math.max(2, hb * 0.3 * (1 - 0.35 * f / F1));
        const inner = Math.max(0, outer - legW);
        span(y, inner, outer, row, 4);
        // The great arch between the legs, with the decorated band above it
        if (row > archLow) {
          for (let dx = 0; dx < inner; dx++) {
            const archY = archLow + (archHigh - archLow) * Math.sqrt(Math.max(0, 1 - (dx / inner) ** 2));
            if (Math.abs(row - archY) < 1) { px(x0 + dx, y, col.edge); px(x0 - dx, y, col.edge); }
            else if (row > archY && brace(row, dx, 3)) { px(x0 + dx, y, col.brace); px(x0 - dx, y, col.brace); }
          }
        }
      } else if (f < F1 + 0.02) {
        // First platform, with a railing
        const w = Math.round(towerHalfAt(F1, hb)) + 3;
        for (let dx = -w; dx <= w; dx++) px(x0 + dx, y, col.edge);
        for (let dx = -w; dx <= w; dx += 2) px(x0 + dx, y - 1, col.brace);
      } else if (f < F2) {
        span(y, 1, outer, row, 4);   // legs converging, open lattice between
      } else if (f < F2 + 0.014) {
        const w = Math.round(towerHalfAt(F2, hb)) + 2;   // second platform
        for (let dx = -w; dx <= w; dx++) px(x0 + dx, y, col.edge);
      } else if (f < F3) {
        span(y, 0, outer, row, 3);   // long upper section
      } else if (f < F3 + 0.025) {
        const w = Math.max(1, Math.round(hb * 0.08));   // top cabin
        for (let dx = -w; dx <= w; dx++) px(x0 + dx, y, col.edge);
      } else px(x0, y, col.edge);
    }
    for (let i = 1; i <= 6; i++) px(x0, base - h - i, col.edge);   // antenna
  }

  /* ─── Static layers (refreshed every few seconds) ── */
  function clearLayer(L) { L.ctx.clearRect(-PAD, 0, W + PAD * 2, H); return L.ctx; }

  function renderLayers() {
    if (!scene) return;
    lastRender = performance.now();
    const clock = cityClock();
    const e = sunElevation(clock);
    const dark = clamp01((0.08 - e) / 0.3);   // 0 day … 1 night
    const g = grey;
    const { ground } = scene;

    // Sky and sun
    let [top, bottom] = skyAt(e);
    if (g) {
      const gc = mix([110, 116, 128], [40, 44, 56], dark);
      top = mix(top, gc, g * 0.55);
      bottom = mix(bottom, gc, g * 0.55);
    }
    const sky = clearLayer(layers.sky);
    const grad = sky.createLinearGradient(0, 0, 0, ground);
    grad.addColorStop(0, css(top));
    grad.addColorStop(1, css(bottom));
    sky.fillStyle = grad;
    sky.fillRect(-PAD, 0, W + PAD * 2, H);

    const { hour, sunrise, sunset } = clock;
    let sun = null, moon = null;
    if (e > -0.08) {
      const p = (hour - sunrise) / (sunset - sunrise);
      sun = { x: W * (0.08 + 0.84 * p), y: ground - Math.max(-6, e) * (ground - 20) * 0.9 - 4 };
      sky.fillStyle = css(mix([255, 120, 70], [255, 236, 190], clamp01(e * 3)), 0.95 * (1 - g * 0.6));
      sky.beginPath(); sky.arc(sun.x, sun.y, 6, 0, Math.PI * 2); sky.fill();
      sky.fillStyle = 'rgba(255,200,120,0.12)';
      sky.beginPath(); sky.arc(sun.x, sun.y, 12, 0, Math.PI * 2); sky.fill();
    }
    if (dark > 0.3) {
      const p = ((hour - sunset + 24) % 24) / (24 - (sunset - sunrise));
      moon = { x: W * (0.1 + 0.8 * p), y: H * 0.12 + Math.abs(p - 0.5) * H * 0.3 };
    }

    const far = clearLayer(layers.far), lm = clearLayer(layers.landmark), near = clearLayer(layers.near);
    const winLit = (w, warm, cool) => (w.on && dark > 0.4 ? (w.warm ? warm : cool) : null);

    // Far skyline (hazy)
    far.fillStyle = css(mix(mix(bottom, [30, 26, 46], 0.55), [14, 12, 26], dark * 0.6));
    for (const b of scene.far) far.fillRect(b.x, ground - b.h, b.w, b.h);

    // Eiffel Tower: bronze by day with a sunlit side, gold at night with a soft halo
    const lit = clamp01((0.1 - e) / 0.25);
    const { towerX, towerH, towerHalf } = scene;
    if (lit > 0.2) {
      const cy = ground - towerH * 0.45;
      const halo = lm.createRadialGradient(towerX, cy, 2, towerX, cy, towerH * 0.7);
      halo.addColorStop(0, `rgba(255,190,90,${0.22 * lit})`);
      halo.addColorStop(1, 'rgba(255,190,90,0)');
      lm.fillStyle = halo;
      lm.fillRect(towerX - towerH, ground - towerH * 1.2, towerH * 2, towerH * 1.2);
    }
    eiffel(lm, towerX, ground, towerH, towerHalf, {
      edge:  css(mix([86, 66, 52], [255, 196, 96], lit)),
      lit:   css(mix([150, 118, 92], [255, 222, 150], lit)),
      brace: css(mix([108, 86, 68], [214, 150, 60], lit)),
      gap:   css(mix([70, 56, 46], [140, 90, 34], lit), 0.45),
    });

    // Haussmann buildings with mansard roofs and windows
    const wall = css(mix([96, 92, 110], [22, 20, 36], dark));
    const roofCol = css(mix([70, 80, 100], [16, 18, 30], dark));
    const pane = css(mix([60, 70, 92], [10, 12, 22], dark));
    for (const b of scene.near) {
      const bt = ground - b.h;
      near.fillStyle = roofCol;
      near.fillRect(b.x + 1, bt - b.roof, b.w - 2, b.roof);
      for (const ch of b.chimneys) near.fillRect(b.x + ch, bt - b.roof - 2, 1, 2);
      near.fillStyle = wall;
      near.fillRect(b.x, bt, b.w, b.h);
      for (const w of b.windows) {
        if (dark > 0.4 && Math.random() < 0.04) w.on = !w.on;
        near.fillStyle = winLit(w, 'rgba(255,196,110,0.95)', 'rgba(190,215,255,0.85)') || pane;
        near.fillRect(b.x + w.x, bt + w.y, 1, 2);
      }
    }

    const cloudCol = mix(mix([248, 250, 255], [255, 170, 150], Math.max(0, 1 - Math.abs(e) * 8) * 0.8), [40, 44, 62], dark);
    look = {
      e, dark, top, sun, moon,
      sparkle: dark > 0.6 && clock.minute < 5,
      night: e < 0.02,
      starAlpha: dark * (1 - g * 0.8),
      cloud: css(cloudCol, 0.55 + g * 0.3),
      clouds: cloudiness,
      water: css(mix(mix(bottom, [20, 30, 60], 0.6), [6, 8, 18], dark)),
      bank: css(mix(mix([96, 92, 110], [22, 20, 36], dark), [255, 255, 255], 0.1)),
    };
  }

  /* ─── Each frame: layers + the moving parts ── */
  function draw(now) {
    if (!scene || !look) return;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    const shift = k => Math.round((mouse.x - 0.5) * k);
    const { dark } = look;

    c.drawImage(layers.sky.el, -PAD, 0);

    // Stars twinkle in four groups, so there are only four colours to set per frame
    if (look.starAlpha > 0.15) {
      for (let g = 0; g < 4; g++) {
        c.fillStyle = `rgba(230,236,255,${look.starAlpha * (0.35 + 0.45 * Math.abs(Math.sin(now / 1300 + g * 1.7)))})`;
        for (const s of scene.stars) if (s.group === g) c.fillRect(s.x + shift(4), s.y, s.s, s.s);
      }
    }
    if (look.moon) {
      const { x, y } = look.moon;
      c.fillStyle = `rgba(255,240,205,${dark})`;
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = css(look.top);   // crescent
      c.beginPath(); c.arc(x + 2, y - 1, 4.4, 0, Math.PI * 2); c.fill();
    }

    // Clouds drift with the wind
    c.fillStyle = look.cloud;
    for (const cl of scene.clouds) {
      if (cl.visible > look.clouds) continue;
      cl.x -= cl.speed * 0.012;
      if (cl.x + cl.w < -10) cl.x = W + 10;
      const x = Math.round(cl.x) + shift(6);
      c.fillRect(x, cl.y, cl.w, 3);
      for (const [px, py] of cl.puffs) c.fillRect(x + Math.round(px * cl.w * 0.7), Math.round(cl.y - 2 - py * 3), Math.round(cl.w * 0.3), 3);
    }

    c.drawImage(layers.far.el, shift(8) - PAD, 0);
    drawParis(now, shift);
  }

  function drawParis(now, shift) {
    const { ground, towerX, towerH, towerHalf } = scene;
    const { dark, night, sparkle } = look;
    const tx = towerX + shift(12), top = ground - towerH;
    if (night) {
      // Rotating searchlight
      const reach = Math.cos(now / 2600), len = W * 0.45;
      const g = c.createLinearGradient(tx, top, tx + reach * len, top);
      g.addColorStop(0, 'rgba(255,236,170,0.32)');
      g.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(tx, top - 3);
      c.lineTo(tx + reach * len, top - 3 - len * 0.05);
      c.lineTo(tx + reach * len, top - 3 + len * 0.05);
      c.closePath();
      c.fill();
    }
    c.drawImage(layers.landmark.el, shift(12) - PAD, 0);
    if (night) {
      c.fillStyle = Math.floor(now / 700) % 2 ? '#ff334d' : '#7a1020';
      c.fillRect(tx, top - 7, 1, 1);
      // Hourly sparkle, across the tower's outline
      if (sparkle) {
        for (let i = 0; i < towerH; i++) {
          const row = Math.floor(Math.random() * towerH * 0.92);
          const hw = towerHalfAt(row / towerH, towerHalf);
          c.fillStyle = Math.random() < 0.7 ? '#ffffff' : '#bfe3ff';
          c.fillRect(tx + Math.round((Math.random() * 2 - 1) * hw), ground - row, 1, 1);
        }
      }
    }
    c.drawImage(layers.near.el, shift(16) - PAD, 0);

    // The Seine, with reflections of the lit city at night
    c.fillStyle = look.water;
    c.fillRect(0, ground + 1, W, H - ground);
    c.fillStyle = look.bank;
    c.fillRect(0, ground, W, 1);
    c.fillStyle = dark > 0.4 ? 'rgba(255,196,110,0.45)' : 'rgba(255,255,255,0.25)';
    const depth = H - ground - 3;
    for (let x = 0; x < W; x += 2) {
      if (Math.sin(x * 0.7 + now / 600) + Math.sin(x * 0.23 - now / 900) > 1.1) c.fillRect(x, ground + 2 + ((x * 7) % depth), 2, 1);
    }
    if (dark > 0.4) {
      c.fillStyle = `rgba(222,160,64,${0.25 * dark})`;
      for (let i = 0; i < 6; i++) c.fillRect(tx - 2 + Math.round(Math.sin(now / 400 + i) * 2), ground + 2 + i, 4, 1);
    }

    if (sparkle && !scene.announced && typeof LIFE !== 'undefined' && LIFE.pet.el) {
      scene.announced = true;
      LIFE.pet.say('The Eiffel Tower is sparkling! ✨ It does that every hour at night', 4500);
    }
    if (!sparkle) scene.announced = false;
  }

  /* ─── Public API ───────────────────────── */
  function start(el) {
    canvas = el;
    c = canvas.getContext('2d');
    if (!c) return false;
    resize();   // draws the first frame
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', ev => { mouse.tx = ev.clientX / window.innerWidth; }, { passive: true });

    if (FX.reduceMotion) {
      setInterval(() => { renderLayers(); draw(performance.now()); }, 60_000);
      return true;
    }
    // Hold still during the login intro (it's hidden anyway); animate once the desktop shows
    document.addEventListener('pnt:ready', () => {
      let last = 0;
      (function loop(now) {
        if (now - last > 40) {   // ~25 fps is plenty for pixel art
          last = now;
          if (now - lastRender > 5000) renderLayers();
          draw(now);
        }
        requestAnimationFrame(loop);
      })(0);
    }, { once: true });
    return true;
  }

  // Called by friends.js once the live Paris weather is known
  function setWeather(kind) {
    cloudiness = { clear: 0.3, cloudy: 0.85, fog: 1, rain: 1, snow: 1, storm: 1 }[kind] ?? 0.35;
    grey = { clear: 0, cloudy: 0.35, fog: 0.7, rain: 0.6, snow: 0.45, storm: 0.85 }[kind] ?? 0;
    renderLayers();
  }

  return { start, setWeather };
})();
