import {
  api,
  connectSocket,
  notify,
  esc,
  hasAuth,
  debugInfo,
} from "./battle-api.js";
import { PAY } from "./config.js";

const $ = (id) => document.getElementById(id);
const COIN = '<i class="coin"></i>';

const MODE_INFO = {
  battle6: { title: "⚔️ 6 kishilik Battle", fee: 5, cap: 6 },
  duel: { title: "🥊 1 vs 1", fee: 8, cap: 2 },
};

let me = null;
let activeRoom = null;
let canClaim = false;
let mode = null;
let view = "home";
let lb = "wins";
const picked = new Set();

// ---------- Yordamchilar ----------
function show(name) {
  view = name;
  ["home", "mode", "wait"].forEach((v) => ($(`view-${v}`).hidden = v !== name));
}

const avatarHtml = (p, lg = false) =>
  p?.photo_url
    ? `<img class="bt-avatar ${lg ? "lg" : ""}" src="${esc(p.photo_url)}" alt="" />`
    : `<span class="bt-avatar ${lg ? "lg" : ""}">${esc((p?.first_name || "?")[0].toUpperCase())}</span>`;

const levelBadges = (levels) =>
  levels
    .map((l) => `<span class="bt-badge">${l.toUpperCase()}</span>`)
    .join("");

const slots = (n, cap) =>
  `<span class="bt-slots">${Array.from({ length: cap }, (_, i) => `<i class="bt-slot ${i < n ? "on" : ""}"></i>`).join("")}</span>`;

// ---------- Profil ----------
function renderProfile() {
  $("p-name").textContent =
    me.first_name + (me.last_name ? " " + me.last_name : "");
  $("p-user").textContent = me.username ? "@" + me.username : "";
  $("p-stats").textContent = `🏆 ${me.wins} g'alaba · 🎮 ${me.games} o'yin`;
  $("coins").textContent = me.coins;
  $("avatar").innerHTML = avatarHtml(me, true);
}

// ---------- Ism ----------
const nameModal = $("name-modal");
let nameRequired = false;

function openName(required) {
  nameRequired = required;
  const full = me.first_name + (me.last_name ? " " + me.last_name : "");
  $("name-input").value =
    me.name_set || required === false ? full : full === "Mehmon" ? "" : full;
  $("name-err").textContent = "";
  $("name-cancel").hidden = required;
  if (!nameModal.open) nameModal.showModal();
  $("name-input").focus();
}

// Majburiy bo'lsa, Esc bilan yopib bo'lmaydi
nameModal.addEventListener("cancel", (e) => {
  if (nameRequired) e.preventDefault();
});
$("name-cancel").addEventListener("click", () => nameModal.close());
$("edit-name").addEventListener("click", () => me && openName(false));

async function saveName() {
  const v = $("name-input").value.trim();
  if (v.length < 2) {
    $("name-err").textContent = "Kamida 2 ta belgi kiriting.";
    return;
  }
  try {
    $("name-save").disabled = true;
    await api("/api/name", { method: "POST", body: { name: v } });
    nameRequired = false;
    nameModal.close();
    await refreshMe();
  } catch (e) {
    $("name-err").textContent = e.message;
  } finally {
    $("name-save").disabled = false;
  }
}
$("name-save").addEventListener("click", saveName);
$("name-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveName();
});

async function refreshMe() {
  const d = await api("/api/me");
  me = d.me;
  activeRoom = d.activeRoom;
  canClaim = d.canClaimCredit;
  renderProfile();

  if (!me.name_set && !nameModal.open) openName(true);

  if (activeRoom?.status === "playing") {
    location.href = `./pages/battle-play.html?room=${activeRoom.id}`;
    return;
  }
  if (activeRoom) {
    renderWait();
    show("wait");
  } else if (view === "wait") {
    show(mode ? "mode" : "home");
  }
}

// ---------- Reyting ----------
async function loadLeaderboard() {
  try {
    const { rows } = await api(`/api/leaderboard?type=${lb}`);
    const medals = ["🥇", "🥈", "🥉"];
    const metric = (r) =>
      lb === "wins"
        ? `🏆 ${r.wins}`
        : lb === "coins"
          ? `${COIN} ${r.coins}`
          : `🎮 ${r.games_7d}`;

    $("lb-list").innerHTML = rows.length
      ? rows
          .map(
            (r, i) => `
        <div class="bt-row ${r.tg_id === me.tg_id ? "me" : ""}">
          <span class="bt-rank">${medals[i] || i + 1}</span>
          ${avatarHtml(r)}
          <span class="bt-grow">${esc(r.first_name)}</span>
          <span class="bt-val">${metric(r)}</span>
        </div>`,
          )
          .join("")
      : `<p class="bt-empty">Hali ma'lumot yo'q. Birinchi bo'ling!</p>`;
  } catch {
    $("lb-list").innerHTML =
      `<p class="bt-empty">Reytingni yuklab bo'lmadi</p>`;
  }
}

