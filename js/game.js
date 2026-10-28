import { buildGameWords, loadConfig } from "./modes.js";

const boxesEl = document.getElementById("word-boxes");
const inputEl = document.getElementById("word-input");
const meaningEl = document.getElementById("word-meaning");
const timerEl = document.getElementById("timer");
const timerBar = document.getElementById("timer-bar");
const messageEl = document.getElementById("message");
const progressBadge = document.getElementById("progress-badge");
const scoreBadge = document.getElementById("score-badge");
const skipBtn = document.getElementById("skip-btn");
const finishBtn = document.getElementById("finish-btn");

const TIME_LIMIT = 15;
const SUCCESS_DELAY = 1000;
const ERROR_DELAY = 700;
const TIMEOUT_DELAY = 3000;

const config = loadConfig();

let gameWords = [];
let currentIndex = 0;
let score = 0;
let attempted = 0;
let totalTimeSpent = 0;
let timer = null;
let pendingTimeout = null;
let timeLeft = TIME_LIMIT;
let currentWordObj = null;
let locked = false;
let finished = false;
let byLevel = {}; // { a1: { asked, correct } }

const BASE_CLASS =
  "w-9 h-12 sm:w-12 sm:h-14 shrink-0 border-2 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-bold uppercase bg-base-100 transition-all duration-200";

const STATE_CLASSES = {
  warning: ["border-warning"],
  success: ["border-success", "bg-success/10", "text-success"],
  error: ["border-error", "bg-error/10", "text-error"],
};
const ALL_STATE_CLASSES = [
  "border-warning",
  "border-success",
  "border-error",
  "bg-success/10",
  "bg-error/10",
  "text-success",
  "text-error",
];
const ACTIVE_CLASSES = ["ring-2", "ring-warning/50", "-translate-y-1"];

let boxState = "warning";

function getSpans() {
  return boxesEl.querySelectorAll("span");
}

function setState(state) {
  boxState = state;
  getSpans().forEach((span) => {
    span.classList.remove(...ALL_STATE_CLASSES, ...ACTIVE_CLASSES);
    span.classList.add(...STATE_CLASSES[state]);
  });
}

function updateBoxes(val) {
  getSpans().forEach((span, index) => {
    span.textContent = val[index] || "";
    span.classList.remove(...ACTIVE_CLASSES);
    if (boxState === "warning" && index === val.length) {
      span.classList.add(...ACTIVE_CLASSES);
    }
  });
}

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "h-5 text-sm font-semibold";
  if (type === "success") messageEl.classList.add("text-success");
  if (type === "error") messageEl.classList.add("text-error");
}

function shake() {
  boxesEl.classList.remove("shake");
  void boxesEl.offsetWidth;
  boxesEl.classList.add("shake");
}

function renderTimer() {
  timerEl.textContent = `${timeLeft}s`;
  timerBar.value = timeLeft;
  if (timeLeft <= 5) {
    timerBar.classList.remove("progress-warning");
    timerBar.classList.add("progress-error");
  } else {
    timerBar.classList.remove("progress-error");
    timerBar.classList.add("progress-warning");
  }
}

function clearInput() {
  inputEl.value = "";
  inputEl.setSelectionRange(0, 0);
}

function later(fn, ms) {
  clearTimeout(pendingTimeout);
  pendingTimeout = setTimeout(fn, ms);
}

async function initGame() {
  try {
    const response = await fetch("../words.json");
    const wordsData = await response.json();

    gameWords = buildGameWords(wordsData, config);

    if (gameWords.length === 0) {
      alert("Tanlangan darajalar bo'yicha so'zlar topilmadi!");
      window.location.href = "../index.html";
      return;
    }

    // Har bir daraja bo'yicha nechta so'z berilganini hisoblaymiz
    gameWords.forEach((w) => {
      byLevel[w.lvl] ??= { asked: 0, correct: 0 };
      byLevel[w.lvl].asked++;
    });

    loadNextWord();
  } catch (error) {
    console.error("Xatolik yuz berdi:", error);
  }
}

