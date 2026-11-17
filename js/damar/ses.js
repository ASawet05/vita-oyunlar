/* Damar Yolu Koşucusu — tüm sesler Web Audio API ile sentezlenir (ses dosyası yok).
   Tek seferlik efektler + iki sürekli döngü: jetpack motoru ve damar akışı (hıza göre açılan uğultu). */
let ctx = null, master = null, comp = null, on = true, noiseBuf = null, brownBuf = null;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31]; // majör pentatonik, iki oktavdan fazla

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = on ? 0.55 : 0; master.connect(comp);
    const n = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    brownBuf = ctx.createBuffer(1, n * 2, n); const b = brownBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.2; }
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
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, { vol = 0.2, f0 = 800, f1 = 2400, q = 1, type = "bandpass", delay = 0, attack = 0.004 } = {}) {
  const c = ac(); if (!c || !on) return;
  const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

/* ---- Sürekli döngüler ---- */
let jet = null, flow = null;
function startJet() {
  const c = ac(); if (!c || jet) return;
  const g = c.createGain(); g.gain.value = 0.0001; g.connect(master);
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 2;
  const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = 55;
  const og = c.createGain(); og.gain.value = 0.18;
  const lfo = c.createOscillator(); lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency);
  s.connect(f); f.connect(g); o.connect(og); og.connect(f);
  s.start(); o.start(); lfo.start();
  g.gain.setTargetAtTime(0.32, c.currentTime, 0.12);
  jet = { g, s, o, lfo, f };
}
function stopJet() {
  if (!jet || !ctx) { jet = null; return; }
  const j = jet; jet = null; const t = ctx.currentTime;
  j.g.gain.setTargetAtTime(0.0001, t, 0.18); j.f.frequency.setTargetAtTime(200, t, 0.3);
  for (const n of [j.s, j.o, j.lfo]) n.stop(t + 1);
}
function ensureFlow() {
  const c = ac(); if (!c || flow) return;
  const g = c.createGain(); g.gain.value = 0.0001; g.connect(master);
  const s = c.createBufferSource(); s.buffer = brownBuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 260; f.Q.value = 0.7;
  s.connect(f); f.connect(g); s.start();
  flow = { g, f };
}