$("lb-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lb]");
  if (!b) return;
  lb = b.dataset.lb;
  document
    .querySelectorAll("#lb-tabs .bt-tab")
    .forEach((t) => t.classList.toggle("active", t === b));
  loadLeaderboard();
});

// ---------- Rejim va xonalar ----------
document.querySelectorAll(".bt-mode").forEach((el) =>
  el.addEventListener("click", () => {
    mode = el.dataset.mode;
    $("mode-title").textContent = MODE_INFO[mode].title;
    show("mode");
    renderCreate();
    loadRooms();
  }),
);

$("back-home").addEventListener("click", () => {
  mode = null;
  show("home");
  loadLeaderboard();
});

function renderCreate() {
  document.querySelectorAll("#lvl-grid .bt-lvl").forEach((b) => {
    const on = picked.has(b.dataset.l);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });

  const fee = MODE_INFO[mode]?.fee ?? 0;
  let hint = "";
  if (!picked.size) hint = "Avval kamida bitta daraja tanlang.";
  else if (me && me.coins < fee) hint = "Tangalaringiz yetarli emas.";

  $("create-btn").innerHTML = `➕ O'yin yaratish (${fee} ${COIN})`;
  $("create-btn").disabled = Boolean(hint);
  $("create-hint").textContent = hint;
}

$("lvl-grid").addEventListener("click", (e) => {
  const b = e.target.closest(".bt-lvl");
  if (!b) return;
  picked.has(b.dataset.l)
    ? picked.delete(b.dataset.l)
    : picked.add(b.dataset.l);
  renderCreate();
});

$("create-btn").addEventListener("click", async () => {
  try {
    $("create-btn").disabled = true;
    await api("/api/rooms", {
      method: "POST",
      body: { mode, levels: [...picked] },
    });
    await refreshMe();
  } catch (e) {
    notify(e.message);
  } finally {
    renderCreate();
  }
});

async function loadRooms() {
  if (!mode) return;
  try {
    const { rooms } = await api(`/api/rooms?mode=${mode}`);
    $("rooms").innerHTML = rooms.length
      ? rooms
          .map((r) => {
            const creator = r.room_players.find(
              (x) => x.tg_id === r.creator_id,
            )?.players;
            const poor = me.coins < r.entry_fee;
            return `
          <div class="bt-room">
            <div class="bt-room-main">
              ${avatarHtml(creator)}
              <div class="bt-room-info">
                <span class="bt-grow">${esc(creator?.first_name || "O'yinchi")} xonasi</span>
                <div class="bt-chips">${levelBadges(r.levels)}</div>
                <div class="bt-meta">
                  ${slots(r.room_players.length, r.capacity)}
                  <span>${r.room_players.length}/${r.capacity}</span>
                  <span>${COIN} ${r.entry_fee}</span>
                </div>
              </div>
            </div>
            <button class="bt-btn primary sm" data-join="${r.id}" ${poor ? "disabled" : ""}>
              ${poor ? "Tanga yo'q" : "Kirish"}
            </button>
          </div>`;
          })
          .join("")
      : `<p class="bt-empty">Hozircha o'yin yo'q.<br />Birinchi bo'lib yarating!</p>`;
  } catch (e) {
    $("rooms").innerHTML = `<p class="bt-empty">${esc(e.message)}</p>`;
  }
}

$("rooms").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-join]");
  if (!b) return;
  b.disabled = true;
  try {
    await api(`/api/rooms/${b.dataset.join}/join`, { method: "POST" });
    await refreshMe();
  } catch (err) {
    notify(err.message);
    loadRooms();
  }
});

// ---------- Kutish xonasi ----------
function renderWait() {
  const r = activeRoom;
  $("wait-meta").innerHTML =
    `${MODE_INFO[r.mode].title} · ${r.room_players.length}/${r.capacity} · kirish ${r.entry_fee} ${COIN}`;
  $("wait-levels").innerHTML = levelBadges(r.levels);
  $("wait-players").innerHTML = r.room_players
    .map(
      (rp) => `
    <div class="bt-row">
      ${avatarHtml(rp.players)}
      <span class="bt-grow">${esc(rp.players.first_name)}</span>
      ${rp.tg_id === r.creator_id ? '<span class="bt-badge">xona egasi</span>' : ""}
    </div>`,
    )
    .join("");
}

