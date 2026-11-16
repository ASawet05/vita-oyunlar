/* Damar Yolu Koşucusu — sesler tamamen Web Audio API ile sentezlenir (ses dosyası yok). */
let ctx = null, master = null, on = true, noiseBuf = null;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // majör pentatonik, iki oktav

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq, dur, { type = "sine", vol = 0.25, to = null, delay = 0, attack = 0.005 } = {}) {
  const c = ac(); if (!c || !on) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, f0 = 800, f1 = 2400, q = 1, type = "bandpass", delay = 0 } = {}) {
  const c = ac(); if (!c || !on) return;
  const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

export const Ses = {
  unlock() { ac(); },
  setOn(v) { on = !!v; if (master) master.gain.value = on ? 0.5 : 0; },
  get on() { return on; },
  /* Ardışık her vitaminde nota yükselir */
  collect(streak) { const i = Math.min(SCALE.length - 1, streak % 12 === 0 && streak ? SCALE.length - 1 : (streak % 11)); const n = 72 + SCALE[i]; tone(midi(n), 0.16, { type: "triangle", vol: 0.22 }); tone(midi(n + 12), 0.1, { vol: 0.06, delay: 0.02 }); },
  jump() { noise(0.22, { vol: 0.16, f0: 500, f1: 2600, q: 0.8 }); tone(260, 0.16, { to: 520, vol: 0.08 }); },
  superJump() { noise(0.35, { vol: 0.2, f0: 400, f1: 3600, q: 0.7 }); tone(220, 0.3, { to: 880, vol: 0.12, type: "triangle" }); },
  slide() { noise(0.4, { vol: 0.14, f0: 1800, f1: 300, q: 0.6 }); },
  land() { tone(140, 0.09, { to: 70, vol: 0.14 }); },
  lane() { noise(0.08, { vol: 0.06, f0: 1400, f1: 2200, q: 1.2 }); },
  tramp() { tone(180, 0.28, { to: 720, vol: 0.2, type: "square" }); tone(360, 0.2, { to: 1080, vol: 0.08, delay: 0.03 }); },
  smash() { noise(0.35, { vol: 0.4, f0: 2600, f1: 200, q: 0.4 }); tone(120, 0.3, { to: 40, vol: 0.35 }); tone(900, 0.12, { to: 300, vol: 0.1, type: "square" }); },
  stumble() { tone(200, 0.22, { to: 80, vol: 0.3, type: "sawtooth" }); noise(0.2, { vol: 0.2, f0: 600, f1: 150, q: 0.5 }); },
  power() { [0, 4, 7, 12].forEach((s, i) => tone(midi(72 + s), 0.14, { type: "triangle", vol: 0.18, delay: i * 0.06 })); },
  shield() { tone(330, 0.35, { to: 990, vol: 0.16, type: "triangle" }); noise(0.3, { vol: 0.08, f0: 900, f1: 5000, q: 2 }); },
  frenzy() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(midi(67 + s), 0.18, { type: "square", vol: 0.1, delay: i * 0.05 })); },
  mission() { [0, 7, 12].forEach((s, i) => tone(midi(76 + s), 0.2, { type: "triangle", vol: 0.16, delay: i * 0.09 })); },
  zone() { tone(midi(60), 0.5, { type: "triangle", vol: 0.14 }); tone(midi(67), 0.5, { type: "triangle", vol: 0.12, delay: 0.12 }); tone(midi(72), 0.6, { vol: 0.12, delay: 0.24 }); },
  /* Kalp atışı: "lub-dub"; çağıran taraf tehdit yaklaştıkça aralığı kısaltır */
  heart(intensity = 0.5) { const v = 0.22 + 0.2 * intensity; tone(62, 0.13, { to: 40, vol: v }); tone(54, 0.12, { to: 36, vol: v * 0.75, delay: 0.13 }); },
  over() { tone(330, 0.5, { to: 82, vol: 0.3, type: "sawtooth" }); noise(0.6, { vol: 0.25, f0: 1200, f1: 80, q: 0.4 }); },
  click() { tone(660, 0.05, { vol: 0.1, type: "triangle" }); },
  buy() { [0, 5, 12].forEach((s, i) => tone(midi(79 + s), 0.12, { type: "triangle", vol: 0.16, delay: i * 0.07 })); },
  deny() { tone(180, 0.14, { vol: 0.16, type: "square" }); }
};
