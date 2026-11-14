/* Sağlıklı Sepet — saf JS + Canvas, dış kütüphane yok.
   Düşen sağlıklı besinler (+10) ve su (+5, su barını doldurur → +50 bonus) yakalanır; abur cubur can götürür.
   60 saniye veya 3 can; hız zamanla artar. Dokunma/sürükleme, fare ve ← → / A D tuşları. */
(function () {
  "use strict";
  var GOOD = ["🍎", "🥦", "🥕", "🍌", "🐟", "🥚", "🥜", "🍊"];
  var BAD = ["🍩", "🍟", "🥤", "🍬", "🍔"];
  var WATER = "💧";
  var ROUND = 60, LIVES = 3, BEST_KEY = "vo_sepet_best_v1";

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("sepStage"), canvas = $("sepCanvas"), ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1;
  var g = null, raf = 0, last = 0, keys = { left: false, right: false };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (g) { g.basket.w = basketW(); g.basket.y = H - 46; g.basket.x = Math.min(Math.max(g.basket.x, g.basket.w / 2), W - g.basket.w / 2); }
    if (!g || !g.running) draw();
  }
  function basketW() { return Math.max(70, Math.min(120, W * 0.24)); }
  function readBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } }
  function showBest() { var b = readBest(); $("sepBest").textContent = b ? String(b) : "—"; }

  function reset() {
    g = { running: false, paused: false, score: 0, lives: LIVES, time: ROUND, water: 0, items: [], pops: [], spawn: 0, elapsed: 0,
      basket: { x: W / 2, y: H - 46, w: basketW(), h: 30, target: null } };
    hud();
  }
  function hud() {
    $("sepScore").textContent = String(g.score);
    $("sepTime").textContent = String(Math.ceil(g.time));
    $("sepLives").textContent = "❤️ " + g.lives; // dar ekranda sığsın diye "❤️ 3" biçimi $("sepLives").setAttribute("aria-label", g.lives + " can");
    $("sepWater").style.width = Math.min(100, g.water) + "%";
  }

  /* Zorluk: süre ilerledikçe düşüş hızı ve sıklığı artar; abur cubur oranı biraz yükselir */
  function spawnItem() {
    var t = g.elapsed / ROUND; // 0 → 1
    var r = Math.random(), kind, emoji;
    var badRate = 0.26 + t * 0.14, waterRate = 0.2;
    if (r < badRate) { kind = "bad"; emoji = BAD[Math.floor(Math.random() * BAD.length)]; }
    else if (r < badRate + waterRate) { kind = "water"; emoji = WATER; }
    else { kind = "good"; emoji = GOOD[Math.floor(Math.random() * GOOD.length)]; }
    var size = Math.max(30, Math.min(42, W * 0.09));
    g.items.push({ kind: kind, emoji: emoji, size: size, x: size / 2 + Math.random() * (W - size), y: -size, vy: (110 + t * 170) * (0.85 + Math.random() * 0.3), rot: (Math.random() - 0.5) * 0.6 });
  }
  function pop(x, y, text, color) { g.pops.push({ x: x, y: y, text: text, color: color, life: 0.8 }); }
  function say(msg) { $("sepLive").textContent = msg; }

  function update(dt) {
    g.elapsed += dt; g.time = Math.max(0, ROUND - g.elapsed);
    // Sepet hareketi: klavye veya parmak/fare hedefi
    var b = g.basket, speed = Math.max(380, W * 1.3);
    if (keys.left) b.x -= speed * dt;
    if (keys.right) b.x += speed * dt;
    if (b.target !== null) b.x += (b.target - b.x) * Math.min(1, dt * 18);
    b.x = Math.min(Math.max(b.x, b.w / 2), W - b.w / 2);
    // Üretim
    g.spawn -= dt;
    var interval = Math.max(0.38, 0.95 - g.elapsed / ROUND * 0.55);
    if (g.spawn <= 0) { spawnItem(); g.spawn = interval * (0.7 + Math.random() * 0.6); }
    // Düşüş ve yakalama
    for (var i = g.items.length - 1; i >= 0; i--) {
      var it = g.items[i];
      it.y += it.vy * dt;
      var caught = it.y + it.size * 0.35 >= b.y - b.h / 2 && it.y - it.size * 0.35 <= b.y + b.h / 2 && Math.abs(it.x - b.x) <= b.w / 2 + it.size * 0.25;
      if (caught) {
        g.items.splice(i, 1);
        if (it.kind === "good") { g.score += 10; pop(it.x, b.y - 30, "+10", "#0f766e"); }
        else if (it.kind === "water") {
          g.score += 5; g.water += 20; pop(it.x, b.y - 30, "+5 💧", "#0284c7");
          if (g.water >= 100) { g.water = 0; g.score += 50; pop(W / 2, H / 2, "Su hedefi! +50", "#0284c7"); say("Su barı doldu, 50 bonus puan"); }
        } else {
          g.lives -= 1; pop(it.x, b.y - 30, "−1 ❤️", "#e11d48"); say("Abur cubur! " + g.lives + " can kaldı");
          if (navigator.vibrate) try { navigator.vibrate(80); } catch (_) {}
        }
        hud();
        continue;
      }
      if (it.y - it.size > H) g.items.splice(i, 1);
    }
    for (var j = g.pops.length - 1; j >= 0; j--) { g.pops[j].life -= dt; g.pops[j].y -= 40 * dt; if (g.pops[j].life <= 0) g.pops.splice(j, 1); }
    if (Math.ceil(g.time) !== Number($("sepTime").textContent)) hud();
    if (g.lives <= 0 || g.time <= 0) end();
  }

  function drawBasket(b) {
    var x = b.x - b.w / 2, y = b.y - b.h / 2, r = 10;
    ctx.save();
    ctx.fillStyle = "#0d9488";
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + b.w, y); ctx.lineTo(x + b.w - 10, y + b.h - r);
    ctx.quadraticCurveTo(x + b.w - 12, y + b.h, x + b.w - 10 - r, y + b.h);
    ctx.lineTo(x + 10 + r, y + b.h); ctx.quadraticCurveTo(x + 12, y + b.h, x + 10, y + b.h - r);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2;
    for (var k = 1; k < 4; k++) { var lx = x + (b.w / 4) * k; ctx.beginPath(); ctx.moveTo(lx, y + 4); ctx.lineTo(lx - 2, y + b.h - 4); ctx.stroke(); }
    ctx.fillStyle = "#0f766e"; ctx.fillRect(x - 4, y - 4, b.w + 8, 8);
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Zemin çizgisi
    ctx.fillStyle = "rgba(13,148,136,.08)"; ctx.fillRect(0, H - 16, W, 16);
    if (!g) return;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#000"; ctx.globalAlpha = 1; // renkli emojiler dolgu renginin saydamlığını alır: tam opak çiz
    g.items.forEach(function (it) {
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
      ctx.font = it.size + "px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
      ctx.fillText(it.emoji, 0, 0); ctx.restore();
    });
    drawBasket(g.basket);
    g.pops.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / 0.8);
      ctx.font = "900 18px system-ui, sans-serif"; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    });
  }

  function loop(ts) {
    if (!g.running || g.paused) return;
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    update(dt); draw();
    if (g.running) raf = requestAnimationFrame(loop);
  }
  function start() {
    resize(); reset();
    g.running = true; last = performance.now();
    $("sepStart").hidden = true; $("sepDone").hidden = true; $("sepPause").hidden = false; $("sepPause").textContent = "⏸";
    say("Oyun başladı");
    raf = requestAnimationFrame(loop);
  }
  function setPaused(p) {
    if (!g || !g.running) return;
    g.paused = p; $("sepPause").textContent = p ? "▶" : "⏸"; $("sepPause").setAttribute("aria-label", p ? "Devam et" : "Duraklat");
    if (!p) { last = performance.now(); raf = requestAnimationFrame(loop); } else say("Duraklatıldı");
  }
  function end() {
    g.running = false; cancelAnimationFrame(raf); draw();
    $("sepPause").hidden = true;
    var best = readBest(), record = g.score > best;
    if (record) { try { localStorage.setItem(BEST_KEY, String(g.score)); } catch (_) {} }
    try { localStorage.setItem("vo_best_sepet", (record ? g.score : best) + " puan"); } catch (_) {}
    showBest();
    $("sepDoneEmoji").textContent = record ? "🏆" : (g.lives <= 0 ? "🍩" : "🧺");
    $("sepDoneTitle").textContent = record ? "Yeni rekor! 🎉" : (g.lives <= 0 ? "Canlar bitti" : "Süre doldu");
    $("sepDoneText").textContent = g.score + " puan topladınız." + (record ? "" : best ? " En iyi skorunuz: " + best + " puan." : "") + " Sağlıklı seçimler için su içmeyi unutmayın 💧";
    $("sepDone").hidden = false; $("sepAgain").focus();
  }

  /* Kontroller: sürükleme / dokunma / fare ve klavye */
  function toLocalX(e) { var r = stage.getBoundingClientRect(); return (e.clientX - r.left); }
  // Düğmelere (Duraklat / Başla) dokunuş sepeti yakalamaz; aksi hâlde işaretçi yakalama tıklamayı düğmeden çalar.
  stage.addEventListener("pointerdown", function (e) { if (e.target.closest && e.target.closest("button")) return; if (g && g.running) { g.basket.target = toLocalX(e); try { stage.setPointerCapture(e.pointerId); } catch (_) {} } });
  stage.addEventListener("pointermove", function (e) { if (g && g.running && (e.pointerType === "mouse" || e.buttons || e.pressure > 0)) g.basket.target = toLocalX(e); });
  stage.addEventListener("pointerup", function () { if (g) g.basket.target = null; });
  stage.addEventListener("pointercancel", function () { if (g) g.basket.target = null; });
  stage.addEventListener("pointerleave", function (e) { if (g && e.pointerType === "mouse") g.basket.target = null; });
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { keys.left = true; e.preventDefault(); }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { keys.right = true; e.preventDefault(); }
    if ((e.key === " " || e.key === "p" || e.key === "P") && g && g.running) { e.preventDefault(); setPaused(!g.paused); }
    if (e.key === "Escape" && !$("sepDone").hidden) $("sepDone").hidden = true;
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden && g && g.running && !g.paused) setPaused(true); });
  window.addEventListener("resize", resize);
  $("sepPlay").addEventListener("click", start);
  $("sepAgain").addEventListener("click", start);
  $("sepPause").addEventListener("click", function () { if (g) setPaused(!g.paused); });

  resize(); reset(); draw(); showBest();
})();
