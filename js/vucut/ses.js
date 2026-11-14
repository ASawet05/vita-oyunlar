/* Vücut Savunması — Web Audio ile kodla üretilen sesler (harici dosya yok). */
export function createAudio(storageKey) {
  let ctx = null, master = null, muted = false, lastShot = 0;
  try { muted = localStorage.getItem(storageKey) === "1"; } catch (_) {}
  function ac() {
    if (muted) return null;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (_) { return null; }
  }
  function tone(f, d, type = "sine", v = 0.1, slide = 0, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v = 0.1, f = 1500, type = "lowpass") {
    const c = ac(); if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * d)), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; fl.type = type; fl.frequency.value = f; g.gain.value = v; s.connect(fl); fl.connect(g); g.connect(master); s.start();
  }
  // Çok sık atışta sesler üst üste binip boğmasın
  const throttle = (fn) => () => { const n = performance.now(); if (n - lastShot < 45) return; lastShot = n; fn(); };
  return {
    unlock: () => ac(),
    get muted() { return muted; },
    setMuted(m) { muted = m; try { localStorage.setItem(storageKey, m ? "1" : "0"); } catch (_) {} if (ctx) try { m ? ctx.suspend() : ctx.resume(); } catch (_) {} },
    shoot: throttle(() => tone(720, 0.07, "triangle", 0.05, 420)),
    ice: throttle(() => { tone(1400, 0.09, "sine", 0.04, 900); tone(2100, 0.06, "sine", 0.02); }),
    pulse() { tone(90, 0.35, "sine", 0.14, 45); noise(0.25, 0.05, 700); },
    collect() { tone(988, 0.08, "sine", 0.07); tone(1318, 0.12, "sine", 0.06, 0, 0.06); },
    produce() { tone(660, 0.1, "triangle", 0.03, 990); },
    place() { tone(200, 0.12, "sine", 0.12, 140); tone(400, 0.05, "triangle", 0.04); },
    recycle() { tone(600, 0.15, "triangle", 0.06, 240); },
    deny() { tone(150, 0.1, "square", 0.04, 120); },
    hit() { noise(0.05, 0.035, 2500, "highpass"); },
    pop() { noise(0.14, 0.08, 1400); tone(320, 0.1, "triangle", 0.04, 120); },
    eat() { noise(0.06, 0.03, 600); },
    baseHit() { tone(220, 0.25, "sawtooth", 0.08, 110); tone(330, 0.25, "sawtooth", 0.05, 165, 0.12); },
    waveStart() { [392, 523, 659].forEach((f, i) => tone(f, 0.22, "triangle", 0.07, 0, i * 0.1)); },
    warning() { for (let i = 0; i < 3; i++) tone(660, 0.18, "square", 0.04, 440, i * 0.26); },
    waveDone() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "sine", 0.07, 0, i * 0.08)); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "triangle", 0.08, 0, i * 0.18)); }
  };
}
