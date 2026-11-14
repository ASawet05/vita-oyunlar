/* VitaMağaza, ana menü panelleri (banka, görevler, günlük kelime) ve Gizemli Kapsül açılışı — DOM arayüzü.
   Satın alma / seçim değişince onChange() ile 3D karakter anında güncellenir (mağaza alt pencere; karakter arkada görünür). */
import { CHARACTERS, BOARDS, ACCESSORIES, PRICES, UPGRADES, UPG_PRICES, UPG_MAX, upgDuration, saveProfile, missionText, rollBox } from "./kayit.js";

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function createMenu({ getProfile, sfx, onChange, toast }) {
  let tab = "chars";
  const P = () => getProfile();
  const persist = () => { saveProfile(P()); renderHome(); renderStore(); onChange(); };

  function renderHome() {
    const p = P();
    $("dkBank").textContent = String(p.bank);
    $("dkBoardStock").textContent = String(p.boards);
    $("dkMult").textContent = "x" + p.multiplier;
    $("dkMissions").innerHTML = p.missions.map(m => {
      const pct = Math.min(100, Math.round(m.progress / m.target * 100));
      return `<li class="dk-mission${m.done ? " is-done" : ""}"><span>${m.done ? "✅" : "🎯"} ${esc(missionText(m))}</span><b>${m.done ? "Tamam" : `${m.progress}/${m.target}`}</b><i style="width:${pct}%"></i></li>`;
    }).join("");
    renderWord($("dkWordHome"), p.word);
    const boxBadge = $("dkBoxBadge"); if (boxBadge) { boxBadge.textContent = String(p.boxes); boxBadge.hidden = !p.boxes; }
  }
  function renderWord(el, w) {
    if (!el) return;
    const letters = [...w.word];
    el.innerHTML = letters.map((ch, i) => `<span class="dk-wl${i < w.got ? " is-got" : ""}${i === w.got && !w.done ? " is-next" : ""}">${esc(ch)}</span>`).join("") + (w.done ? `<span class="dk-wdone">✓</span>` : "");
    el.setAttribute("aria-label", `Günün kelimesi ${w.word}: ${w.got}/${letters.length} harf${w.done ? ", tamamlandı" : ""}`);
  }

  /* ---------- Mağaza ---------- */
  function price(n) { return `<span class="dk-price">💧 ${n}</span>`; }
  function card({ id, title, desc, swatch, state, action, kind, extra }) {
    return `<div class="dk-item${state === "selected" ? " is-sel" : ""}" data-kind="${kind}" data-id="${id}">
      <div class="dk-item-ico">${swatch}</div>
      <div class="dk-item-txt"><b>${esc(title)}</b><small>${esc(desc)}</small>${extra || ""}</div>
      <div class="dk-item-act">${action}</div></div>`;
  }
  const sw = (a, b) => `<i class="dk-sw" style="--a:${a};--b:${b}"></i>`;
  function renderStore() {
    const body = $("dkStoreBody"); if (!body) return;
    const p = P();
    $("dkStoreBank").textContent = String(p.bank);
    document.querySelectorAll("#dkStore [data-tab]").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    let html = "";
    if (tab === "chars") {
      html = Object.entries(CHARACTERS).map(([id, c]) => {
        const owned = p.owned.chars.includes(id), sel = p.sel.char === id;
        const action = sel ? `<span class="dk-tag">Seçili</span>` : owned ? `<button type="button" class="dk-btn" data-act="select-char">Seç</button>`
          : c.price == null ? `<span class="dk-tag dk-tag--lock">🧬 ${p.dna}/3</span>` : `<button type="button" class="dk-btn dk-btn--buy" data-act="buy-char" ${p.bank < c.price ? "disabled" : ""}>${price(c.price)}</button>`;
        return card({ id, kind: "char", title: c.name, desc: c.desc, swatch: sw(c.swatch[0], c.swatch[1]), state: sel ? "selected" : "", action });
      }).join("");
    } else if (tab === "boards") {
      html = card({ id: "stock", kind: "stock", title: "Nano-Kaykay (tüketilebilir)", desc: "Stoktaki kaykay: çift dokun / çift tık / Boşluk / E ile 15 sn. Önden çarpmada engeli parçalayıp seni kurtarır.", swatch: `<span class="dk-emoji">🛹</span>`, extra: `<em class="dk-have">Stok: ${p.boards}</em>`, action: `<button type="button" class="dk-btn dk-btn--buy" data-act="buy-board" ${p.bank < PRICES.board ? "disabled" : ""}>${price(PRICES.board)}</button>` });
      html += Object.entries(BOARDS).map(([id, b]) => {
        const owned = p.owned.boards.includes(id), sel = p.sel.board === id;
        const action = sel ? `<span class="dk-tag">Seçili</span>` : owned ? `<button type="button" class="dk-btn" data-act="select-board">Seç</button>` : `<button type="button" class="dk-btn dk-btn--buy" data-act="buy-model" ${p.bank < b.price ? "disabled" : ""}>${price(b.price)}</button>`;
        return card({ id, kind: "model", title: b.name, desc: b.desc, swatch: sw(id === "magnezyum" ? "#a855f7" : "#2dd4bf", id === "magnezyum" ? "#6d28d9" : "#0f766e"), state: sel ? "selected" : "", action });
      }).join("");
    } else if (tab === "upg") {
      html = Object.entries(UPGRADES).map(([id, u]) => {
        const lv = p.upg[id] || 0, max = lv >= UPG_MAX, cost = UPG_PRICES[lv];
        const pips = Array.from({ length: UPG_MAX }, (_, i) => `<i class="${i < lv ? "is-on" : ""}"></i>`).join("");
        const action = max ? `<span class="dk-tag">MAKS</span>` : `<button type="button" class="dk-btn dk-btn--buy" data-act="buy-upg" ${p.bank < cost ? "disabled" : ""}>${price(cost)}</button>`;
        return card({ id, kind: "upg", title: u.name, desc: u.desc, swatch: `<span class="dk-emoji">${u.icon}</span>`, extra: `<span class="dk-pips" aria-label="Seviye ${lv}/${UPG_MAX}">${pips}</span><em class="dk-have">Süre: ${upgDuration(p, id)} sn${max ? "" : ` → ${upgDuration(p, id) + 2} sn`}</em>`, action });
      }).join("");
    } else if (tab === "acc") {
      html = Object.entries(ACCESSORIES).map(([id, a]) => {
        const owned = p.owned.acc.includes(id), on = !!p.sel.acc[id];
        const action = owned ? `<button type="button" class="dk-btn${on ? " is-on" : ""}" data-act="toggle-acc" aria-pressed="${on}">${on ? "Takılı ✓" : "Tak"}</button>` : `<button type="button" class="dk-btn dk-btn--buy" data-act="buy-acc" ${p.bank < a.price ? "disabled" : ""}>${price(a.price)}</button>`;
        return card({ id, kind: "acc", title: a.name, desc: a.desc, swatch: `<span class="dk-emoji">${id === "visor" ? "🥽" : id === "cape" ? "🧣" : "🪽"}</span>`, state: on ? "selected" : "", action });
      }).join("");
      const dnaPct = Math.min(100, p.dna / 3 * 100), efs = p.owned.chars.includes("efsane");
      html += `<div class="dk-collect"><div class="dk-collect-head"><span class="dk-emoji">🧬</span><div><b>Altın DNA Sarmalı Koleksiyonu</b><small>Gizemli Kapsüllerden nadiren düşer. 3 parça = <b>Efsanevi Biyo-Muhafız</b></small></div><strong class="dk-dna" id="dkDnaCount">${p.dna}/3</strong></div>
        <div class="dk-dna-bar"><i style="width:${dnaPct}%"></i></div>
        <p class="dk-collect-note">${efs ? "🏆 Efsanevi Biyo-Muhafız açıldı! Karakterler sekmesinden seçebilirsiniz." : `${3 - p.dna} parça daha gerekli.`}</p></div>`;
    } else if (tab === "box") {
      html = `<div class="dk-boxshop">
        <div class="dk-boxshop-ico" aria-hidden="true">💊</div>
        <p><b>Gizemli Biyo-Kapsül</b><br><small>Sıradan: +60 damla / +2 kaykay · Nadir: +250 damla / +1x çarpan · Efsanevi: aksesuar veya Altın DNA</small></p>
        <p class="dk-have">Envanter: <b id="dkBoxCount">${p.boxes}</b> kapsül</p>
        <div class="dk-boxshop-acts">
          <button type="button" class="dk-btn dk-btn--buy" data-act="buy-box" ${p.bank < PRICES.box ? "disabled" : ""}>Satın al ${price(PRICES.box)}</button>
          <button type="button" class="dk-btn dk-btn--open" data-act="open-box" ${p.boxes ? "" : "disabled"}>🎁 Aç</button>
        </div></div>`;
    }
    body.innerHTML = html;
  }
  function spend(n) { const p = P(); if (p.bank < n) { sfx.lane(); toast("Yeterli damla yok", "level"); return false; } p.bank -= n; sfx.buy(); return true; }
  document.addEventListener("click", (e) => {
    const t = e.target.closest ? e.target : null; if (!t) return;
    const tb = t.closest("#dkStore [data-tab]");
    if (tb) { tab = tb.dataset.tab; renderStore(); return; }
    const btn = t.closest("#dkStore [data-act]"); if (!btn) return;
    const item = btn.closest(".dk-item"), id = item && item.dataset.id, act = btn.dataset.act, p = P();
    if (act === "select-char") { p.sel.char = id; sfx.lane(); }
    else if (act === "buy-char") { if (!spend(CHARACTERS[id].price)) return; p.owned.chars.push(id); p.sel.char = id; toast(`${CHARACTERS[id].name} açıldı!`, "turbo"); }
    else if (act === "buy-board") { if (!spend(PRICES.board)) return; p.boards += 1; }
    else if (act === "select-board") { p.sel.board = id; sfx.lane(); }
    else if (act === "buy-model") { if (!spend(BOARDS[id].price)) return; p.owned.boards.push(id); p.sel.board = id; toast(`${BOARDS[id].name} açıldı!`, "turbo"); }
    else if (act === "toggle-acc") { p.sel.acc[id] = !p.sel.acc[id]; sfx.lane(); }
    else if (act === "buy-acc") { if (!spend(ACCESSORIES[id].price)) return; p.owned.acc.push(id); p.sel.acc[id] = true; toast(`${ACCESSORIES[id].name} takıldı!`, "turbo"); }
    else if (act === "buy-upg") { const lv = p.upg[id] || 0; if (lv >= UPG_MAX || !spend(UPG_PRICES[lv])) return; p.upg[id] = lv + 1; toast(`${UPGRADES[id].name}: ${upgDuration(p, id)} sn`, "turbo"); }
    else if (act === "buy-box") { if (!spend(PRICES.box)) return; p.boxes += 1; }
    else if (act === "open-box") { openBox(); return; }
    persist();
  });

  function openStore(t) { if (t) tab = t; $("dkStore").hidden = false; renderStore(); const c = $("dkStoreClose"); if (c) c.focus(); }
  function closeStore() { $("dkStore").hidden = true; }
  $("dkStoreClose").addEventListener("click", closeStore);

  /* ---------- Gizemli Kapsül açılışı: sallanma → ışık patlaması → ödül ---------- */
  let opening = false;
  function openBox() {
    const p = P(); if (!p.boxes || opening) return;
    opening = true; p.boxes -= 1;
    const res = rollBox(p);
    saveProfile(p);
    const m = $("dkBoxOpen"), cap = $("dkBoxCap"), out = $("dkBoxResult");
    m.hidden = false; m.dataset.rarity = res.rarity;
    cap.className = "dk-box-cap is-shaking"; out.hidden = true; $("dkBoxOk").hidden = true;
    sfx.box();
    setTimeout(() => { cap.className = "dk-box-cap is-burst"; }, 1100);
    setTimeout(() => {
      out.hidden = false;
      out.innerHTML = `<span class="dk-rar dk-rar--${res.rarity}">${res.rarity === "legendary" ? "EFSANEVİ" : res.rarity === "rare" ? "NADİR" : "SIRADAN"}</span><span class="dk-box-icon">${res.icon}</span><b>${esc(res.label)}</b>${res.dna && p.dna >= 3 ? `<small>🏆 Efsanevi Biyo-Muhafız açıldı!</small>` : ""}`;
      $("dkBoxOk").hidden = false; $("dkBoxOk").focus();
      opening = false; renderHome(); renderStore(); onChange();
    }, 1500);
  }
  $("dkBoxOk").addEventListener("click", () => { $("dkBoxOpen").hidden = true; });

  return { renderHome, renderWord, openStore, closeStore, renderStore, openBox, isOpen: () => !$("dkStore").hidden || !$("dkBoxOpen").hidden };
}
