/* VitaBlock — saf HTML5 Canvas + Vanilla JS (dış motor yok).
   8x8 hücre tahtası; altta 3 parça. Satır/sütun dolunca patlar; çoklu patlama = kombo çarpanı.
   Sinerji: aynı patlayan çizgide Fe + C → 2x ("C + Demir Sinerjisi"), D3 + K2 → 2x ("D3 + K2 Kemik Sinerjisi").
   Her 6 hamlede bir boş hücrede Serbest Radikal (toksin) belirir; satırı/sütunu patlatılınca temizlenir.
   Girdi: Pointer Events (dokunma + fare + kalem). Dokunmada parça parmağın ~56 px üstünde çizilir; farede imlecin merkezinde.
   Çizim: devicePixelRatio ölçekli tuval, önbelleğe alınmış hücre görüntüleri, yalnızca gerektiğinde çalışan animasyon döngüsü. */
(function () {
  "use strict";

  /* ---------------- Veri ---------------- */
  var N = 8;
  var TYPES = {
    fe: { name: "Demir", sym: "Fe", color: "#ef4444" },
    c: { name: "C vitamini", sym: "C", color: "#f97316" },
    d3: { name: "D3 vitamini", sym: "D₃", color: "#eab308" },
    k2: { name: "K2 vitamini", sym: "K₂", color: "#10b981" },
    su: { name: "Su", sym: "💧", color: "#06b6d4" },
    tox: { name: "Serbest radikal", sym: "R•", color: "#64748b" }
  };
  var KINDS = ["fe", "c", "d3", "k2", "su"];
  // Polyomino tanımları: [desen, ağırlık]
  var SHAPE_DEFS = [
    ["X", 3], ["XX", 3], ["X\nX", 3], ["XXX", 3], ["X\nX\nX", 3], ["XXXX", 2], ["X\nX\nX\nX", 2], ["XXXXX", 1], ["X\nX\nX\nX\nX", 1],
    ["XX\nXX", 3], ["XXX\nXXX\nXXX", 1], ["XXX\nXXX", 1], ["XX\nXX\nXX", 1],
    ["X.\nXX", 2], [".X\nXX", 2], ["XX\nX.", 2], ["XX\n.X", 2],
    ["X..\nX..\nXXX", 1], ["..X\n..X\nXXX", 1], ["XXX\nX..\nX..", 1], ["XXX\n..X\n..X", 1],
    ["X.\nX.\nXX", 2], [".X\n.X\nXX", 2], ["XX\nX.\nX.", 2], ["XX\n.X\n.X", 2], ["XXX\nX..", 2], ["XXX\n..X", 2], ["X..\nXXX", 2], ["..X\nXXX", 2],
    ["XXX\n.X.", 2], [".X.\nXXX", 2], ["X.\nXX\nX.", 2], [".X\nXX\n.X", 2],
    ["XX.\n.XX", 1], [".XX\nXX.", 1], ["X.\nXX\n.X", 1], [".X\nXX\nX.", 1]
  ];
  var SHAPES = SHAPE_DEFS.map(function (d) {
    var rows = d[0].split("\n"), cells = [];
    rows.forEach(function (row, r) { row.split("").forEach(function (ch, c) { if (ch === "X") cells.push([r, c]); }); });
    return { cells: cells, h: rows.length, w: Math.max.apply(null, rows.map(function (r) { return r.length; })), weight: d[1] };
  });
  var TOTAL_W = SHAPES.reduce(function (s, x) { return s + x.weight; }, 0);
  var TOX_EVERY = 6;
  var BEST_KEY = "vo_vitablock_best", SAVE_KEY = "vo_vitablock_save_v1", MUTE_KEY = "vo_vitablock_muted";

  /* ---------------- Durum ---------------- */
  var st = null;
  function emptyBoard() { var b = []; for (var r = 0; r < N; r++) { b.push([]); for (var c = 0; c < N; c++) b[r].push(null); } return b; }
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function bestScore() { return Number(load(BEST_KEY)) || 0; }

  function randomShape() {
    var x = Math.random() * TOTAL_W;
    for (var i = 0; i < SHAPES.length; i++) { x -= SHAPES[i].weight; if (x <= 0) return SHAPES[i]; }
    return SHAPES[0];
  }
  function makePiece() { var s = randomShape(); return { cells: s.cells, w: s.w, h: s.h, kind: KINDS[Math.floor(Math.random() * KINDS.length)] }; }
  function canPlace(board, p, r0, c0) {
    for (var i = 0; i < p.cells.length; i++) {
      var r = r0 + p.cells[i][0], c = c0 + p.cells[i][1];
      if (r < 0 || c < 0 || r >= N || c >= N || board[r][c]) return false;
    }
    return true;
  }
  function fitsAnywhere(board, p) {
    for (var r = 0; r <= N - p.h; r++) for (var c = 0; c <= N - p.w; c++) if (canPlace(board, p, r, c)) return true;
    return false;
  }
  /* Adil üretim: yeni üçlüden EN AZ BİRİ mevcut tahtaya kesinlikle sığar.
     Önce rastgele üçlüler denenir; hiçbiri sığmazsa tahtaya sığan şekiller arasından biri zorla eklenir
     (tahtada tek bir boş hücre bile yoksa oyun zaten adil biçimde biter). */
  function newTray() {
    var tray;
    for (var a = 0; a < 40; a++) {
      tray = [makePiece(), makePiece(), makePiece()];
      if (tray.some(function (p) { return fitsAnywhere(st.board, p); })) { st.tray = tray; return; }
    }
    var fitting = SHAPES.filter(function (sh) { return fitsAnywhere(st.board, sh); });
    if (fitting.length) {
      var sh = fitting[Math.floor(Math.random() * fitting.length)];
      tray[Math.floor(Math.random() * 3)] = { cells: sh.cells, w: sh.w, h: sh.h, kind: KINDS[Math.floor(Math.random() * KINDS.length)] };
    }
    st.tray = tray;
  }
  function newGame() {
    st = { board: emptyBoard(), tray: [null, null, null], score: 0, moves: 0, streak: 0, over: false, toxWarn: null };
    newTray();
    save();
    ui.score(); closeOver();
    requestRender();
  }
  function save() {
    if (!st || st.over) { store(SAVE_KEY, null); return; }
    store(SAVE_KEY, JSON.stringify({ board: st.board, tray: st.tray, score: st.score, moves: st.moves, streak: st.streak, toxWarn: st.toxWarn }));
  }
  function restore() {
    try {
      var s = JSON.parse(load(SAVE_KEY) || "null");
      if (!s || !Array.isArray(s.board) || s.board.length !== N || !Array.isArray(s.tray)) return false;
      var okKind = function (k) { return k === null || TYPES[k]; };
      if (!s.board.every(function (row) { return Array.isArray(row) && row.length === N && row.every(okKind); })) return false;
      st = { board: s.board, tray: s.tray.map(function (p) { return p && Array.isArray(p.cells) && TYPES[p.kind] ? p : null; }), score: Number(s.score) || 0, moves: Number(s.moves) || 0, streak: Number(s.streak) || 0, over: false, toxWarn: s.toxWarn && Number.isInteger(s.toxWarn.r) ? { r: s.toxWarn.r, c: s.toxWarn.c } : null };
      if (!st.tray.some(Boolean)) newTray();
      return true;
    } catch (_) { return false; }
  }

  /* ---------------- Ses (Web Audio, sentezlenmiş) ---------------- */
  var audio = { ctx: null, muted: load(MUTE_KEY) === "1" };
  function ensureAudio() {
    if (audio.muted) return null;
    try {
      if (!audio.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; audio.ctx = new AC(); }
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return audio.ctx;
    } catch (_) { return null; }
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    var ac = ensureAudio(); if (!ac) return;
    var t = ac.currentTime + (delay || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    var ac = ensureAudio(); if (!ac) return;
    var len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; f.type = "lowpass"; f.frequency.value = freq || 1800; g.gain.value = vol || 0.12;
    src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
  }
  var sfx = {
    pick: function () { tone(660, 0.05, "triangle", 0.06); },
    place: function () { tone(210, 0.12, "sine", 0.16, 130); tone(420, 0.05, "triangle", 0.04); },
    bad: function () { tone(150, 0.09, "square", 0.04, 120); },
    // k: ardışık kombo adımı → her adımda bir tam ton (2 yarım ses) tiz
    clear: function (n, k) { var m = Math.pow(2, Math.min(12, ((k || 1) - 1) * 2) / 12); noise(0.28, 0.1, 2400); [523, 659, 784, 1047].slice(0, Math.min(4, 1 + n)).forEach(function (f, i) { tone(f * m, 0.16, "triangle", 0.08, null, i * 0.06); }); },
    synergy: function (k) { var m = Math.pow(2, Math.min(12, ((k || 1) - 1) * 2) / 12); [784, 988, 1175, 1568].forEach(function (f, i) { tone(f * m, 0.14, "sine", 0.07, null, 0.12 + i * 0.07); }); },
    warn: function () { tone(880, 0.07, "square", 0.025); tone(660, 0.09, "square", 0.02, null, 0.09); },
    tox: function () { tone(140, 0.28, "sawtooth", 0.04, 90); },
    over: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.28, "triangle", 0.08, null, i * 0.16); }); }
  };

  /* ---------------- Tuval ve yerleşim ---------------- */
  var canvas = document.getElementById("vbCanvas"), ctx = canvas.getContext("2d");
  var frame = document.getElementById("vbFrame");
  var L = { W: 0, H: 0, dpr: 1, pad: 0, cell: 0, bx: 0, by: 0, bs: 0, ty: 0, th: 0 };
  var sprites = {}, boardBg = null;

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function mix(hex, to, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = to === "w" ? 255 : 0;
    return "rgb(" + Math.round(r + (t - r) * amt) + "," + Math.round(g + (t - g) * amt) + "," + Math.round(b + (t - b) * amt) + ")";
  }
  /* Hücre zarı görünümlü yuvarlatılmış blok (türüne göre renk + sembol); önbelleğe alınır */
  function makeSprite(kind, size) {
    var cv = document.createElement("canvas"), dpr = L.dpr;
    cv.width = cv.height = Math.ceil(size * dpr);
    var x = cv.getContext("2d"); x.scale(dpr, dpr);
    var T = TYPES[kind], m = size * 0.055, s = size - 2 * m, r = size * 0.22;
    var grd = x.createLinearGradient(0, m, 0, m + s);
    grd.addColorStop(0, mix(T.color, "w", 0.28)); grd.addColorStop(0.55, T.color); grd.addColorStop(1, mix(T.color, "b", 0.22));
    rr(x, m, m, s, s, r); x.fillStyle = grd; x.fill();
    // Hücre zarı: iç parlak halka + ince koyu dış kenar
    x.lineWidth = Math.max(1, size * 0.045); x.strokeStyle = "rgba(255,255,255,.42)";
    rr(x, m + size * 0.07, m + size * 0.07, s - size * 0.14, s - size * 0.14, r * 0.7); x.stroke();
    x.lineWidth = 1; x.strokeStyle = mix(T.color, "b", 0.45); rr(x, m + 0.5, m + 0.5, s - 1, s - 1, r); x.stroke();
    // Parlama
    x.fillStyle = "rgba(255,255,255,.22)"; x.beginPath(); x.ellipse(m + s * 0.32, m + s * 0.24, s * 0.22, s * 0.11, -0.5, 0, Math.PI * 2); x.fill();
    if (kind === "tox") { // kırık çizgileri
      x.strokeStyle = "rgba(15,23,42,.55)"; x.lineWidth = Math.max(1, size * 0.035); x.beginPath();
      x.moveTo(m + s * 0.18, m + s * 0.3); x.lineTo(m + s * 0.42, m + s * 0.5); x.lineTo(m + s * 0.33, m + s * 0.72); x.moveTo(m + s * 0.42, m + s * 0.5); x.lineTo(m + s * 0.8, m + s * 0.42); x.stroke();
    }
    // Sembol
    x.textAlign = "center"; x.textBaseline = "middle";
    if (kind === "su") { x.font = Math.round(size * 0.42) + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; x.fillStyle = "#000"; x.fillText(T.sym, size / 2, size / 2 + size * 0.02); }
    else {
      x.font = "900 " + Math.round(size * (T.sym.length > 1 ? 0.34 : 0.42)) + "px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
      x.fillStyle = "rgba(0,0,0,.28)"; x.fillText(T.sym, size / 2 + 1, size / 2 + 2);
      x.fillStyle = "#fff"; x.fillText(T.sym, size / 2, size / 2 + 1);
    }
    return cv;
  }
  function buildBoardBg() {
    var cv = document.createElement("canvas"); cv.width = Math.ceil(L.W * L.dpr); cv.height = Math.ceil((L.by + L.bs + L.pad) * L.dpr);
    var x = cv.getContext("2d"); x.scale(L.dpr, L.dpr);
    // Tahta paneli + turkuaz neon kenar
    x.save(); x.shadowColor = "rgba(13,148,136,.75)"; x.shadowBlur = 16;
    rr(x, L.bx - 4, L.by - 4, L.bs + 8, L.bs + 8, 16); x.fillStyle = "rgba(2,6,23,.72)"; x.fill(); x.restore();
    x.lineWidth = 1.5; x.strokeStyle = "rgba(45,212,191,.65)"; rr(x, L.bx - 4, L.by - 4, L.bs + 8, L.bs + 8, 16); x.stroke();
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var px = L.bx + c * L.cell, py = L.by + r * L.cell, m = L.cell * 0.055;
      rr(x, px + m, py + m, L.cell - 2 * m, L.cell - 2 * m, L.cell * 0.2);
      x.fillStyle = "rgba(13,148,136,.10)"; x.fill();
      x.lineWidth = 1; x.strokeStyle = "rgba(45,212,191,.22)"; x.stroke();
    }
    boardBg = cv;
  }
  function layout() {
    var W = Math.floor(canvas.clientWidth || frame.clientWidth);
    var dprNow = Math.min(window.devicePixelRatio || 1, 3);
    if (!W || (W === L.W && dprNow === L.dpr && sprites.fe)) return; // yalnızca genişlik / ölçek değişince yeniden kur
    L.dpr = Math.min(window.devicePixelRatio || 1, 3);
    L.W = W; L.pad = Math.round(W * 0.04); L.bs = W - 2 * L.pad; L.cell = L.bs / N; L.bx = L.pad; L.by = L.pad;
    L.ty = L.by + L.bs + L.pad * 1.2; L.th = Math.round(L.cell * 2.6);
    L.H = Math.round(L.ty + L.th + L.pad * 0.6);
    canvas.style.height = L.H + "px";
    canvas.width = Math.round(L.W * L.dpr); canvas.height = Math.round(L.H * L.dpr);
    sprites = {}; Object.keys(TYPES).forEach(function (k) { sprites[k] = makeSprite(k, L.cell); });
    buildBoardBg();
    requestRender();
  }
  function trayScale(p) {
    var slotW = L.W / 3;
    return Math.min(0.64, (slotW * 0.86) / (p.w * L.cell), (L.th * 0.84) / (p.h * L.cell));
  }
  function slotCenter(i) { return { x: (i + 0.5) * L.W / 3, y: L.ty + L.th / 2 }; }

  /* ---------------- Efektler ---------------- */
  var fx = { particles: [], waves: [], floats: [], shake: 0, appear: [] };
  function burst(x, y, color, n, power) {
    for (var i = 0; i < n && fx.particles.length < 420; i++) {
      var a = Math.random() * Math.PI * 2, s = (40 + Math.random() * 180) * (power || 1);
      fx.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.5 + Math.random() * 0.45, max: 0.95, color: color, size: 2 + Math.random() * 3.5 });
    }
  }
  function floatText(text, x, y, color) { fx.floats.push({ text: text, x: x, y: y, life: 1.1, color: color || "#5eead4" }); }

  /* ---------------- Oyun mantığı ---------------- */
  function cellCenter(r, c) { return { x: L.bx + (c + 0.5) * L.cell, y: L.by + (r + 0.5) * L.cell }; }
  function linesIfPlaced(p, r0, c0) {
    var b = st.board.map(function (row) { return row.slice(); });
    p.cells.forEach(function (cc) { b[r0 + cc[0]][c0 + cc[1]] = p.kind; });
    return fullLines(b);
  }
  function fullLines(b) {
    var rows = [], cols = [];
    for (var i = 0; i < N; i++) {
      var rf = true, cf = true;
      for (var j = 0; j < N; j++) { if (!b[i][j]) rf = false; if (!b[j][i]) cf = false; }
      if (rf) rows.push(i); if (cf) cols.push(i);
    }
    return { rows: rows, cols: cols };
  }

  function place(idx, r0, c0) {
    var p = st.tray[idx];
    if (!p || st.over || !canPlace(st.board, p, r0, c0)) return false;
    p.cells.forEach(function (cc) {
      var r = r0 + cc[0], c = c0 + cc[1]; st.board[r][c] = p.kind;
      var cp = cellCenter(r, c); burst(cp.x, cp.y, TYPES[p.kind].color, 3, 0.45);
    });
    st.tray[idx] = null;
    st.moves += 1;
    var gained = p.cells.length;
    sfx.place();

    var lines = fullLines(st.board), n = lines.rows.length + lines.cols.length;
    if (n) {
      var lineList = lines.rows.map(function (i) { return { row: i }; }).concat(lines.cols.map(function (i) { return { col: i }; }));
      var clearSet = {}, toxins = 0, feC = 0, bone = 0, lineScore = 0;
      lineList.forEach(function (ln) {
        var kinds = {};
        for (var j = 0; j < N; j++) {
          var r = ln.row !== undefined ? ln.row : j, c = ln.col !== undefined ? ln.col : j;
          kinds[st.board[r][c]] = true; clearSet[r + "," + c] = st.board[r][c];
        }
        var mult = 1;
        if (kinds.fe && kinds.c) { mult *= 2; feC++; }
        if (kinds.d3 && kinds.k2) { mult *= 2; bone++; }
        lineScore += 80 * mult;
        fx.waves.push({ row: ln.row, col: ln.col, t: 0 });
      });
      var pr = r0 + (p.h - 1) / 2, pc = c0 + (p.w - 1) / 2;
      Object.keys(clearSet).forEach(function (key) {
        var rc = key.split(",").map(Number), kind = clearSet[key];
        if (kind === "tox") toxins++;
        st.board[rc[0]][rc[1]] = null;
        // Gecikme: parçanın merkezinden uzaklığa göre — çizgi boyunca yayılan ışık dalgası hissi
        fx.appear.push({ r: rc[0], c: rc[1], kind: kind, t: 0, out: true, d: 0.001 + (Math.abs(rc[0] - pr) + Math.abs(rc[1] - pc)) * 0.035 });
      });
      st.streak += 1;
      var combo = n; // aynı anda patlayan satır+sütun sayısı = kombo çarpanı
      var streakBonus = st.streak > 1 ? (st.streak - 1) * 20 : 0;
      var clearGain = lineScore * combo + toxins * 25 + streakBonus;
      gained += clearGain;
      fx.shake = Math.min(9, 3 + n * 2);   // hafif sarsıntı
      sfx.clear(n, st.streak);              // ardışık kombolarda nota her adımda bir ton tizleşir
      var mid = cellCenter(r0 + Math.floor(p.h / 2), c0 + Math.floor(p.w / 2));
      floatText("+" + clearGain, mid.x, mid.y, "#fde68a");
      // Ekranın ortasında parlayıp yukarı süzülen ödül etiketleri (1.2 sn)
      if (feC) { award("⚡ C + Fe EMİLİM SİNERJİSİ! 2x PUAN", "fe"); sfx.synergy(st.streak); }
      if (bone) { award("🦴 D3 + K2 KEMİK SİNERJİSİ! 2x PUAN", "bone"); if (!feC) sfx.synergy(st.streak); }
      if (combo > 1) award("💥 ÇOKLU PATLAMA x" + combo + "!", "multi");
      if (st.streak > 1) award("🔥 KOMBO x" + st.streak + "!", "combo");
      if (toxins) toast("Serbest radikal temizlendi! +" + (toxins * 25), "tox");
    } else {
      st.streak = 0;
    }
    st.score += gained;

    // Her 6 hamlede bir serbest radikal; 1 hamle önce doğacağı kare uyarı olarak yanıp söner
    if (st.moves % TOX_EVERY === 0) spawnToxin();
    else if (toxLeft() === 1) { st.toxWarn = pickToxCell(); if (st.toxWarn) sfx.warn(); }
    if (!st.tray.some(Boolean)) newTray();
    ui.score();
    checkOver();
    save();
    requestRender();
    return true;
  }
  function toxLeft() { return TOX_EVERY - (st.moves % TOX_EVERY); }
  /* Kenar/köşe tercihi: en dış halkadaki boş hücreler önce (ortadaki kritik boşluklar en son seçilir) */
  function pickToxCell() {
    var best = 9, list = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (st.board[r][c]) continue;
      var ring = Math.min(r, c, N - 1 - r, N - 1 - c);
      if (ring < best) { best = ring; list = []; }
      if (ring === best) list.push({ r: r, c: c });
    }
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  function spawnToxin() {
    var w = st.toxWarn && !st.board[st.toxWarn.r][st.toxWarn.c] ? st.toxWarn : pickToxCell();
    st.toxWarn = null;
    if (!w) return;
    var pick = [w.r, w.c];
    st.board[pick[0]][pick[1]] = "tox";
    fx.appear.push({ r: pick[0], c: pick[1], kind: "tox", t: 0 });
    var cp = cellCenter(pick[0], pick[1]); burst(cp.x, cp.y, "#94a3b8", 10, 0.6);
    sfx.tox();
    toast("Serbest radikal belirdi! Satırını ya da sütununu patlatın.", "tox");
  }
  function checkOver() {
    var left = st.tray.filter(Boolean);
    if (!left.length || left.some(function (p) { return fitsAnywhere(st.board, p); })) return;
    st.over = true;
    var best = bestScore(), record = st.score > best;
    if (record) store(BEST_KEY, String(st.score));
    store("vo_best_vitablock", Math.max(best, st.score) + " puan");
    store(SAVE_KEY, null);
    ui.score();
    setTimeout(function () {
      sfx.over();
      document.getElementById("vbOverScore").textContent = String(st.score);
      document.getElementById("vbOverBest").textContent = String(Math.max(best, st.score));
      document.getElementById("vbOverNote").textContent = record ? "🎉 Yeni rekor!" : (best ? "Rekora " + (best - st.score) + " puan kaldı." : "");
      document.getElementById("vbOver").hidden = false;
      document.getElementById("vbAgain").focus();
    }, 650);
  }
  function closeOver() { document.getElementById("vbOver").hidden = true; }

  /* ---------------- Bildirim ve skor ---------------- */
  var toasts = document.getElementById("vbToasts");
  function toast(text, tone) {
    var d = document.createElement("div");
    d.className = "vb-toast" + (tone ? " vb-toast--" + tone : ""); d.textContent = text;
    toasts.appendChild(d);
    while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1950);
  }
  var awardQ = 0;
  function award(text, tone) {
    var box = document.getElementById("vbAwards"); if (!box) return;
    var d = document.createElement("div"), delay = awardQ * 280;
    awardQ++; setTimeout(function () { awardQ = Math.max(0, awardQ - 1); }, 300);
    d.className = "vb-award vb-award--" + (tone || "combo"); d.textContent = text; d.style.animationDelay = delay + "ms";
    box.appendChild(d); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1200 + delay + 50);
  }
  var ui = {
    score: function () {
      document.getElementById("vbScore").textContent = String(st.score);
      document.getElementById("vbBest").textContent = String(Math.max(bestScore(), st.score)); // rekor geçilirken canlı güncellenir
      var left = toxLeft(), tc = document.getElementById("vbToxCount"), tw = document.getElementById("vbTox");
      if (tc) tc.textContent = left + " hamle";
      if (tw) { tw.classList.toggle("is-soon", left <= 1); tw.setAttribute("aria-label", "Sonraki serbest radikal: " + left + " hamle"); }
    }
  };

  /* ---------------- Girdi: Pointer Events (dokunma + fare + kalem) ---------------- */
  var drag = null, selected = -1;
  var TOUCH_LIFT = 56; // dokunmada parça parmağın üstünde
  function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function traySlotAt(p) {
    if (p.y < L.ty - L.pad * 0.6 || p.y > L.ty + L.th + L.pad) return -1;
    var i = Math.max(0, Math.min(2, Math.floor(p.x / (L.W / 3))));
    return st.tray[i] ? i : -1;
  }
  function dragTarget(d) {
    var pc = st.tray[d.idx]; if (!pc) return null;
    var lift = d.type === "mouse" ? 0 : TOUCH_LIFT + pc.h * L.cell / 2;
    var cx = d.x, cy = d.y - lift;
    var c0 = Math.round((cx - L.bx) / L.cell - pc.w / 2), r0 = Math.round((cy - L.by) / L.cell - pc.h / 2);
    return { r: r0, c: c0, cx: cx, cy: cy, ok: canPlace(st.board, pc, r0, c0) };
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (!st || st.over || (e.button !== undefined && e.button > 0)) return;
    ensureAudio();
    var p = pos(e), slot = traySlotAt(p);
    if (slot >= 0) {
      e.preventDefault();
      drag = { idx: slot, type: e.pointerType || "mouse", x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      canvas.classList.add("is-dragging");
      sfx.pick(); requestRender();
      return;
    }
    // Seçili parça + tahtaya dokunma → oraya yerleştir (sürüklemeden oynama / erişilebilirlik)
    if (selected >= 0 && st.tray[selected] && p.x >= L.bx && p.y >= L.by && p.x < L.bx + L.bs && p.y < L.by + L.bs) {
      var pc = st.tray[selected], r = Math.floor((p.y - L.by) / L.cell) - Math.floor(pc.h / 2), c = Math.floor((p.x - L.bx) / L.cell) - Math.floor(pc.w / 2);
      r = Math.max(0, Math.min(N - pc.h, r)); c = Math.max(0, Math.min(N - pc.w, c));
      if (place(selected, r, c)) selected = -1; else { sfx.bad(); toast("Buraya sığmıyor", "tox"); }
      requestRender();
    }
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = pos(e); drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.moved = true;
    requestRender();
  });
  function endDrag(e, cancel) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null; canvas.classList.remove("is-dragging");
    if (!cancel && d.moved) {
      var t = dragTarget(d);
      if (t && t.ok) { place(d.idx, t.r, t.c); selected = -1; }
      else sfx.bad();
    } else if (!cancel && !d.moved) {
      selected = selected === d.idx ? -1 : d.idx; // dokun-seç, sonra tahtaya dokun
    }
    requestRender();
  }
  canvas.addEventListener("pointerup", function (e) { endDrag(e, false); });
  canvas.addEventListener("pointercancel", function (e) { endDrag(e, true); });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ---------------- Çizim ---------------- */
  var raf = 0, lastT = 0;
  function requestRender() { if (!raf) raf = requestAnimationFrame(frameLoop); }
  function busy() { return !!(drag || fx.particles.length || fx.waves.length || fx.floats.length || fx.shake > 0.2 || fx.appear.length || (st && st.toxWarn && !st.over)); }
  function frameLoop(t) {
    raf = 0;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016; lastT = t;
    step(dt); draw();
    if (busy()) raf = requestAnimationFrame(frameLoop); else lastT = 0;
  }
  function step(dt) {
    for (var i = fx.particles.length - 1; i >= 0; i--) {
      var q = fx.particles[i]; q.life -= dt; q.vy += 520 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.985;
      if (q.life <= 0) fx.particles.splice(i, 1);
    }
    fx.waves.forEach(function (w) { w.t += dt / 0.42; }); fx.waves = fx.waves.filter(function (w) { return w.t < 1; });
    fx.appear.forEach(function (a) {
      if (a.d > 0) { a.d -= dt; if (a.d <= 0) { var cp = cellCenter(a.r, a.c); burst(cp.x, cp.y, TYPES[a.kind].color, 8, 1.05); burst(cp.x, cp.y, "#ffffff", 2, 0.8); } return; }
      a.t += dt / (a.out ? 0.3 : 0.4);
    });
    fx.appear = fx.appear.filter(function (a) { return a.t < 1; });
    fx.time = (fx.time || 0) + dt;
    fx.floats.forEach(function (f) { f.life -= dt; f.y -= 46 * dt; }); fx.floats = fx.floats.filter(function (f) { return f.life > 0; });
    fx.shake = Math.max(0, fx.shake - 38 * dt);
  }
  function drawSprite(kind, x, y, size, alpha) {
    var s = sprites[kind]; if (!s) return;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(s, x, y, size, size);
    if (alpha !== undefined) ctx.globalAlpha = 1;
  }
  function draw() {
    if (!L.W || !st) return;
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);
    ctx.save();
    if (fx.shake > 0.2) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    if (boardBg) ctx.drawImage(boardBg, 0, 0, L.W, boardBg.height / L.dpr);

    // Yerleşik bloklar (yeni beliren toksin büyüyerek gelir)
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var k = st.board[r][c]; if (!k) continue;
      var ap = null; for (var i = 0; i < fx.appear.length; i++) if (!fx.appear[i].out && fx.appear[i].r === r && fx.appear[i].c === c) ap = fx.appear[i];
      var sc = ap ? 0.4 + 0.6 * easeOut(ap.t) : 1, x = L.bx + c * L.cell, y = L.by + r * L.cell, sz = L.cell * sc;
      drawSprite(k, x + (L.cell - sz) / 2, y + (L.cell - sz) / 2, sz);
    }
    // Patlayan hücreler: beyaz parlayıp büyüyerek kaybolur
    fx.appear.forEach(function (a) {
      if (!a.out) return;
      if (a.d > 0) { // sırası gelmeyen hücre: altın parıltıyla bekler
        var bx = L.bx + a.c * L.cell, by = L.by + a.r * L.cell;
        drawSprite(a.kind, bx, by, L.cell);
        ctx.save(); ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2.5; ctx.shadowColor = "#fde047"; ctx.shadowBlur = 12;
        rr(ctx, bx + 2, by + 2, L.cell - 4, L.cell - 4, L.cell * 0.22); ctx.stroke(); ctx.restore();
        return;
      }
      var p = a.t, sz = L.cell * (1 + 0.35 * p), x = L.bx + a.c * L.cell + (L.cell - sz) / 2, y = L.by + a.r * L.cell + (L.cell - sz) / 2;
      drawSprite(a.kind, x, y, sz, 1 - p);
      ctx.globalAlpha = (1 - p) * 0.75; ctx.fillStyle = "#fff"; rr(ctx, x + sz * 0.06, y + sz * 0.06, sz * 0.88, sz * 0.88, sz * 0.2); ctx.fill(); ctx.globalAlpha = 1;
    });
    // Enerji dalgası: çizgi boyunca ilerleyen parlak turkuaz bant
    fx.waves.forEach(function (w) {
      var horiz = w.row !== undefined, pos0 = horiz ? L.by + w.row * L.cell : L.bx + w.col * L.cell;
      var head = (horiz ? L.bx : L.by) + easeOut(w.t) * L.bs, len = L.bs * 0.45;
      var g = horiz ? ctx.createLinearGradient(head - len, 0, head, 0) : ctx.createLinearGradient(0, head - len, 0, head);
      g.addColorStop(0, "rgba(94,234,212,0)"); g.addColorStop(1, "rgba(204,251,241," + (0.95 * (1 - w.t)) + ")");
      ctx.fillStyle = g;
      if (horiz) ctx.fillRect(L.bx, pos0, L.bs, L.cell); else ctx.fillRect(pos0, L.by, L.cell, L.bs);
    });

    // Serbest radikal uyarısı (1 hamle önce)
    if (st.toxWarn && !st.board[st.toxWarn.r][st.toxWarn.c]) {
      var wx = L.bx + st.toxWarn.c * L.cell, wy = L.by + st.toxWarn.r * L.cell, bl = 0.35 + 0.35 * (Math.sin((fx.time || 0) * 7) + 1) / 2;
      ctx.save(); ctx.globalAlpha = bl; ctx.fillStyle = "rgba(148,163,184,.35)"; rr(ctx, wx + 3, wy + 3, L.cell - 6, L.cell - 6, L.cell * 0.2); ctx.fill();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "#f87171"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#e2e8f0"; ctx.font = "900 " + Math.round(L.cell * 0.32) + "px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("R•", wx + L.cell / 2, wy + L.cell / 2 + 1); ctx.restore();
    }
    // Hayalet önizleme + patlayacak çizgilerin turkuaz vurgusu
    if (drag && drag.moved) {
      var t = dragTarget(drag), pc = st.tray[drag.idx];
      if (t && t.ok && pc) {
        var fl = linesIfPlaced(pc, t.r, t.c), glowA = 0.75 + Math.sin((fx.time || 0) * 10) * 0.25;
        // Yarı saydam parlak gölge
        ctx.save(); ctx.shadowColor = "#5eead4"; ctx.shadowBlur = 10;
        pc.cells.forEach(function (cc) { drawSprite(pc.kind, L.bx + (t.c + cc[1]) * L.cell, L.by + (t.r + cc[0]) * L.cell, L.cell, 0.5); });
        ctx.restore();
        ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2;
        pc.cells.forEach(function (cc) { rr(ctx, L.bx + (t.c + cc[1]) * L.cell + 3, L.by + (t.r + cc[0]) * L.cell + 3, L.cell - 6, L.cell - 6, L.cell * 0.2); ctx.stroke(); });
        ctx.restore();
        if (fl.rows.length || fl.cols.length) {
          // Patlayacak çizgi: dış çerçeve turkuaz, içindeki her bloğun kenarı altın
          ctx.save(); ctx.globalAlpha = glowA; ctx.shadowBlur = 14;
          ctx.strokeStyle = "#2dd4bf"; ctx.shadowColor = "#2dd4bf"; ctx.lineWidth = 3;
          fl.rows.forEach(function (i) { rr(ctx, L.bx + 1.5, L.by + i * L.cell + 1.5, L.bs - 3, L.cell - 3, L.cell * 0.22); ctx.stroke(); });
          fl.cols.forEach(function (i) { rr(ctx, L.bx + i * L.cell + 1.5, L.by + 1.5, L.cell - 3, L.bs - 3, L.cell * 0.22); ctx.stroke(); });
          ctx.strokeStyle = "#fde047"; ctx.shadowColor = "#fde047"; ctx.lineWidth = 2;
          var hl = function (r, c) { rr(ctx, L.bx + c * L.cell + 4, L.by + r * L.cell + 4, L.cell - 8, L.cell - 8, L.cell * 0.18); ctx.stroke(); };
          fl.rows.forEach(function (i) { for (var j = 0; j < N; j++) hl(i, j); });
          fl.cols.forEach(function (i) { for (var j = 0; j < N; j++) hl(j, i); });
          ctx.restore();
        }
      }
    }

    // Bekleme alanı (3 parça)
    ctx.fillStyle = "rgba(2,6,23,.35)"; rr(ctx, L.pad * 0.5, L.ty - L.pad * 0.35, L.W - L.pad, L.th + L.pad * 0.5, 16); ctx.fill();
    for (var s = 0; s < 3; s++) {
      var pcs = st.tray[s]; if (!pcs) continue;
      if (drag && drag.idx === s && drag.moved) continue;
      var scl = trayScale(pcs), cs = L.cell * scl, ctr = slotCenter(s), ox = ctr.x - pcs.w * cs / 2, oy = ctr.y - pcs.h * cs / 2;
      var fits = fitsAnywhere(st.board, pcs);
      if (selected === s || (drag && drag.idx === s)) {
        ctx.save(); ctx.strokeStyle = "#5eead4"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        rr(ctx, ctr.x - L.W / 6 + 6, L.ty - 2, L.W / 3 - 12, L.th + 4, 14); ctx.stroke(); ctx.restore();
      }
      pcs.cells.forEach(function (cc) { drawSprite(pcs.kind, ox + cc[1] * cs, oy + cc[0] * cs, cs, fits ? 1 : 0.3); });
    }
    // Sürüklenen parça (tam boy): dokunmada parmağın üstünde, farede imleç merkezinde
    if (drag && drag.moved && st.tray[drag.idx]) {
      var dp = st.tray[drag.idx], tg = dragTarget(drag), ox2 = tg.cx - dp.w * L.cell / 2, oy2 = tg.cy - dp.h * L.cell / 2;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      dp.cells.forEach(function (cc) { drawSprite(dp.kind, ox2 + cc[1] * L.cell, oy2 + cc[0] * L.cell, L.cell, 0.95); });
      ctx.restore();
    }

    // Parçacıklar ve uçan puanlar
    fx.particles.forEach(function (q) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); });
    ctx.globalAlpha = 1;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    fx.floats.forEach(function (f) {
      ctx.globalAlpha = Math.min(1, f.life / 0.5); ctx.font = "900 " + Math.round(L.cell * 0.5) + "px system-ui,sans-serif";
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(2,6,23,.75)"; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function easeOut(t) { return 1 - Math.pow(1 - Math.min(1, t), 3); }

  /* ---------------- Düğmeler ---------------- */
  var soundBtn = document.getElementById("vbSound");
  function syncSound() { soundBtn.textContent = audio.muted ? "🔇" : "🔊"; soundBtn.setAttribute("aria-pressed", audio.muted ? "false" : "true"); soundBtn.setAttribute("aria-label", audio.muted ? "Sesi aç" : "Sesi kapat"); }
  soundBtn.addEventListener("click", function () { audio.muted = !audio.muted; store(MUTE_KEY, audio.muted ? "1" : "0"); syncSound(); if (!audio.muted) sfx.pick(); });
  /* Üst bar: ? (nasıl oynanır + renk açıklamaları) ve ↻ (onaylı yeniden başlat) */
  function openModal(id) { var m = document.getElementById(id); m.hidden = false; var b = m.querySelector("button"); if (b) b.focus(); }
  function closeModal(id) { document.getElementById(id).hidden = true; }
  document.getElementById("vbHelpBtn").addEventListener("click", function () { openModal("vbHelp"); });
  document.getElementById("vbHelpClose").addEventListener("click", function () { closeModal("vbHelp"); });
  document.getElementById("vbRestart").addEventListener("click", function () {
    if (!st.over && (st.score > 0 || st.moves > 0)) { openModal("vbConfirm"); return; }
    selected = -1; newGame();
  });
  document.getElementById("vbConfirmYes").addEventListener("click", function () { closeModal("vbConfirm"); selected = -1; newGame(); });
  document.getElementById("vbConfirmNo").addEventListener("click", function () { closeModal("vbConfirm"); });
  ["vbHelp", "vbConfirm"].forEach(function (id) { document.getElementById(id).addEventListener("click", function (e) { if (e.target.id === id) closeModal(id); }); });
  document.getElementById("vbAgain").addEventListener("click", function () { selected = -1; newGame(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { selected = -1; closeModal("vbHelp"); closeModal("vbConfirm"); requestRender(); } });

  /* Test ve hata ayıklama için küçük, salt-okunur durum özeti */
  window.VitaBlock = {
    state: function () { return st ? { board: st.board.map(function (r) { return r.slice(); }), tray: st.tray.map(function (p) { return p && { cells: p.cells, w: p.w, h: p.h, kind: p.kind }; }), score: st.score, moves: st.moves, over: st.over, toxWarn: st.toxWarn ? { r: st.toxWarn.r, c: st.toxWarn.c } : null, toxLeft: toxLeft() } : null; },
    layout: function () { return { bx: L.bx, by: L.by, cell: L.cell, ty: L.ty, th: L.th, W: L.W, H: L.H, dpr: L.dpr }; },
    _debugSet: function (board, tray, moves) { if (board) st.board = board; if (tray) st.tray = tray; if (moves !== undefined) st.moves = moves; st.streak = 0; st.over = false; st.toxWarn = null; closeOver(); save(); ui.score(); checkOver(); requestRender(); },
    place: function (i, r, c) { return place(i, r, c); },
    _newTray: function () { newTray(); requestRender(); return st.tray.map(function (p) { return p && { cells: p.cells, w: p.w, h: p.h, kind: p.kind, fits: fitsAnywhere(st.board, p) }; }); },
    _pickToxCell: function () { return pickToxCell(); }
  };

  /* ---------------- Başlat ---------------- */
  syncSound();
  if (!restore()) { st = { board: emptyBoard(), tray: [null, null, null], score: 0, moves: 0, streak: 0, over: false }; newTray(); }
  ui.score();
  if (typeof ResizeObserver === "function") new ResizeObserver(function () { layout(); }).observe(frame);
  window.addEventListener("resize", layout);
  layout();
  checkOver();
})();
