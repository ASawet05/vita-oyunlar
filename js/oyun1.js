/* Vitamin Hafıza Eşleştirme — saf JS, dış kütüphane yok.
   Her çift: bir vitamin/mineral kartı + onun iyi bir besin kaynağı kartı. Eşleşince kısa bir bilgi gösterilir. */
(function () {
  "use strict";
  var PAIRS = [
    { id: "d", badge: "D", name: "D vitamini", food: "Somon", emoji: "🐟", fact: "Yağlı balıklar D vitamininin iyi besin kaynaklarındandır; vücudun asıl kaynağı ise güneş ışığıdır." },
    { id: "c", badge: "C", name: "C vitamini", food: "Portakal", emoji: "🍊", fact: "C vitamini ısıya duyarlıdır; çiğ meyve ve sebzelerde daha iyi korunur. Demir emilimini de artırır." },
    { id: "a", badge: "A", name: "A vitamini", food: "Havuç", emoji: "🥕", fact: "Havuçtaki beta-karoten vücutta A vitaminine dönüşür; göz sağlığı için önemlidir." },
    { id: "ca", badge: "Ca", name: "Kalsiyum", food: "Süt & yoğurt", emoji: "🥛", fact: "Süt ürünleri, vücudun kolay kullandığı kalsiyum kaynaklarıdır; kemik ve dişler için gereklidir." },
    { id: "b12", badge: "B12", name: "B12 vitamini", food: "Yumurta", emoji: "🥚", fact: "B12 neredeyse yalnızca hayvansal besinlerde bulunur; vegan beslenenlerde takviye gerekebilir." },
    { id: "fe", badge: "Fe", name: "Demir", food: "Kırmızı et", emoji: "🥩", fact: "Etteki (hem) demir bitkisel demirden daha iyi emilir; çay ve kahve demir emilimini azaltır." },
    { id: "mg", badge: "Mg", name: "Magnezyum", food: "Kuruyemiş", emoji: "🥜", fact: "Kuruyemişler, tam tahıllar ve yeşil yapraklı sebzeler iyi magnezyum kaynaklarıdır." },
    { id: "k", badge: "K", name: "Potasyum", food: "Muz", emoji: "🍌", fact: "Muz, patates ve baklagiller potasyumdan zengindir; kas ve kalp çalışması için önemlidir." },
    { id: "b9", badge: "B9", name: "Folat", food: "Ispanak", emoji: "🥬", fact: "Folat yeşil yapraklı sebzelerde bolca bulunur; gebelik döneminde özellikle önemlidir." },
    { id: "kv", badge: "Vit K", name: "K vitamini", food: "Brokoli", emoji: "🥦", fact: "Brokoli ve yeşil yapraklılar K vitamini kaynağıdır; K vitamini kanın pıhtılaşmasında rol alır." },
    { id: "zn", badge: "Zn", name: "Çinko", food: "Kabak çekirdeği", emoji: "🎃", fact: "Kabak çekirdeği, et ve baklagiller çinko içerir; çinko bağışıklık için gereklidir." },
    { id: "o3", badge: "Ω3", name: "Omega-3", food: "Ceviz", emoji: "🌰", fact: "Ceviz bitkisel omega-3 (ALA) içerir; balıktaki EPA ve DHA ise vücut tarafından daha doğrudan kullanılır." }
  ];
  var LEVELS = { kolay: { pairs: 6, cols: 3, label: "Kolay" }, normal: { pairs: 8, cols: 4, label: "Normal" }, zor: { pairs: 10, cols: 5, label: "Zor" } };
  var BEST_KEY = "vo_hafiza_best_v1";

  var $ = function (id) { return document.getElementById(id); };
  var grid = $("memGrid");
  var st = { level: "normal", deck: [], open: [], lock: false, moves: 0, matched: 0, start: 0, timer: null };

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmt(sec) { return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
  function readBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || "{}") || {}; } catch (_) { return {}; } }
  function writeBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (_) {} }
  function showBest() {
    var b = readBest()[st.level];
    $("memBest").textContent = b ? b.moves + " hamle" : "—";
  }

  function newGame() {
    clearInterval(st.timer);
    var L = LEVELS[st.level];
    var chosen = shuffle(PAIRS.slice()).slice(0, L.pairs);
    var cards = [];
    chosen.forEach(function (p) {
      cards.push({ pair: p.id, kind: "nutrient", p: p });
      cards.push({ pair: p.id, kind: "food", p: p });
    });
    st.deck = shuffle(cards); st.open = []; st.lock = false; st.moves = 0; st.matched = 0; st.start = 0; st.timer = null;
    grid.className = "mem-grid cols-" + L.cols;
    grid.innerHTML = "";
    st.deck.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "mem-card"; b.dataset.i = String(i);
      b.setAttribute("aria-label", "Kapalı kart " + (i + 1));
      var front = c.kind === "nutrient"
        ? '<div class="mem-face mem-front is-nutrient"><span class="badge">' + c.p.badge + '</span><span class="t">' + c.p.name + '</span><span class="k">Vitamin / mineral</span></div>'
        : '<div class="mem-face mem-front"><span class="e" aria-hidden="true">' + c.p.emoji + '</span><span class="t">' + c.p.food + '</span><span class="k">Besin</span></div>';
      b.innerHTML = '<div class="mem-inner"><div class="mem-face mem-back" aria-hidden="true">❓</div>' + front + '</div>';
      grid.appendChild(b);
    });
    $("memMoves").textContent = "0"; $("memPairs").textContent = "0/" + L.pairs; $("memTime").textContent = "0:00";
    $("memFact").textContent = "Bir vitamin kartı ile onun besin kartını bulun. 💡";
    $("memDone").hidden = true;
    showBest();
  }

  function label(c) { return c.kind === "nutrient" ? c.p.name : c.p.food + " (besin)"; }
  function flip(btn) {
    var i = Number(btn.dataset.i), c = st.deck[i];
    if (st.lock || btn.classList.contains("is-up") || btn.classList.contains("is-done")) return;
    if (!st.start) { st.start = Date.now(); st.timer = setInterval(function () { $("memTime").textContent = fmt(Math.floor((Date.now() - st.start) / 1000)); }, 500); }
    btn.classList.add("is-up"); btn.setAttribute("aria-label", label(c));
    st.open.push(btn);
    if (st.open.length < 2) return;
    st.moves++; $("memMoves").textContent = String(st.moves);
    var a = st.open[0], b2 = st.open[1], ca = st.deck[Number(a.dataset.i)], cb = st.deck[Number(b2.dataset.i)];
    st.open = [];
    if (ca.pair === cb.pair && ca.kind !== cb.kind) {
      [a, b2].forEach(function (x) { x.classList.remove("is-up"); x.classList.add("is-done"); x.setAttribute("aria-label", label(st.deck[Number(x.dataset.i)]) + " — eşleşti"); });
      st.matched++;
      $("memPairs").textContent = st.matched + "/" + LEVELS[st.level].pairs;
      $("memFact").innerHTML = "<span>✅ <b>" + ca.p.name + " ↔ " + ca.p.food + ":</b> " + ca.p.fact + "</span>";
      if (st.matched === LEVELS[st.level].pairs) finish();
    } else {
      st.lock = true;
      [a, b2].forEach(function (x) { x.classList.add("is-wrong"); });
      setTimeout(function () {
        [a, b2].forEach(function (x) { x.classList.remove("is-up", "is-wrong"); x.setAttribute("aria-label", "Kapalı kart " + (Number(x.dataset.i) + 1)); });
        st.lock = false;
      }, 900);
    }
  }

  function finish() {
    clearInterval(st.timer);
    var sec = Math.max(1, Math.floor((Date.now() - st.start) / 1000));
    var all = readBest(), prev = all[st.level];
    var record = !prev || st.moves < prev.moves || (st.moves === prev.moves && sec < prev.sec);
    if (record) { all[st.level] = { moves: st.moves, sec: sec }; writeBest(all); }
    try { localStorage.setItem("vo_best_hafiza", LEVELS[st.level].label + ": " + (record ? st.moves : prev.moves) + " hamle"); } catch (_) {}
    showBest();
    $("memDoneTitle").textContent = record ? "Yeni rekor! 🎉" : "Tebrikler!";
    $("memDoneText").textContent = LEVELS[st.level].label + " seviyesini " + st.moves + " hamlede, " + fmt(sec) + " sürede tamamladınız." + (record ? "" : " En iyi skorunuz: " + prev.moves + " hamle.");
    setTimeout(function () { $("memDone").hidden = false; $("memAgain").focus(); }, 500);
  }

  grid.addEventListener("click", function (e) { var b = e.target.closest(".mem-card"); if (b) flip(b); });
  document.querySelectorAll(".mem-level").forEach(function (b) {
    b.addEventListener("click", function () {
      st.level = b.dataset.level;
      document.querySelectorAll(".mem-level").forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-checked", on ? "true" : "false"); });
      newGame();
    });
  });
  $("memRestart").addEventListener("click", newGame);
  $("memAgain").addEventListener("click", newGame);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("memDone").hidden) $("memDone").hidden = true; });
  newGame();
})();