function loadNextWord() {
  if (finished) return;

  if (currentIndex >= gameWords.length) {
    finishGame();
    return;
  }

  currentWordObj = gameWords[currentIndex];
  const enWord = currentWordObj.en;

  // Barcha tarjimalar vergul bilan
  meaningEl.textContent = currentWordObj.uz.join(", ");
  progressBadge.textContent = `So'z ${currentIndex + 1}/${gameWords.length}`;
  scoreBadge.textContent = `✓ ${score}`;
  setMessage("", null);

  getSpans().forEach((s) => s.remove());

  for (let i = 0; i < enWord.length; i++) {
    const span = document.createElement("span");
    span.className = BASE_CLASS;
    boxesEl.insertBefore(span, inputEl);
  }

  setState("warning");
  updateBoxes("");

  clearInput();
  locked = false;
  inputEl.focus();

  startTimer();
}

function startTimer() {
  clearInterval(timer);
  timeLeft = TIME_LIMIT;
  renderTimer();

  timer = setInterval(() => {
    timeLeft--;
    renderTimer();

    if (timeLeft <= 0) {
      clearInterval(timer);
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  locked = true;
  attempted++;
  totalTimeSpent += TIME_LIMIT;

  setState("error");
  updateBoxes(currentWordObj.en.toLowerCase());
  setMessage("Vaqt tugadi!", "error");
  shake();

  later(() => {
    currentIndex++;
    loadNextWord();
  }, TIMEOUT_DELAY);
}

function skipWord() {
  if (locked || finished || !currentWordObj) return;

  locked = true;
  clearInterval(timer);
  attempted++;
  totalTimeSpent += TIME_LIMIT - timeLeft;

  setState("error");
  updateBoxes(currentWordObj.en.toLowerCase());
  setMessage("O'tkazib yuborildi", "error");

  later(() => {
    currentIndex++;
    loadNextWord();
  }, 1200);
}

[skipBtn, finishBtn].forEach((btn) =>
  btn.addEventListener("mousedown", (e) => e.preventDefault()),
);

skipBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  skipWord();
});

finishBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  finishGame();
});

document.addEventListener("click", () => {
  if (document.activeElement !== inputEl) inputEl.focus();
});

inputEl.addEventListener("input", (e) => {
  if (locked) {
    clearInput();
    return;
  }

  const wordLen = currentWordObj.en.length;
  let val = e.target.value.toLowerCase().replace(/\s/g, "").slice(0, wordLen);

  if (e.target.value !== val) e.target.value = val;
  e.target.setSelectionRange(val.length, val.length);

  updateBoxes(val);

  if (val.length !== wordLen) return;

  locked = true;

  if (val === currentWordObj.en.toLowerCase()) {
    clearInterval(timer);
    score++;
    attempted++;
    byLevel[currentWordObj.lvl].correct++;
    totalTimeSpent += TIME_LIMIT - timeLeft;

    setState("success");
    updateBoxes(val);
    scoreBadge.textContent = `✓ ${score}`;
    setMessage("To'g'ri! 🎉", "success");

    later(() => {
      currentIndex++;
      loadNextWord();
    }, SUCCESS_DELAY);
  } else {
    setState("error");
    updateBoxes(val);
    setMessage("Xato, qayta urinib ko'ring", "error");
    shake();

    later(() => {
      clearInput();
      setState("warning");
      updateBoxes("");
      setMessage("", null);
      locked = false;
      inputEl.focus();
    }, ERROR_DELAY);
  }
});

function finishGame() {
  if (finished) return;
  finished = true;

  clearInterval(timer);
  clearTimeout(pendingTimeout);

  const avgTime = attempted > 0 ? (totalTimeSpent / attempted).toFixed(1) : "0.0";

  localStorage.setItem(
    "gameResult",
    JSON.stringify({
      score,
      total: gameWords.length, // rejimdagi to'liq so'zlar soni
      attempted, // haqiqatda yakunlangani
      avgTime,
      byLevel,
    }),
  );
  window.location.href = "./result.html";
}

initGame();