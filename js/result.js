import { describeConfig, estimateLevel, loadConfig } from "./modes.js";

const raw = localStorage.getItem("gameResult");

if (!raw) {
  window.location.href = "../index.html";
}

const {
  score = 0,
  total = 0,
  attempted = total,
  avgTime = "0",
  byLevel = {},
} = JSON.parse(raw || "{}");

const config = loadConfig();

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
const incompleteEl = $("incomplete-note");

// ---------- Hisob-kitob ----------
// Javob berilmagan so'zlar xato hisoblanadi
const percent = total > 0 ? Math.round((score / total) * 100) : 0;
const wrong = Math.max(total - score, 0);
const level =
  total > 0 ? estimateLevel(config, { score, total, byLevel }) : null;

function getVerdict(pct) {
  if (pct >= 90) return { emoji: "🏆", title: "Ajoyib natija!" };
  if (pct >= 70) return { emoji: "🎉", title: "Juda yaxshi!" };
  if (pct >= 50) return { emoji: "👍", title: "Yaxshi harakat!" };
  if (pct >= 30) return { emoji: "💪", title: "Davom eting!" };
  return { emoji: "📚", title: "Mashq qilish kerak" };
}

const verdict = getVerdict(percent);

// ---------- Ko'rsatish ----------
emojiEl.textContent = verdict.emoji;
titleEl.textContent = verdict.title;
subtitleEl.textContent = `${total} ta so'zdan ${score} tasini topdingiz`;
wrongEl.textContent = wrong;
timeEl.textContent = `${avgTime}s`;
selectedEl.textContent = describeConfig(config);

// Test to'liq tugatilmagan bo'lsa ogohlantiramiz
if (incompleteEl && attempted < total) {
  incompleteEl.classList.remove("hidden");
}

if (level) {
  levelBadge.textContent = level.badge;
  levelName.textContent = `${level.badge} · ${level.name}`;
  levelDesc.textContent = level.desc;
} else {
  levelName.textContent = "Aniqlab bo'lmadi";
}

// Aylana rangi
const ringColor =
  percent >= 70
    ? "text-success"
    : percent >= 40
      ? "text-warning"
      : "text-error";
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

// ---------- Tugmalar ----------
// gameConfig localStorage da saqlanib turadi, shuning uchun o'sha rejim bilan qayta boshlanadi
$("restart-btn").addEventListener("click", () => {
  localStorage.removeItem("gameResult");
  window.location.href = "./game.html";
});

// Asosiy sahifaga (sozlamalar shu yerda)
$("new-game-btn").addEventListener("click", () => {
  localStorage.removeItem("gameResult");
  window.location.href = "../index.html";
});
