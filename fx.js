/* ════════════════════════════════════════
   PNT.OS effects — synthesized sound,
   matrix rain and text decrypt
════════════════════════════════════════ */
const FX = (() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── Sound (Web Audio, no files) ──────── */
  let ctx = null;
  let muted = localStorage.getItem('pnt-sound') === 'off';

  function audio() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, { type = 'sine', dur = 0.12, vol = 0.08, delay = 0, slide } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur = 0.03, vol = 0.04, delay = 0, cutoff = 2000) {
    const a = audio();
    if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    const gain = a.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start(a.currentTime + delay);
  }

  const sfx = {
    powerOn() {
      tone(38, { dur: 0.7, vol: 0.4, slide: 90 });
      noise(0.3, 0.07, 0.02, 600);
      tone(110, { type: 'sawtooth', dur: 1.1, vol: 0.025, slide: 220, delay: 0.08 });
    },
    tick()    { tone(1500, { type: 'square', dur: 0.02, vol: 0.015 }); },
    key()     { noise(0.022, 0.05, 0, 2500); tone(170 + Math.random() * 60, { type: 'triangle', dur: 0.03, vol: 0.03 }); },
    granted() {
      tone(659, { dur: 0.2, vol: 0.07 });
      tone(988, { dur: 0.35, vol: 0.07, delay: 0.11 });
      tone(1319, { dur: 0.6, vol: 0.05, delay: 0.22 });
    },
    glitch()  { noise(0.12, 0.06, 0, 300); tone(90, { type: 'square', dur: 0.1, vol: 0.03 }); },
    whoosh()  { noise(0.5, 0.05, 0, 400); tone(240, { dur: 0.6, vol: 0.1, slide: 50 }); },
    open()    { tone(520, { dur: 0.09, vol: 0.045, slide: 900 }); },
    close()   { tone(700, { dur: 0.09, vol: 0.035, slide: 300 }); },
    error()   { tone(150, { type: 'square', dur: 0.14, vol: 0.035 }); },
    notify()  { tone(880, { dur: 0.12, vol: 0.05 }); tone(1320, { dur: 0.25, vol: 0.045, delay: 0.09 }); },
    bonk()    { tone(220, { type: 'triangle', dur: 0.12, vol: 0.08, slide: 110 }); },
    squash()  { noise(0.12, 0.08, 0, 800); tone(140, { dur: 0.15, vol: 0.08, slide: 60 }); },
    whirr()   { tone(180, { type: 'sawtooth', dur: 0.6, vol: 0.03, slide: 520 }); noise(0.5, 0.02, 0, 3000); },
    boop()    { tone(880, { type: 'square', dur: 0.07, vol: 0.025 }); tone(660, { type: 'square', dur: 0.09, vol: 0.025, delay: 0.09 }); },
    thunder() { noise(1.6, 0.14, 0, 20); tone(45, { dur: 1.4, vol: 0.2, slide: 30 }); },
    chirp()   { tone(900, { type: 'square', dur: 0.06, vol: 0.025, slide: 1500 }); tone(1300, { type: 'square', dur: 0.08, vol: 0.02, slide: 1800, delay: 0.08 }); },
  };

  function isMuted() { return muted; }
  function setMuted(value) {
    muted = value;
    localStorage.setItem('pnt-sound', value ? 'off' : 'on');
  }

  /* ─── Text decrypt ─────────────────────── */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  // Scrambles `text` into `el`, locking letters in from left to right
  function decrypt(el, text, duration = 1200, onTick) {
    return new Promise(resolve => {
      const start = performance.now();
      let lastTick = 0;
      function frame(now) {
        const p = Math.min(1, (now - start) / duration);
        const locked = Math.floor(p * text.length);
        el.textContent = [...text].map((ch, i) =>
          i < locked || /\s/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]
        ).join('');
        if (onTick && now - lastTick > 55) { onTick(); lastTick = now; }
        p < 1 ? requestAnimationFrame(frame) : resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  /* ─── Matrix rain ──────────────────────── */
  function matrix(host, duration = 6000) {
    const canvas = document.createElement('canvas');
    canvas.className = 'matrix';
    host.appendChild(canvas);
    const c = canvas.getContext('2d');
    canvas.width = host.clientWidth;
    canvas.height = host.clientHeight;

    const SIZE = 16;
    const CHARS = 'PNT01アイウエオカキクケコサシスセソ<>/{}=+*#$';
    const drops = Array.from({ length: Math.ceil(canvas.width / SIZE) }, () => Math.random() * -40);
    let running = true, last = 0;

    function frame(now) {
      if (!running) return;
      if (now - last > 45) {
        last = now;
        c.fillStyle = 'rgba(8,11,20,0.14)';
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.font = `${SIZE}px "DM Mono", monospace`;
        drops.forEach((y, i) => {
          const ch = CHARS[(Math.random() * CHARS.length) | 0];
          c.fillStyle = Math.random() > 0.96 ? '#fff' : (i % 4 ? '#ff334d' : '#ff8c42');
          c.fillText(ch, i * SIZE, y * SIZE);
          drops[i] = y * SIZE > canvas.height && Math.random() > 0.97 ? 0 : y + 1;
        });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const stop = () => {
      if (!running) return;
      running = false;
      canvas.classList.add('fade');
      setTimeout(() => canvas.remove(), 600);
    };
    canvas.addEventListener('click', stop);
    setTimeout(stop, duration);
  }

  return { sfx, isMuted, setMuted, decrypt, matrix, reduceMotion };
})();
