/* VitaKelime — Web Audio ile üretilen hafif sesler (dosya yok). Harf seçiminde yükselen tonlar, doğru/ekstra/hatalı kelime,
   ipucu, karıştırma, kumbara ve bölüm sonu fanfarı. */
export function createAudio(storageKey) {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem(storageKey) === "1"; } catch (_) {}
  function ac() {
    if (muted) return null;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (_) { return null; }
  }
  function tone(freq, dur, type = "sine", vol = 0.1, slideTo = 0, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175];
  return {
    unlock: () => ac(),
    get muted() { return muted; },
    setMuted(m) { muted = m; try { localStorage.setItem(storageKey, m ? "1" : "0"); } catch (_) {} if (ctx) { try { m ? ctx.suspend() : ctx.resume(); } catch (_) {} } },
    tap(i) { tone(SCALE[Math.min(SCALE.length - 1, i)], 0.09, "triangle", 0.07); },
    good() { [659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.08, 0, i * 0.07)); },
    extra() { [880, 1175].forEach((f, i) => tone(f, 0.14, "sine", 0.07, 0, i * 0.06)); },
    already() { tone(440, 0.12, "sine", 0.06); tone(440, 0.12, "sine", 0.05, 0, 0.12); },
    bad() { tone(220, 0.18, "square", 0.04, 150); },
    hint() { tone(988, 0.25, "sine", 0.07, 1480); },
    shuffle() { [0, 1, 2].forEach(i => tone(400 + i * 120, 0.06, "triangle", 0.05, 0, i * 0.04)); },
    piggy() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "sine", 0.07, 0, i * 0.08)); },
    win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.24, "triangle", 0.08, 0, i * 0.09)); }
  };
}
