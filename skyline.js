/* ════════════════════════════════════════
   PNT.OS wallpaper — a live pixel-art Paris skyline.
   The sky follows the real time in Paris (sunrise, sunset, night),
   windows light up after dark, and the Eiffel Tower glows gold with
   its searchlight — sparkling for the first 5 minutes of every hour
   at night, like the real one. Clouds follow the live weather.
   Preview a time of day with ?time=dawn|day|sunset|night
════════════════════════════════════════ */
const SKYLINE = (() => {
  const PX = 3;   // screen pixels per art pixel

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

  function parisClock() {
    const now = new Date();
    const part = type => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', [type]: 'numeric', hourCycle: 'h23' })
      .formatToParts(now).find(p => p.type === type).value;
    let hour = part('hour') + part('minute') / 60;
    let minute = part('minute');
    // Daylight saving: Paris is UTC+2 in summer, UTC+1 in winter
    const dst = ((part('hour') - now.getUTCHours() + 24) % 24) === 2;
    const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const dayLength = 12.2 + 4.1 * Math.sin((2 * Math.PI * (doy - 80)) / 365);
    const noon = 12.85 + (dst ? 1 : 0);
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
    const night = 24 - (sunset - sunrise);
    return -Math.sin(Math.PI * sinceSet / night);
  }

  /* ─── Colours ──────────────────────────── */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

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
  let cloudiness = 0.35, grey = 0;
  const mouse = { x: 0.5, tx: 0.5 };

  function build() {
    const r = rng(1789);
    const ground = H - 9;   // river below this line
    const towerX = Math.round(W * (W > 240 ? 0.8 : 0.55));
    const towerH = Math.round(Math.min(H * 0.58, W * 0.5));
    const towerHalf = Math.round(towerH * 0.21);

    const stars = Array.from({ length: Math.round(W * H / 260) }, () => ({ x: r() * W, y: r() * H * 0.7, p: r() * 6, s: r() < 0.12 ? 2 : 1 }));

    const far = [];
    for (let x = -10; x < W + 20; ) {
      const w = 8 + Math.floor(r() * 14), h = Math.round(H * (0.12 + r() * 0.12));
      far.push({ x, w, h });
      x += w - 1;
    }

    const near = [];
    for (let x = -6; x < W + 20; ) {
      const w = 14 + Math.floor(r() * 18), h = Math.round(H * (0.07 + r() * 0.11));
      // Leave the Champ de Mars open so the tower's legs show
      if (x + w > towerX - towerHalf - 6 && x < towerX + towerHalf + 6) { x = towerX + towerHalf + 7; continue; }
      const windows = [];
      for (let wy = 5; wy < h - 3; wy += 4) {
        for (let wx = 2; wx < w - 2; wx += 3) {
          windows.push({ x: wx, y: wy, on: r() < 0.55, warm: r() < 0.8 });
        }
      }
      near.push({ x, w, h, roof: 3 + Math.floor(r() * 2), chimneys: [Math.floor(r() * (w - 4)) + 2, Math.floor(r() * (w - 4)) + 2], windows });
      x += w + (r() < 0.2 ? 2 : 0);
    }

    const clouds = Array.from({ length: 7 }, (_, i) => ({ x: r() * W * 1.4, y: H * (0.08 + r() * 0.3), w: 18 + r() * 30, speed: 0.6 + r() * 1.2, puffs: Array.from({ length: 4 }, () => [r(), r()]), visible: i / 7 }));

    scene = { ground, towerX, towerH, towerHalf, stars, far, near, clouds };
  }

  function resize() {
    W = Math.ceil(canvas.clientWidth / PX);
    H = Math.ceil(canvas.clientHeight / PX);
    canvas.width = W;
    canvas.height = H;
    c.imageSmoothingEnabled = false;
    build();
  }

  /* ─── Drawing ──────────────────────────── */
  function drawTower(x0, base, h, half, e, now, sparkle) {
    const night = e < 0.02;
    const lit = Math.min(1, Math.max(0, (0.1 - e) / 0.25));
    const body = mix([58, 46, 66], [222, 160, 64], lit);
    const lattice = mix([40, 32, 48], [150, 96, 34], lit);
    const top = base - h;

    for (let row = 0; row <= h; row++) {
      const f = row / h;
      const hw = Math.max(0.6, half * Math.pow(1 - f, 2.3));
      const y = base - row;
      const platform = Math.abs(f - 0.19) < 0.012 || Math.abs(f - 0.47) < 0.01;
      for (let dx = -Math.ceil(hw + (platform ? 2 : 0)); dx <= Math.ceil(hw + (platform ? 2 : 0)); dx++) {
        // Arch between the legs
        if (f < 0.19 && !platform) {
          const archHalf = hw * 0.62 * Math.sqrt(Math.max(0, 1 - (f / 0.19) ** 2));
          if (Math.abs(dx) < archHalf) continue;
        }
        const edge = Math.abs(dx) > hw - 1;
        c.fillStyle = css(platform || edge || (row + dx) % 3 ? body : lattice);
        c.fillRect(x0 + dx, y, 1, 1);
      }
    }
    // Antenna
    c.fillStyle = css(body);
    c.fillRect(x0, top - 6, 1, 6);
    if (night) {
      c.fillStyle = Math.floor(now / 700) % 2 ? '#ff334d' : '#7a1020';
      c.fillRect(x0, top - 7, 1, 1);

      // Rotating searchlight
      const a = now / 2600;
      const len = W * 0.45;
      const reach = Math.cos(a);
      const g = c.createLinearGradient(x0, top, x0 + reach * len, top);
      g.addColorStop(0, 'rgba(255,236,170,0.32)');
      g.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x0, top - 3);
      c.lineTo(x0 + reach * len, top - 3 - len * 0.05);
      c.lineTo(x0 + reach * len, top - 3 + len * 0.05);
      c.closePath();
      c.fill();

      // Hourly sparkle
      if (sparkle) {
        for (let i = 0; i < h * 0.9; i++) {
          const row = Math.floor(Math.random() * h);
          const hw = half * Math.pow(1 - row / h, 2.3);
          c.fillStyle = Math.random() < 0.7 ? '#ffffff' : '#bfe3ff';
          c.fillRect(x0 + Math.round((Math.random() * 2 - 1) * hw), base - row, 1, 1);
        }
      }
    }
  }

  function draw(now) {
    if (!scene) return;
    const clock = parisClock();
    const e = sunElevation(clock);
    const dark = Math.min(1, Math.max(0, (0.08 - e) / 0.3));   // 0 day … 1 night
    const sparkle = dark > 0.6 && clock.minute < 5;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    const par = k => Math.round((mouse.x - 0.5) * k);
    const { ground, towerX, towerH, towerHalf } = scene;

    // Sky (greyer when it's cloudy or raining)
    let [top, bottom] = skyAt(e);
    if (grey) {
      const g = mix([110, 116, 128], [40, 44, 56], dark);
      top = mix(top, g, grey * 0.55);
      bottom = mix(bottom, g, grey * 0.55);
    }
    const sky = c.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, css(top));
    sky.addColorStop(1, css(bottom));
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // Stars
    if (dark > 0.2) {
      for (const s of scene.stars) {
        c.fillStyle = `rgba(230,236,255,${dark * (0.35 + 0.45 * Math.abs(Math.sin(now / 1300 + s.p))) * (1 - grey * 0.8)})`;
        c.fillRect(Math.round(s.x + par(4)), Math.round(s.y), s.s, s.s);
      }
    }

    // Sun by day, moon by night, moving across the sky
    const { hour, sunrise, sunset } = clock;
    if (e > -0.08) {
      const p = (hour - sunrise) / (sunset - sunrise);
      const sx = W * (0.08 + 0.84 * p), sy = ground - Math.max(-6, e) * H * 0.75 - 4;
      c.fillStyle = css(mix([255, 120, 70], [255, 236, 190], Math.min(1, Math.max(0, e * 3))), 0.95 * (1 - grey * 0.6));
      c.beginPath(); c.arc(sx, sy, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,200,120,0.12)';
      c.beginPath(); c.arc(sx, sy, 12, 0, Math.PI * 2); c.fill();
    }
    if (dark > 0.3) {
      const nightLen = 24 - (sunset - sunrise);
      const p = ((hour - sunset + 24) % 24) / nightLen;
      const mx = W * (0.1 + 0.8 * p), my = H * 0.12 + Math.abs(p - 0.5) * H * 0.35;
      c.fillStyle = `rgba(255,240,205,${dark})`;
      c.beginPath(); c.arc(mx, my, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = css(top);   // crescent
      c.beginPath(); c.arc(mx + 2, my - 1, 4.4, 0, Math.PI * 2); c.fill();
    }

    // Clouds drift with the wind; how many depends on the weather
    const cloudCol = mix(mix([248, 250, 255], [255, 170, 150], Math.max(0, 1 - Math.abs(e) * 8) * 0.8), [40, 44, 62], dark);
    for (const cl of scene.clouds) {
      if (cl.visible > cloudiness) continue;
      cl.x -= cl.speed * 0.012;
      if (cl.x + cl.w < -10) cl.x = W + 10;
      const x = Math.round(cl.x + par(6));
      c.fillStyle = css(cloudCol, 0.55 + grey * 0.3);
      c.fillRect(x, Math.round(cl.y), Math.round(cl.w), 3);
      for (const [px, py] of cl.puffs) {
        c.fillRect(x + Math.round(px * cl.w * 0.7), Math.round(cl.y - 2 - py * 3), Math.round(cl.w * 0.3), 3);
      }
    }

    // Far skyline (hazy)
    const farCol = mix(mix(bottom, [30, 26, 46], 0.55), [14, 12, 26], dark * 0.6);
    c.fillStyle = css(farCol);
    for (const b of scene.far) c.fillRect(b.x + par(8), ground - b.h, b.w, b.h);

    drawTower(towerX + par(12), ground, towerH, towerHalf, e, now, sparkle);

    // Haussmann buildings with mansard roofs and windows
    const wall = mix([96, 92, 110], [22, 20, 36], dark);
    const roof = mix([70, 80, 100], [16, 18, 30], dark);
    const pane = mix([60, 70, 92], [10, 12, 22], dark);
    for (const b of scene.near) {
      const x = b.x + par(16), top = ground - b.h;
      c.fillStyle = css(roof);
      c.fillRect(x + 1, top - b.roof, b.w - 2, b.roof);
      for (const ch of b.chimneys) c.fillRect(x + ch, top - b.roof - 2, 1, 2);
      c.fillStyle = css(wall);
      c.fillRect(x, top, b.w, b.h);
      for (const w of b.windows) {
        // Lights come on after dark and occasionally switch
        if (dark > 0.4 && Math.random() < 0.0004) w.on = !w.on;
        const lit = w.on && dark > 0.4;
        c.fillStyle = lit ? (w.warm ? 'rgba(255,196,110,0.95)' : 'rgba(190,215,255,0.85)') : css(pane);
        c.fillRect(x + w.x, top + w.y, 1, 2);
      }
    }

    // The Seine, with reflections of the lit city at night
    const water = mix(mix(bottom, [20, 30, 60], 0.6), [6, 8, 18], dark);
    c.fillStyle = css(water);
    c.fillRect(0, ground + 1, W, H - ground);
    c.fillStyle = css(mix(wall, [255, 255, 255], 0.1));
    c.fillRect(0, ground, W, 1);
    for (let x = 0; x < W; x += 2) {
      const n = Math.sin(x * 0.7 + now / 600) + Math.sin(x * 0.23 - now / 900);
      if (n > 1.1) {
        c.fillStyle = dark > 0.4 ? 'rgba(255,196,110,0.45)' : 'rgba(255,255,255,0.25)';
        c.fillRect(x, ground + 2 + ((x * 7) % (H - ground - 3)), 2, 1);
      }
    }
    if (dark > 0.4) {
      c.fillStyle = `rgba(222,160,64,${0.25 * dark})`;
      for (let i = 0; i < 6; i++) c.fillRect(towerX + par(12) - 2 + Math.round(Math.sin(now / 400 + i) * 2), ground + 2 + i, 4, 1);
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
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', ev => { mouse.tx = ev.clientX / window.innerWidth; }, { passive: true });

    if (FX.reduceMotion) {
      draw(performance.now());
      setInterval(() => draw(performance.now()), 60_000);
    } else {
      let last = 0;
      (function loop(now) {
        if (now - last > 33) {   // ~30 fps is plenty for pixel art
          last = now;
          draw(now);
        }
        requestAnimationFrame(loop);
      })(0);
    }
    return true;
  }

  // Called by friends.js once the live Paris weather is known
  function setWeather(kind) {
    cloudiness = { clear: 0.3, cloudy: 0.85, fog: 1, rain: 1, snow: 1, storm: 1 }[kind] ?? 0.35;
    grey = { clear: 0, cloudy: 0.35, fog: 0.7, rain: 0.6, snow: 0.45, storm: 0.85 }[kind] ?? 0;
  }

  return { start, setWeather };
})();
