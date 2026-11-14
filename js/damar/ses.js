/* Damar Yolu Koşucusu — Web Audio ile kodla üretilen sesler (harici ses dosyası yok). */
export function createAudio(storageKey) {
  let ctx = null, master = null;
  let muted = false;
  try { muted = localStorage.getItem(storageKey) === "1"; } catch (_) {}

  function ac() {
    if (muted) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (_) { return null; }
  }
  function tone(freq, dur, type = "sine", vol = 0.12, slideTo = 0, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol = 0.12, freq = 1500, type = "lowpass", sweepTo = 0) {
    const c = ac(); if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.frequency.setValueAtTime(freq, c.currentTime);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur);
    g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  return {
    unlock: () => ac(),
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem(storageKey, m ? "1" : "0"); } catch (_) {}
      if (ctx) { try { m ? ctx.suspend() : ctx.resume(); } catch (_) {} }
    },
    drop() { const f = 880 + Math.random() * 220; tone(f, 0.09, "sine", 0.07, f * 1.5); },
    jump() { tone(300, 0.18, "triangle", 0.1, 620); },
    slide() { noise(0.22, 0.08, 2400, "bandpass", 600); },
    lane() { tone(520, 0.04, "sine", 0.03); },
    power() { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, "triangle", 0.07, 0, i * 0.05)); },
    shield() { [392, 523, 784].forEach((f, i) => tone(f, 0.35, "sine", 0.06, 0, i * 0.04)); },
    shieldBreak() { noise(0.3, 0.14, 3200, "highpass"); tone(700, 0.25, "triangle", 0.08, 200); },
    magnet() { tone(180, 0.4, "sawtooth", 0.035, 360); tone(270, 0.4, "sine", 0.05, 540); },
    sun() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, "sine", 0.06, 0, i * 0.06)); },
    turbo() { tone(160, 0.6, "sawtooth", 0.05, 900); noise(0.6, 0.06, 400, "bandpass", 3000); },
    smash() { noise(0.18, 0.13, 1800); tone(240, 0.12, "square", 0.04, 120); },
    level() { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.16, "triangle", 0.07, 0, i * 0.08)); },
    crash() { noise(0.6, 0.22, 900, "lowpass", 120); tone(110, 0.5, "sawtooth", 0.08, 40); }
  };
}
