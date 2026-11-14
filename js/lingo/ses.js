/* VitaLingo — Web Audio sesleri (dosya yok): tuş, harf açılışı (yeşil/sarı/gri farklı ton), doğru bilme, hata, ipucu, pas. */
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
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  return {
    unlock: () => ac(),
    get muted() { return muted; },
    setMuted(m) { muted = m; try { localStorage.setItem(storageKey, m ? "1" : "0"); } catch (_) {} if (ctx) { try { m ? ctx.suspend() : ctx.resume(); } catch (_) {} } },
    key() { tone(680, 0.04, "triangle", 0.045); },
    del() { tone(360, 0.05, "triangle", 0.04); },
    flip(state, i) { const base = state === "hit" ? 880 : state === "near" ? 660 : 330; tone(base + i * 18, 0.11, state === "miss" ? "sine" : "triangle", state === "miss" ? 0.04 : 0.07); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, "triangle", 0.08, 0, i * 0.08)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.28, "sawtooth", 0.035, 0, i * 0.14)); },
    bad() { tone(200, 0.16, "square", 0.04, 140); },
    hint() { tone(988, 0.22, "sine", 0.07, 1480); },
    pass() { tone(520, 0.15, "triangle", 0.05, 300); }
  };
}
