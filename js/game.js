import { generateGameWords } from "./functions.js";

const boxesEl = document.getElementById("word-boxes");
const inputEl = document.getElementById("word-input");
const meaningEl = document.getElementById("word-meaning");
const timerEl = document.getElementById("timer");
const timerBar = document.getElementById("timer-bar");
const messageEl = document.getElementById("message");
const progressBadge = document.getElementById("progress-badge");
const scoreBadge = document.getElementById("score-badge");

const TIME_LIMIT = 15;
const SUCCESS_DELAY = 1000; // to'g'ri topilgach kutish vaqti
const ERROR_DELAY = 700; // xatodan keyin tozalash vaqti
const TIMEOUT_DELAY = 3000; // vaqt tugaganda javobni ko'rsatish vaqti

let gameWords = [];
let currentIndex = 0;
let score = 0;
let totalTimeSpent = 0;
let timer = null;
let timeLeft = TIME_LIMIT;
let currentWordObj = null;
let locked = false;

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

// Inputni tozalash va kursorni boshiga qo'yish
function clearInput() {
  inputEl.value = "";
  inputEl.setSelectionRange(0, 0);
}

async function initGame() {
  const savedLevels = localStorage.getItem("selectedLevels");
  const selectedLvl = savedLevels ? JSON.parse(savedLevels) : ["all"];

  try {
    const response = await fetch("../words.json");
    const wordsData = await response.json();

    gameWords = generateGameWords(wordsData, selectedLvl);

    if (gameWords.length === 0) {
      alert("Tanlangan darajalar bo'yicha so'zlar topilmadi!");
      window.location.href = "../index.html";
      return;
    }

    loadNextWord();
  } catch (error) {
    console.error("Xatolik yuz berdi:", error);
  }
}

function loadNextWord() {
  if (currentIndex >= gameWords.length) {
    finishGame();
    return;
  }

  currentWordObj = gameWords[currentIndex];
  const enWord = currentWordObj.en;
  const uzTranslations = currentWordObj.uz;
  const randomUz =
    uzTranslations[Math.floor(Math.random() * uzTranslations.length)];

  meaningEl.textContent = randomUz;
  progressBadge.textContent = `So'z ${currentIndex + 1}/${gameWords.length}`;
  scoreBadge.textContent = `✓ ${score}`;
  setMessage("", null);

  // Eski katakchalarni tozalaymiz
  getSpans().forEach((s) => s.remove());

  // Yangi katakchalar (input har doim oxirida qoladi)
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
  totalTimeSpent += TIME_LIMIT;

  // To'g'ri javobni xato rangida ko'rsatamiz
  const answer = currentWordObj.en.toLowerCase();
  setState("error");
  updateBoxes(answer);
  setMessage("Vaqt tugadi!", "error");
  shake();

  setTimeout(() => {
    currentIndex++;
    loadNextWord();
  }, TIMEOUT_DELAY);
}

// Input fokusda bo'lmasa, qayta fokus qilamiz (har bosishda emas)
document.addEventListener("click", () => {
  if (document.activeElement !== inputEl) inputEl.focus();
});

inputEl.addEventListener("input", (e) => {
  if (locked) {
    clearInput();
    return;
  }

  const wordLen = currentWordObj.en.length;

  // Bo'sh joylarni olib tashlaymiz va uzunlikni o'zimiz cheklaymiz
  // (telefonda maxLength ba'zan ishonchsiz ishlaydi)
  let val = e.target.value.toLowerCase().replace(/\s/g, "").slice(0, wordLen);

  // Qiymatni tozalab qaytaramiz va kursorni doim oxiriga qo'yamiz.
  // Telefonda harflar teskari tushmasligi uchun shu muhim.
  if (e.target.value !== val) e.target.value = val;
  e.target.setSelectionRange(val.length, val.length);

  updateBoxes(val);

  if (val.length !== wordLen) return;

  locked = true;

  if (val === currentWordObj.en.toLowerCase()) {
    // TO'G'RI: taymer to'xtaydi, biroz kutib keyingi so'zga o'tadi
    clearInterval(timer);
    score++;
    totalTimeSpent += TIME_LIMIT - timeLeft;

    setState("success");
    updateBoxes(val);
    scoreBadge.textContent = `✓ ${score}`;
    setMessage("To'g'ri! 🎉", "success");

    setTimeout(() => {
      currentIndex++;
      loadNextWord();
    }, SUCCESS_DELAY);
  } else {
    // XATO: taymer davom etadi, katakchalar tozalanadi
    setState("error");
    updateBoxes(val);
    setMessage("Xato, qayta urinib ko'ring", "error");
    shake();

    setTimeout(() => {
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
  const avgTime = (totalTimeSpent / gameWords.length).toFixed(1);

  const resultData = {
    score: score,
    total: gameWords.length,
    avgTime: avgTime,
  };

  localStorage.setItem("gameResult", JSON.stringify(resultData));
  window.location.href = "./result.html";
}

initGame();
