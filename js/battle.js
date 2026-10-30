import { api, connectSocket, notify, esc } from "./battle-api.js";

const $ = (id) => document.getElementById(id);
const MODE_INFO = {
  battle6: { title: "⚔️ 6 kishilik Battle", fee: 5, cap: 6 },
  duel: { title: "🥊 1 vs 1", fee: 40, cap: 2 },
};

let me = null;
let activeRoom = null;
let canClaim = false;
let mode = null;
let view = "home";
let lb = "wins";
const picked = new Set();

// ---------- Ko'rinishlar ----------
function show(name) {
  view = name;
  ["home", "mode", "wait"].forEach((v) => ($(`view-${v}`).hidden = v !== name));
}

const avatarHtml = (p, size = "") =>
  p?.photo_url
    ? `<img class="avatar-sm" ${size} src="${esc(p.photo_url)}" alt="" />`
    : `<span class="avatar-sm" ${size}>${esc((p?.first_name || "?")[0].toUpperCase())}</span>`;

const levelBadges = (levels) =>
  levels.map((l) => `<span class="badge badge-warning badge-outline">${l.toUpperCase()}</span>`).join(" ");

// ---------- Profil ----------
function renderProfile() {
  $("p-name").textContent = me.first_name + (me.last_name ? " " + me.last_name : "");
  $("p-user").textContent = me.username ? "@" + me.username : "";
  $("p-stats").textContent = `🏆 ${me.wins} g'alaba · 🎮 ${me.games} o'yin`;
  $("coins").textContent = me.coins;
  $("avatar").outerHTML = me.photo_url
    ? `<img id="avatar" class="avatar-sm" style="width:3rem;height:3rem" src="${esc(me.photo_url)}" alt="" />`
    : `<div id="avatar" class="avatar-sm" style="width:3rem;height:3rem">${esc(me.first_name[0].toUpperCase())}</div>`;
}

async function refreshMe() {
  const d = await api("/api/me");
  me = d.me;
  activeRoom = d.activeRoom;
  canClaim = d.canClaimCredit;
  renderProfile();

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
  const { rows } = await api(`/api/leaderboard?type=${lb}`);
  const metric = (r) =>
    lb === "wins" ? `🏆 ${r.wins}` : lb === "coins" ? `🪙 ${r.coins}` : `🎮 ${r.games_7d}`;
  $("lb-list").innerHTML = rows.length
    ? rows
        .map(
          (r, i) => `
      <div class="flex items-center gap-3 rounded-xl px-3 py-2 ${r.tg_id === me.tg_id ? "bg-warning/15" : "bg-base-200/60"}">
        <span class="w-6 text-sm font-bold opacity-70">${i + 1}</span>
        ${avatarHtml(r)}
        <span class="flex-1 truncate font-semibold">${esc(r.first_name)}</span>
        <span class="font-bold">${metric(r)}</span>
      </div>`,
        )
        .join("")
    : `<p class="text-sm opacity-60 text-center py-3">Hali ma'lumot yo'q</p>`;
}

$("lb-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lb]");
  if (!b) return;
  lb = b.dataset.lb;
  document.querySelectorAll("#lb-tabs .tab").forEach((t) => t.classList.toggle("tab-active", t === b));
  loadLeaderboard();
});

// ---------- Rejim va xonalar ----------
document.querySelectorAll(".mode-card").forEach((el) =>
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
  document.querySelectorAll("#lvl-grid .lvl").forEach((b) => {
    const on = picked.has(b.dataset.l);
    b.classList.toggle("btn-warning", on);
    b.classList.toggle("btn-outline", !on);
    b.classList.toggle("btn-neutral", !on);
    b.setAttribute("aria-pressed", String(on));
  });
  const fee = MODE_INFO[mode]?.fee ?? 0;
  const btn = $("create-btn");
  btn.textContent = `➕ O'yin yaratish (${fee} 🪙)`;
  btn.disabled = !picked.size || (me && me.coins < fee);
}

$("lvl-grid").addEventListener("click", (e) => {
  const b = e.target.closest(".lvl");
  if (!b) return;
  picked.has(b.dataset.l) ? picked.delete(b.dataset.l) : picked.add(b.dataset.l);
  renderCreate();
});

$("create-btn").addEventListener("click", async () => {
  try {
    $("create-btn").disabled = true;
    await api("/api/rooms", { method: "POST", body: { mode, levels: [...picked] } });
    await refreshMe();
  } catch (e) {
    notify(e.message);
  } finally {
    renderCreate();
  }
});

async function loadRooms() {
  if (!mode) return;
  const { rooms } = await api(`/api/rooms?mode=${mode}`);
  const info = MODE_INFO[mode];
  $("rooms").innerHTML = rooms.length
    ? rooms
        .map((r) => {
          const creator = r.room_players.find((x) => x.tg_id === r.creator_id)?.players;
          const poor = me.coins < r.entry_fee;
          return `
        <div class="flex items-center justify-between gap-3 rounded-2xl border border-base-300 p-3">
          <div class="min-w-0">
            <p class="font-bold truncate">${esc(creator?.first_name || "O'yinchi")} xonasi</p>
            <div class="flex gap-1 flex-wrap my-1">${levelBadges(r.levels)}</div>
            <p class="text-xs opacity-70">👥 ${r.room_players.length}/${r.capacity} · 🪙 ${r.entry_fee}</p>
          </div>
          <button class="btn btn-warning btn-sm" data-join="${r.id}" ${poor ? "disabled" : ""}>
            ${poor ? "Tanga yetmaydi" : "Kirish"}
          </button>
        </div>`;
        })
        .join("")
    : `<p class="text-sm opacity-60 text-center py-3">Hozircha o'yin yo'q. Birinchi bo'lib yarating!</p>`;
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
  $("wait-meta").textContent = `${MODE_INFO[r.mode].title} · ${r.room_players.length}/${r.capacity} · kirish ${r.entry_fee} 🪙`;
  $("wait-levels").innerHTML = levelBadges(r.levels);
  $("wait-players").innerHTML = r.room_players
    .map(
      (rp) => `
    <div class="flex items-center gap-3 rounded-xl bg-base-200/60 px-3 py-2">
      ${avatarHtml(rp.players)}
      <span class="font-semibold truncate">${esc(rp.players.first_name)}</span>
      ${rp.tg_id === r.creator_id ? '<span class="badge badge-warning badge-sm ml-auto">xona egasi</span>' : ""}
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
  await refreshMe();
  $("m-coins").textContent = me.coins;
  $("m-debt").textContent = me.debt ? `(qarz: ${me.debt})` : "";
  const btn = $("credit-btn");
  btn.disabled = !canClaim;
  $("credit-note").textContent = canClaim
    ? ""
    : me.coins > 0
      ? "Hisobingizda tanga bor."
      : activeRoom
        ? "O'yin paytida olib bo'lmaydi."
        : "Bugun kredit olgansiz, ertaga qayta urinib ko'ring.";
  $("coin-modal").showModal();
});

$("credit-btn").addEventListener("click", async () => {
  try {
    await api("/api/credit", { method: "POST" });
    $("coin-modal").close();
    await refreshMe();
    notify("Hisobingizga 50 tanga qo'shildi!");
  } catch (e) {
    notify(e.message);
  }
});

// ---------- Socket ----------
const socket = connectSocket();
socket.on("room:started", ({ roomId }) => {
  location.href = `./pages/battle-play.html?room=${roomId}`;
});
let t;
socket.on("lobby:changed", () => {
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
    $("p-name").textContent = "Xatolik";
    notify(e.message);
  }
})();