/* ════════════════════════════════════════
   Byte Runner — a tiny endless runner.
   Jump over bugs, don't jump into drones.
════════════════════════════════════════ */
const GAME = (() => {
  // Pixel sprites as [x, y, w, h, colour] in sprite pixels (same art as the desktop critters)
  const BYTE = [
    [7, 0, 2, 2, '#ff334d'], [7, 2, 2, 1, '#6b7799'],
    [2, 5, 1, 3, '#aab3c8'], [13, 5, 1, 3, '#aab3c8'],
    [3, 3, 10, 7, '#dde3ef'], [4, 4, 8, 5, '#0c1020'],
    [6, 5, 2, 2, '#4ade80'], [10, 5, 2, 2, '#4ade80'], [7, 8, 4, 1, '#2f9e5a'],
    [2, 10, 2, 3, '#aab3c8'], [12, 10, 2, 3, '#aab3c8'],
    [4, 10, 8, 4, '#ff334d'], [7, 11, 2, 2, '#ff8c42'],
  ];
  const BYTE_LEGS = [[[5, 14, 2, 2], [9, 13, 2, 2]], [[5, 13, 2, 2], [9, 14, 2, 2]]];
  const BUG = [
    [2, 3, 5, 4, '#a3e635'], [4, 3, 1, 4, '#4d7c0f'], [2, 4, 1, 1, '#4d7c0f'], [6, 5, 1, 1, '#4d7c0f'],
    [7, 4, 2, 2, '#1a2e05'], [9, 3, 1, 1, '#1a2e05'], [9, 6, 1, 1, '#1a2e05'],
  ];
  const BUG_LEGS = [[[3, 2, 1, 1], [5, 7, 1, 1]], [[5, 2, 1, 1], [3, 7, 1, 1]]];
  const DRONE = [
    [7, 1, 2, 1, '#6b7799'], [4, 2, 8, 1, '#8b95b5'], [3, 3, 10, 6, '#8b95b5'], [4, 9, 8, 1, '#8b95b5'],
    [3, 3, 10, 1, '#aab3c8'], [4, 4, 8, 3, '#0c1020'], [6, 5, 2, 1, '#ff334d'],
    [2, 5, 1, 2, '#ff8c42'], [13, 5, 1, 2, '#ff8c42'], [5, 8, 6, 1, '#ff8c42'],
  ];

  const PX = 3;                 // screen pixels per sprite pixel
  const H = 260;                // logical canvas height
  const GROUND = H - 34;        // y of the ground line
  const GRAVITY = 2300, JUMP_V = 760;
  const BEST_KEY = 'pnt-runner-best';

  function drawSprite(c, rects, x, y, flip = false, w = 16) {
    for (const [rx, ry, rw, rh, col] of rects) {
      c.fillStyle = col;
      const sx = flip ? w - rx - rw : rx;
      c.fillRect(Math.round(x + sx * PX), Math.round(y + ry * PX), rw * PX, rh * PX);
    }
  }

  function create(win) {
    const wrap = document.createElement('div');
    wrap.className = 'game';
    wrap.innerHTML = `<canvas class="game-canvas" aria-label="Byte Runner game. Press space or tap to jump."></canvas>
      <p class="game-help">space / ↑ / tap to jump · jump over 🐛 bugs · don't jump into drones</p>`;
    const canvas = wrap.querySelector('canvas');
    const c = canvas.getContext('2d');
    let W = 600;

    function resize() {
      W = Math.max(280, wrap.clientWidth);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = `${H}px`;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = false;
    }
    new ResizeObserver(resize).observe(wrap);

    // Background: stars + Paris skyline (generated once)
    const stars = Array.from({ length: 60 }, () => ({ x: Math.random() * 2000, y: Math.random() * (GROUND - 90), t: Math.random() * 6 }));
    const buildings = Array.from({ length: 30 }, (_, i) => {
      const w = 40 + Math.random() * 40, h = 30 + Math.random() * 50;
      // A few lit windows per building
      const lights = Array.from({ length: 4 }, () => ({ x: 6 + Math.random() * (w - 14), y: 8 + Math.random() * (h - 16) }));
      return { x: i * 70 + Math.random() * 30, w, h, lights };
    });

    let best = +localStorage.getItem(BEST_KEY) || 0;
    let state = 'ready', paused = false;
    let byte, obstacles, speed, score, distance, nextSpawn, frame, flash, lastMilestone, groundOffset;

    function reset() {
      byte = { x: 60, y: GROUND - 16 * PX, vy: 0, onGround: true };
      obstacles = [];
      speed = 320;
      score = 0;
      distance = 0;
      nextSpawn = 500;
      frame = 0;
      flash = 0;
      lastMilestone = 0;
      groundOffset = 0;
    }
    reset();

    function jump() {
      if (state === 'ready' || state === 'over') {
        reset();
        state = 'running';
        FX.sfx.open();
        return;
      }
      if (byte.onGround) {
        byte.vy = -JUMP_V;
        byte.onGround = false;
        FX.sfx.tick();
      }
    }

    function spawn() {
      const flying = distance > 1500 && Math.random() < 0.3;
      if (flying) {
        // Hovers at jump height: stay on the ground to pass under it
        obstacles.push({ type: 'drone', x: W + 20, y: GROUND - 16 * PX - 14 * PX - 6, w: 16 * PX, h: 10 * PX });
      } else {
        const count = 1 + (Math.random() < 0.35 ? 1 : 0) + (distance > 3000 && Math.random() < 0.25 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          obstacles.push({ type: 'bug', x: W + 20 + i * 10 * PX, y: GROUND - 8 * PX, w: 8 * PX, h: 6 * PX });
        }
      }
      // Gap grows with speed so it always stays jumpable
      nextSpawn = speed * (0.75 + Math.random() * 0.9) + 180;
    }

    function hit(o) {
      const bx = byte.x + 4 * PX, by = byte.y + 3 * PX, bw = 8 * PX, bh = 12 * PX;
      const ox = o.x + 2 * PX, oy = o.y + (o.type === 'bug' ? 3 * PX : 2 * PX);
      return bx < ox + o.w && bx + bw > ox && by < oy + o.h && by + bh > oy;
    }

    function gameOver() {
      state = 'over';
      flash = 1;
      FX.sfx.error();
      FX.sfx.bonk();
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
      }
      if (score >= 300) LIFE.unlock('gamer');
      LIFE.pet.say(score >= 300 ? `${score} points! I'm a natural 😎` : 'I died in there?! 😵', 3000);
    }

    function update(dt) {
      if (state !== 'running') return;
      speed = Math.min(760, speed + 9 * dt);
      const dx = speed * dt;
      distance += dx;
      score = Math.floor(distance / 10);
      groundOffset = (groundOffset + dx) % 24;

      if (score - lastMilestone >= 100) {
        lastMilestone = score - (score % 100);
        FX.sfx.notify();
        flash = 0.4;
      }

      byte.vy += GRAVITY * dt;
      byte.y += byte.vy * dt;
      if (byte.y >= GROUND - 16 * PX) {
        byte.y = GROUND - 16 * PX;
        byte.vy = 0;
        byte.onGround = true;
      }

      nextSpawn -= dx;
      if (nextSpawn <= 0) spawn();
      for (const o of obstacles) o.x -= dx * (o.type === 'drone' ? 1.15 : 1);
      obstacles = obstacles.filter(o => o.x > -80);
      if (obstacles.some(hit)) gameOver();
    }

    function draw(t) {
      // Sky
      const sky = c.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#05070d');
      sky.addColorStop(1, '#1a0d1a');
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);

      // Stars (slow parallax)
      for (const s of stars) {
        const x = ((s.x - distance * 0.03) % 2000 + 2000) % 2000;
        if (x > W) continue;
        c.fillStyle = `rgba(221,227,239,${0.25 + 0.35 * Math.abs(Math.sin(t / 900 + s.t))})`;
        c.fillRect(x, s.y, 2, 2);
      }
      // Moon
      c.fillStyle = '#ffe9c4';
      c.beginPath();
      c.arc(W - 70, 46, 16, 0, Math.PI * 2);
      c.fill();

      // Skyline + Eiffel Tower (medium parallax)
      const span = 2100;
      const off = (distance * 0.18) % span;
      for (const b of buildings) {
        const x = ((b.x - off) % span + span) % span - 60;
        if (x > W) continue;
        c.fillStyle = '#251a36';
        c.fillRect(x, GROUND - b.h, b.w, b.h);
        c.fillStyle = 'rgba(255,200,120,0.55)';
        for (const l of b.lights) c.fillRect(x + l.x, GROUND - b.h + l.y, 3, 4);
      }
      const tx = ((900 - off) % span + span) % span - 100;
      if (tx < W + 100) drawTower(tx, GROUND);

      // Ground
      c.fillStyle = '#0c1020';
      c.fillRect(0, GROUND, W, H - GROUND);
      c.fillStyle = '#ff334d';
      c.fillRect(0, GROUND, W, 2);
      c.fillStyle = 'rgba(255,51,77,0.35)';
      for (let x = -groundOffset; x < W; x += 24) c.fillRect(x, GROUND + 10, 10, 2);

      // Obstacles
      const step = Math.floor(t / 110) % 2;
      for (const o of obstacles) {
        if (o.type === 'bug') {
          drawSprite(c, BUG, o.x, o.y, true, 10);
          for (const [lx, ly, lw, lh] of BUG_LEGS[step]) drawSprite(c, [[lx, ly, lw, lh, '#1a2e05']], o.x, o.y, true, 10);
        } else {
          const bob = Math.sin(t / 120) * 3;
          drawSprite(c, DRONE, o.x, o.y + bob, false);
          c.fillStyle = step ? '#aab3c8' : '#6b7799';
          c.fillRect(o.x + (step ? 2 : 5) * PX, o.y + bob, (step ? 12 : 6) * PX, PX);
        }
      }

      // Byte
      drawSprite(c, BYTE, byte.x, byte.y);
      const legs = state === 'running' && byte.onGround ? BYTE_LEGS[step] : BYTE_LEGS[0];
      for (const [lx, ly, lw, lh] of legs) drawSprite(c, [[lx, ly, lw, lh, '#6b7799']], byte.x, byte.y);

      // HUD
      c.font = '500 14px "DM Mono", monospace';
      c.textAlign = 'right';
      c.fillStyle = '#6b7799';
      c.fillText(`HI ${String(best).padStart(5, '0')}`, W - 110, 24);
      c.fillStyle = '#fff';
      c.fillText(String(score).padStart(5, '0'), W - 20, 24);

      if (flash > 0) {
        c.fillStyle = `rgba(255,51,77,${flash * 0.35})`;
        c.fillRect(0, 0, W, H);
      }

      // Overlays
      c.textAlign = 'center';
      if (state === 'ready') {
        banner('BYTE RUNNER', 'press space or tap to start');
      } else if (state === 'over') {
        banner('GAME OVER', score >= best && score > 0 ? `new high score: ${score}! · space to retry` : `score ${score} · space to retry`);
      } else if (paused) {
        banner('PAUSED', 'click the window to resume');
      }
    }

    function banner(title, sub) {
      c.fillStyle = 'rgba(5,7,13,0.55)';
      c.fillRect(0, H / 2 - 52, W, 92);
      c.font = `800 ${Math.min(30, Math.floor(W / 13))}px "Syne", sans-serif`;
      c.fillStyle = '#fff';
      c.fillText(title, W / 2, H / 2 - 8);
      c.font = '400 13px "DM Mono", monospace';
      c.fillStyle = '#ff8c42';
      c.fillText(sub, W / 2, H / 2 + 20);
    }

    function drawTower(x, base) {
      c.fillStyle = '#3a2850';
      c.beginPath();
      c.moveTo(x, base);
      c.lineTo(x + 30, base - 50);
      c.lineTo(x + 38, base - 120);
      c.lineTo(x + 42, base - 150);
      c.lineTo(x + 46, base - 120);
      c.lineTo(x + 54, base - 50);
      c.lineTo(x + 84, base);
      c.lineTo(x + 62, base);
      c.quadraticCurveTo(x + 42, base - 34, x + 22, base);
      c.closePath();
      c.fill();
      c.fillRect(x + 22, base - 54, 40, 4);
      c.fillRect(x + 32, base - 96, 20, 3);
      c.fillStyle = '#ff334d';
      c.fillRect(x + 41, base - 156, 2, 6);
    }

    // Input: only while this window is in front, so the terminal keeps its keys
    const onKey = e => {
      if (!wrap.isConnected) { document.removeEventListener('keydown', onKey); return; }
      if (!win.classList.contains('focused') || win.classList.contains('minimized')) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        jump();
      }
    };
    document.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); jump(); });

    let last = performance.now();
    (function loop(t) {
      if (!wrap.isConnected && last > 0 && frame > 1) return;   // window closed
      frame++;
      const dt = Math.min(0.04, (t - last) / 1000);
      last = t;
      paused = state === 'running' && (!win.classList.contains('focused') || win.classList.contains('minimized'));
      if (!paused) update(dt);
      flash = Math.max(0, flash - dt * 2);
      draw(t);
      requestAnimationFrame(loop);
    })(last);

    return wrap;
  }

  return { create };
})();