$("leave-btn").addEventListener("click", async () => {
  try {
    await api(`/api/rooms/${activeRoom.id}/leave`, { method: "POST" });
    activeRoom = null;
    await refreshMe();
    show(mode ? "mode" : "home");
    loadRooms();
  } catch (e) {
    notify(e.message);
  }
});

// ---------- Tangalar oynasi ----------
$("plus-btn").addEventListener("click", async () => {
  try {
    await refreshMe();
  } catch (e) {
    return notify(e.message);
  }
  $("m-coins").textContent = me.coins;
  $("m-debt").textContent = me.debt ? `(qarz: ${me.debt})` : "";
  $("credit-btn").disabled = !canClaim;
  $("credit-note").textContent = canClaim
    ? ""
    : me.coins > 0
      ? "Hisobingizda tanga bor."
      : activeRoom
        ? "O'yin paytida olib bo'lmaydi."
        : "Bugun kredit olgansiz, ertaga qayta urinib ko'ring.";
  $("coin-modal").showModal();
});

$("modal-close").addEventListener("click", () => $("coin-modal").close());

// ---------- Sotib olish ----------
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {}
  ta.remove();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    fallbackCopy(text);
  }
}

async function copyWithFeedback(btn, text) {
  await copyText(text);
  const old = btn.textContent;
  btn.textContent = "Nusxalandi ✓";
  setTimeout(() => (btn.textContent = old), 1500);
}

const fullName = () => me.first_name + (me.last_name ? " " + me.last_name : "");

$("buy-btn").addEventListener("click", () => {
  $("pay-card").textContent = PAY.card;
  $("pay-card").dataset.raw = PAY.card.replace(/\s/g, "");
  $("pay-owner").textContent = PAY.owner;
  $("pay-amount").textContent = PAY.amount;
  $("pay-code").textContent = me.pay_code;
  $("pay-contact").textContent = "@" + PAY.contact;
  $("pay-link").href = `https://t.me/${PAY.contact}`;
  $("coin-modal").close();
  $("pay-modal").showModal();
});

$("pay-link").addEventListener("click", (e) => {
  if (tg?.openTelegramLink && tg.initData) {
    e.preventDefault();
    tg.openTelegramLink(`https://t.me/${PAY.contact}`);
  }
});

document.querySelectorAll("[data-copy]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const el = $(btn.dataset.copy);
    copyWithFeedback(btn, el.dataset.raw ?? el.textContent);
  }),
);

$("copy-msg").addEventListener("click", (e) => {
  copyWithFeedback(
    e.currentTarget,
    `Kod: ${me.pay_code}\nIsm Familiya: ${fullName()}\nSumma: ${PAY.amount} so'm (${PAY.coins} tanga)`,
  );
});

$("pay-close").addEventListener("click", () => $("pay-modal").close());

$("credit-btn").addEventListener("click", async () => {
  try {
    await api("/api/credit", { method: "POST" });
    $("coin-modal").close();
    await refreshMe();
    notify("Hisobingizga 45 tanga qo'shildi!");
  } catch (e) {
    notify(e.message);
  }
});

// ---------- Socket (faqat kirgan bo'lsa) ----------
const socket = hasAuth ? connectSocket() : null;
let t;
socket?.on("room:started", ({ roomId }) => {
  location.href = `./pages/battle-play.html?room=${roomId}`;
});
socket?.on("lobby:changed", () => {
  clearTimeout(t);
  t = setTimeout(async () => {
    try {
      await refreshMe();
      if (view === "mode") loadRooms();
      if (view === "home") loadLeaderboard();
    } catch {}
  }, 300);
});

// ---------- Boshlash ----------
(async () => {
  try {
    await refreshMe();
    if (view === "home") loadLeaderboard();
  } catch (e) {
    $("p-name").textContent = "Kirish amalga oshmadi";
    $("avatar").innerHTML = '<span class="bt-avatar lg">!</span>';
    $("error-box").innerHTML = `<span>${esc(e.message)}</span>
  <small style="opacity:.7">${esc(debugInfo())}</small>
  <button class="bt-btn outline sm" onclick="location.reload()">Qayta urinish</button>`;
    $("error-box").hidden = false;
    show("none");
  }
})();
