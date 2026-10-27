const raw = localStorage.getItem("gameResult");

if (!raw) {
  window.location.href = "../index.html";
}

const { score = 0, total = 0, avgTime = "0" } = JSON.parse(raw || "{}");

// ---------- Elementlar ----------
const $ = (id) => document.getElementById(id);
const emojiEl = $("emoji");
const titleEl = $("title");
const subtitleEl = $("subtitle");
const ringEl = $("ring-progress");
const percentEl = $("percent");
const scoreEl = $("stat-score");
const wrongEl = $("stat-wrong");
const timeEl = $("stat-time");
const levelBadge = $("level-badge");
const levelName = $("level-name");
const levelDesc = $("level-desc");
const selectedEl = $("selected-levels");

// ---------- Darajalar ----------
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

const LEVEL_INFO = {
  A1: { name: "Boshlang'ich", desc: "Eng oddiy kundalik so'zlarni bilasiz." },
  A2: { name: "Elementar", desc: "Tanish mavzulardagi so'zlarni yaxshi bilasiz." },
  B1: { name: "O'rta", desc: "Kundalik muloqot uchun yetarli lug'at bor." },
  B2: { name: "O'rta-yuqori", desc: "Murakkab matnlarni tushunadigan darajadasiz." },
  C1: { name: "Ilg'or", desc: "Lug'at boyligingiz juda yaxshi, erkin fikrlay olasiz." },
  C2: { name: "Mukammal", desc: "Ona tili darajasiga yaqin lug'atga egasiz!" },
};

// Tanlangan darajalarni o'qiymiz
let selected;
try {
  selected = JSON.parse(localStorage.getItem("selectedLevels")) || ["all"];
} catch {
  selected = ["all"];
}
if (!Array.isArray(selected) || selected.length === 0) selected = ["all"];

const normalized = selected.map((l) => String(l).toUpperCase());
const isAll = normalized.includes("ALL");
const known = normalized.filter((l) => LEVEL_ORDER.includes(l));

selectedEl.textContent = isAll || known.length === 0 ? "Barchasi" : normalized.join(", ");

// Eng qiyin tanlangan daraja
const maxIdx = isAll || known.length === 0
  ? LEVEL_ORDER.length - 1
  : Math.max(...known.map((l) => LEVEL_ORDER.indexOf(l)));

// ---------- Hisob-kitob ----------
const percent = total > 0 ? Math.round((score / total) * 100) : 0;
const wrong = Math.max(total - score, 0);

function estimateLevel(pct) {
  let drop;
  if (pct >= 85) drop = 0;
  else if (pct >= 70) drop = 1;
  else if (pct >= 50) drop = 2;
  else if (pct >= 30) drop = 3;
  else drop = 4;
  return LEVEL_ORDER[Math.max(maxIdx - drop, 0)];
}

function getVerdict(pct) {
  if (pct >= 90) return { emoji: "🏆", title: "Ajoyib natija!" };
  if (pct >= 70) return { emoji: "🎉", title: "Juda yaxshi!" };
  if (pct >= 50) return { emoji: "👍", title: "Yaxshi harakat!" };
  if (pct >= 30) return { emoji: "💪", title: "Davom eting!" };
  return { emoji: "📚", title: "Mashq qilish kerak" };
}

const level = total > 0 ? estimateLevel(percent) : null;
const verdict = getVerdict(percent);

// ---------- Ko'rsatish ----------
emojiEl.textContent = verdict.emoji;
titleEl.textContent = verdict.title;
subtitleEl.textContent = `${total} ta so'zdan ${score} tasini topdingiz`;
wrongEl.textContent = wrong;
timeEl.textContent = `${avgTime}s`;

if (level) {
  levelBadge.textContent = level;
  levelName.textContent = `${level} · ${LEVEL_INFO[level].name}`;
  levelDesc.textContent = LEVEL_INFO[level].desc;
} else {
  levelName.textContent = "Aniqlab bo'lmadi";
}

// Aylana rangi
const ringColor =
  percent >= 70 ? "text-success" : percent >= 40 ? "text-warning" : "text-error";
ringEl.classList.remove("text-warning");
ringEl.classList.add(ringColor);

// Animatsiya: aylana va sanagich
const CIRCUMFERENCE = 2 * Math.PI * 52;
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    ringEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - percent / 100);
  });
});

function countUp(el, to, suffix = "", duration = 1000) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `${Math.round(to * eased)}${suffix}`;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

countUp(percentEl, percent, "%");
countUp(scoreEl, score);

$("restart-btn").addEventListener("click", () => {
  localStorage.removeItem("gameResult");
  window.location.href = "./game.html";
});

// Asosiy sahifaga (sozlamalar shu yerda)
$("new-game-btn").addEventListener("click", () => {
  localStorage.removeItem("gameResult");
  window.location.href = "../index.html";
});