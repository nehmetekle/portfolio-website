/* ════════════════════════════════════════
   PNT.OS wallpaper — live pixel-art cities.

   Paris: Haussmann rooftops, the Seine and the Eiffel Tower, which glows
   gold after dark with its searchlight and sparkles for the first
   5 minutes of every hour at night, like the real one.
   Beirut: the city, Mount Lebanon with village lights at night,
   Raouché (Pigeon Rocks) in the Mediterranean, and a cedar.

   Each sky follows that city's real time (sunrise, sunset, night).
   Switch with SKYLINE.setCity('paris' | 'beirut').
   Preview a time of day with ?time=dawn|day|sunset|night
════════════════════════════════════════ */
const SKYLINE = (() => {
  const PX = 3;     // screen pixels per art pixel
  const PAD = 10;   // extra art pixels on each side of a layer, room for mouse parallax

  const CITIES = {
    paris:  { tz: 'Europe/Paris', lon: 2.35, amp: 4.1, seed: 1789 },
    beirut: { tz: 'Asia/Beirut',  lon: 35.5, amp: 2.4, seed: 1943 },
  };
  let city = localStorage.getItem('pnt-city') === 'beirut' ? 'beirut' : 'paris';

  // Deterministic random so each city looks the same on every visit
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ─── Time of day in the current city ──── */
  const PREVIEW = new URLSearchParams(location.search).get('time');

  function cityClock() {
    const cfg = CITIES[city];
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
    return { hour, minute, sunrise, sunset, month: now.getMonth() };
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
  let cloudiness = 0.35, grey = 0;      // live Paris weather
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

  function buildBeirut(r) {
    const ground = H - Math.round(H * 0.17);   // the Mediterranean below this line
    // Mount Lebanon ridge
    const ridge = [];
    const p1 = r() * 6, p2 = r() * 6;
    for (let x = -PAD; x < W + PAD; x++) {
      ridge.push(Math.round(H * (0.2 + 0.07 * Math.sin(x * 0.012 + p1) + 0.035 * Math.sin(x * 0.041 + p2) + 0.012 * Math.sin(x * 0.13))));
    }
    const villages = [];
    for (let i = 0; i < W / 4; i++) {
      const x = Math.floor(r() * (W + PAD * 2)) - PAD;
      const top = ground - ridge[x + PAD];
      villages.push({ x, y: Math.round(top + 3 + r() * (ground - top - 6)), p: r() * 6 });
    }
    // City along the coast on the left; the rocks out at sea on the right
    const cityEnd = Math.round(W * (W > 240 ? 0.6 : 0.45));
    const near = [];
    for (let x = -PAD; x < cityEnd; ) {
      const tall = r() < 0.3;
      const w = 7 + Math.floor(r() * 10), h = Math.round(H * (tall ? 0.22 + r() * 0.12 : 0.08 + r() * 0.12));
      near.push({ x, w, h, tone: r(), windows: windowsFor(r, w, h, 2, 3, 0.6) });
      x += w + (r() < 0.25 ? 1 : 0);
    }
    return {
      ground, ridge, villages, near,
      rockX: Math.round(W * (W > 240 ? 0.84 : 0.78)),
      rockH: Math.round(H * 0.2),
      cedarX: cityEnd + Math.round(W * 0.035),
    };
  }

  function build() {
    const r = rng(CITIES[city].seed);
    const base = city === 'beirut' ? buildBeirut(r) : buildParis(r);
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

  /* ─── Beirut landmarks ─────────────────── */
  // Raouché: a massive limestone rock with steep cliffs and a natural arch
  // at the waterline, and a smaller rock beside it
  function raouche(t, x0, base, h, col) {
    const w = Math.round(h * 0.95);
    const archL = -Math.round(w * 0.32), archR = Math.round(w * 0.08), archH = h * 0.42;
    for (let row = 0; row < h; row++) {
      const f = row / h, y = base - row;
      // Steep sides, a slightly rounded, uneven top
      const left = -w / 2 + Math.round(Math.pow(f, 2.2) * w * 0.12) + (Math.sin(row * 0.9) > 0.7 ? 1 : 0);
      const right = w / 2 - Math.round(Math.pow(f, 3) * w * 0.28);
      for (let dx = Math.round(left); dx <= Math.round(right); dx++) {
        // The arch: a rounded opening near the bottom
        const mid = (archL + archR) / 2, half = (archR - archL) / 2;
        if (dx > archL && dx < archR && row < archH * Math.sqrt(Math.max(0, 1 - ((dx - mid) / half) ** 2))) continue;
        const strata = row % 6 === 0 || (row % 6 === 3 && (dx + row) % 4 === 0);
        t.fillStyle = dx > right - w * 0.22 ? col.light : strata ? col.dark : col.rock;
        t.fillRect(x0 + dx, y, 1, 1);
      }
    }
    // Smaller rock to the left
    const sx = x0 - Math.round(w * 0.95), sh = Math.round(h * 0.42), sw = w * 0.3;
    for (let row = 0; row < sh; row++) {
      const half = sw * (1 - Math.pow(row / sh, 2.5) * 0.55);
      t.fillStyle = row % 5 === 0 ? col.dark : col.rock;
      t.fillRect(sx - Math.round(half), base - row, Math.round(half * 2), 1);
      t.fillStyle = col.light;
      t.fillRect(sx + Math.round(half) - 2, base - row, 2, 1);
    }
  }

  // A Lebanese cedar: short trunk, broad flat tiers of branches, wide flat top
  function cedar(t, x0, base, h, col) {
    const trunkH = Math.round(h * 0.3);
    t.fillStyle = col.trunk;
    t.fillRect(x0 - 1, base - trunkH, 3, trunkH);
    t.fillRect(x0 - 3, base - Math.round(trunkH * 0.55), 2, 1);   // a low branch
    const tiers = [
      { y: 0.3,  half: 0.62, th: 4 },
      { y: 0.46, half: 0.72, th: 5 },
      { y: 0.63, half: 0.6,  th: 4 },
      { y: 0.78, half: 0.48, th: 4 },
      { y: 0.92, half: 0.4,  th: 3 },   // the flat crown
    ];
    for (const [i, tier] of tiers.entries()) {
      const yb = base - Math.round(h * tier.y);
      const half = Math.round(h * tier.half);
      const lean = i % 2 ? 2 : -1;   // tiers sit a little off-centre, like a real cedar
      for (let r = 0; r < tier.th; r++) {
        const shrink = r === tier.th - 1 ? 3 : r === 0 ? 1 : 0;   // soft rounded ends
        t.fillStyle = r === tier.th - 1 ? col.leafLight : col.leaf;
        t.fillRect(x0 + lean - half + shrink, yb - r, (half - shrink) * 2, 1);
      }
      // Drooping tips at the ends of each tier
      t.fillStyle = col.leaf;
      t.fillRect(x0 + lean - half, yb + 1, 2, 1);
      t.fillRect(x0 + lean + half - 2, yb + 1, 2, 1);
    }
  }

  /* ─── Static layers (refreshed every few seconds) ── */
  function clearLayer(L) { L.ctx.clearRect(-PAD, 0, W + PAD * 2, H); return L.ctx; }

  function renderLayers() {
    if (!scene) return;
    lastRender = performance.now();
    const clock = cityClock();
    const e = sunElevation(clock);
    const dark = clamp01((0.08 - e) / 0.3);   // 0 day … 1 night
    const g = city === 'paris' ? grey : 0;    // live weather is for Paris
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

    if (city === 'paris') {
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
    } else {
      // Mount Lebanon, snow-capped in winter
      const mountain = css(mix(mix(bottom, [70, 74, 110], 0.5), [16, 16, 32], dark * 0.75));
      const snowCol = css(mix([235, 240, 250], [70, 76, 100], dark));
      const snow = [11, 0, 1, 2, 3].includes(clock.month);
      for (let i = 0; i < scene.ridge.length; i++) {
        const x = i - PAD, peak = scene.ridge[i];
        far.fillStyle = mountain;
        far.fillRect(x, ground - peak, 1, peak);
        if (snow && peak > H * 0.24) {
          far.fillStyle = snowCol;
          far.fillRect(x, ground - peak, 1, Math.round((peak - H * 0.24) * 0.8) + 1);
        }
      }

      // Raouché out at sea, a cedar on the coast
      raouche(lm, scene.rockX, ground + 3, scene.rockH, {
        rock: css(mix([196, 160, 118], [52, 42, 46], dark)),
        light: css(mix([222, 192, 150], [70, 56, 56], dark)),
        dark: css(mix([150, 116, 84], [36, 30, 34], dark)),
      });
      cedar(lm, scene.cedarX, ground, Math.round(H * 0.15), {
        trunk: css(mix([92, 64, 44], [30, 22, 20], dark)),
        leaf: css(mix([46, 104, 62], [14, 34, 24], dark)),
        leafLight: css(mix([84, 150, 92], [24, 52, 36], dark)),
      });

      // Beirut's towers
      const pane = css(mix([70, 90, 118], [12, 14, 24], dark));
      for (const b of scene.near) {
        const wall = mix(mix([168, 160, 150], [120, 128, 142], b.tone), [24, 22, 36], dark);
        const bt = ground - b.h;
        near.fillStyle = css(wall);
        near.fillRect(b.x, bt, b.w, b.h);
        near.fillStyle = css(mix(wall, [0, 0, 0], 0.18));
        near.fillRect(b.x + b.w - 1, bt, 1, b.h);
        for (const w of b.windows) {
          if (dark > 0.4 && Math.random() < 0.04) w.on = !w.on;
          near.fillStyle = winLit(w, 'rgba(255,200,120,0.95)', 'rgba(200,225,255,0.85)') || pane;
          near.fillRect(b.x + w.x, bt + w.y, 1, 1);
        }
      }
    }

    const cloudCol = mix(mix([248, 250, 255], [255, 170, 150], Math.max(0, 1 - Math.abs(e) * 8) * 0.8), [40, 44, 62], dark);
    look = {
      e, dark, top, sun, moon,
      sparkle: city === 'paris' && dark > 0.6 && clock.minute < 5,
      night: e < 0.02,
      starAlpha: dark * (1 - g * 0.8),
      cloud: css(cloudCol, 0.55 + g * 0.3),
      clouds: city === 'paris' ? cloudiness : 0.3,
      water: css(mix(mix(bottom, [20, 30, 60], 0.6), [6, 8, 18], dark)),
      bank: css(mix(mix([96, 92, 110], [22, 20, 36], dark), [255, 255, 255], 0.1)),
      seaTop: css(mix(mix(bottom, [30, 110, 160], 0.55), [8, 14, 32], dark)),
      seaBottom: css(mix([16, 70, 120], [4, 8, 20], dark)),
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
    if (city === 'paris') drawParis(now, shift);
    else drawBeirut(now, shift);
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

  function drawBeirut(now, shift) {
    const { ground } = scene;
    const { dark } = look;

    // Village lights twinkling on Mount Lebanon
    if (dark > 0.4) {
      for (const v of scene.villages) {
        c.fillStyle = `rgba(255,205,130,${dark * (0.45 + 0.4 * Math.abs(Math.sin(now / 900 + v.p)))})`;
        c.fillRect(v.x + shift(8), v.y, 1, 1);
      }
    }
    c.drawImage(layers.near.el, shift(16) - PAD, 0);

    // The Mediterranean, with the sun or moon reflecting on it
    const sea = c.createLinearGradient(0, ground, 0, H);
    sea.addColorStop(0, look.seaTop);
    sea.addColorStop(1, look.seaBottom);
    c.fillStyle = sea;
    c.fillRect(0, ground, W, H - ground);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = ground + 2; y < H; y += 3) {
      for (let x = (y * 5) % 9; x < W; x += 9) {
        if (Math.sin(x * 0.4 + y + now / 700) > 0.6) c.fillRect(x, y, 3, 1);
      }
    }
    const light = look.moon ? { x: look.moon.x, col: `rgba(255,240,205,${0.5 * dark})` } : look.sun ? { x: look.sun.x, col: 'rgba(255,220,160,0.55)' } : null;
    if (light) {
      c.fillStyle = light.col;
      for (let y = ground + 1; y < H; y += 2) {
        if (Math.sin(y * 2.1 + now / 250) < -0.3) continue;
        const w = 2 + (y - ground) * 0.35;
        c.fillRect(Math.round(light.x - w / 2 + Math.sin(y * 1.3 + now / 300) * 2), y, Math.round(w), 1);
      }
    }
    // Raouché and the cedar sit in front of the water
    c.drawImage(layers.landmark.el, shift(14) - PAD, 0);
  }

  /* ─── Public API ───────────────────────── */
  function start(el) {
    canvas = el;
    c = canvas.getContext('2d');
    if (!c) return false;
    document.body.classList.toggle('city-beirut', city === 'beirut');
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

  function setCity(name) {
    if (!CITIES[name] || name === city) return false;
    city = name;
    localStorage.setItem('pnt-city', name);
    document.body.classList.toggle('city-beirut', city === 'beirut');
    resize();
    document.dispatchEvent(new CustomEvent('pnt:city', { detail: { city } }));
    return true;
  }

  return { start, setWeather, setCity, getCity: () => city };
})();