export const Ses = {
  unlock() { ac(); },
  setOn(v) { on = !!v; if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.03); if (!on) stopJet(); },
  get on() { return on; },
  /* Ardışık her vitaminde nota yükselir; seri 12'yi geçince oktav döner */
  collect(streak, rare) {
    const i = Math.min(SCALE.length - 1, streak % SCALE.length), n = 72 + SCALE[i];
    tone(midi(n), 0.16, { type: "triangle", vol: rare ? 0.26 : 0.2 }); tone(midi(n + 12), 0.12, { vol: rare ? 0.12 : 0.06, delay: 0.025 });
  },
  jump() { noise(0.26, { vol: 0.17, f0: 450, f1: 2600, q: 0.8 }); tone(240, 0.16, { to: 480, vol: 0.06 }); },
  roll() { noise(0.45, { vol: 0.2, f0: 2200, f1: 260, q: 0.6, attack: 0.03 }); tone(160, 0.3, { to: 90, vol: 0.06, type: "triangle" }); },
  fastFall() { noise(0.18, { vol: 0.2, f0: 3000, f1: 500, q: 0.9 }); },
  land(hard) { tone(hard ? 120 : 150, 0.1, { to: 60, vol: hard ? 0.2 : 0.12 }); noise(0.08, { vol: 0.08, f0: 900, f1: 200, q: 0.6 }); },
  lane() { noise(0.1, { vol: 0.07, f0: 1300, f1: 2600, q: 1.4 }); },
  ramp() { tone(200, 0.35, { to: 520, vol: 0.09, type: "triangle" }); },
  smash() { noise(0.4, { vol: 0.42, f0: 2800, f1: 160, q: 0.4 }); tone(110, 0.32, { to: 38, vol: 0.34 }); tone(880, 0.14, { to: 260, vol: 0.09, type: "square" }); },
  stumble() { tone(210, 0.24, { to: 80, vol: 0.28, type: "sawtooth" }); noise(0.22, { vol: 0.2, f0: 700, f1: 140, q: 0.5 }); },
  crash() { noise(0.5, { vol: 0.42, f0: 1600, f1: 90, q: 0.4 }); tone(150, 0.45, { to: 45, vol: 0.32, type: "sawtooth" }); },
  growl() { tone(70, 0.7, { to: 46, vol: 0.22, type: "sawtooth", attack: 0.08 }); tone(104, 0.6, { to: 70, vol: 0.12, type: "square", attack: 0.1 }); noise(0.6, { vol: 0.12, f0: 300, f1: 120, q: 2, attack: 0.1 }); },
  power() { [0, 4, 7, 12].forEach((s, i) => tone(midi(72 + s), 0.15, { type: "triangle", vol: 0.17, delay: i * 0.06 })); },
  shield() { tone(330, 0.38, { to: 990, vol: 0.15, type: "triangle" }); noise(0.32, { vol: 0.08, f0: 900, f1: 5200, q: 2 }); },
  shieldBreak() { tone(990, 0.3, { to: 220, vol: 0.14, type: "triangle" }); noise(0.3, { vol: 0.14, f0: 5000, f1: 700, q: 1.5 }); },
  frenzy() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(midi(67 + s), 0.18, { type: "square", vol: 0.08, delay: i * 0.05 })); },
  mission() { [0, 7, 12].forEach((s, i) => tone(midi(76 + s), 0.2, { type: "triangle", vol: 0.16, delay: i * 0.09 })); },
  piggy() { [0, 4, 7, 12, 16].forEach((s, i) => { tone(midi(84 + s), 0.12, { type: "triangle", vol: 0.12, delay: i * 0.07 }); tone(midi(96 + s), 0.06, { vol: 0.05, delay: i * 0.07 + 0.02 }); }); },
  zone() { tone(midi(60), 0.6, { type: "triangle", vol: 0.13 }); tone(midi(67), 0.6, { type: "triangle", vol: 0.11, delay: 0.14 }); tone(midi(72), 0.8, { vol: 0.12, delay: 0.28 }); noise(1.2, { vol: 0.06, f0: 300, f1: 3000, q: 0.5, attack: 0.4 }); },
  /* Kalp atışı "lub-dub"; çağıran taraf tehdit yaklaştıkça aralığı kısaltır */
  heart(intensity = 0.5) { const v = 0.22 + 0.22 * intensity; tone(62, 0.14, { to: 40, vol: v }); tone(54, 0.12, { to: 36, vol: v * 0.75, delay: 0.14 }); },
  tick(last) { tone(last ? 990 : 660, 0.09, { type: "square", vol: 0.08 }); },
  burst() { noise(0.7, { vol: 0.35, f0: 200, f1: 6000, q: 0.5, attack: 0.02 }); tone(110, 0.6, { to: 880, vol: 0.18, type: "triangle" }); [0, 7, 12, 19].forEach((s, i) => tone(midi(72 + s), 0.25, { type: "triangle", vol: 0.1, delay: 0.1 + i * 0.05 })); },
  over() { tone(330, 0.55, { to: 82, vol: 0.28, type: "sawtooth" }); noise(0.6, { vol: 0.22, f0: 1200, f1: 80, q: 0.4 }); },
  start() { [0, 7, 12, 16].forEach((s, i) => tone(midi(64 + s), 0.16, { type: "triangle", vol: 0.12, delay: i * 0.07 })); noise(0.8, { vol: 0.1, f0: 300, f1: 2400, q: 0.5, attack: 0.2 }); },
  click() { tone(660, 0.05, { vol: 0.1, type: "triangle" }); },
  buy() { [0, 5, 12].forEach((s, i) => tone(midi(79 + s), 0.12, { type: "triangle", vol: 0.16, delay: i * 0.07 })); },
  upgrade() { [0, 4, 7, 11, 14].forEach((s, i) => tone(midi(74 + s), 0.14, { type: "triangle", vol: 0.14, delay: i * 0.06 })); },
  deny() { tone(180, 0.14, { vol: 0.16, type: "square" }); },
  jet(onOff) { if (!on) return; onOff ? startJet() : stopJet(); },
  /* Damar akışı uğultusu: hız 0..1 */
  flow(level) {
    if (!ctx || !on) { if (flow && ctx) flow.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); return; }
    ensureFlow(); if (!flow) return;
    flow.g.gain.setTargetAtTime(level <= 0 ? 0.0001 : 0.05 + 0.1 * level, ctx.currentTime, 0.4);
    flow.f.frequency.setTargetAtTime(180 + 420 * level, ctx.currentTime, 0.4);
  }
};
