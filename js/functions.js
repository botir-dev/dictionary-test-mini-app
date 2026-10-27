import { levelItems } from "./html-elements.js";

// O'zgaruvchini shu yerda e'lon qilamiz
export let selectedLvl = ["all"];

const savedLevels = localStorage.getItem("selectedLevels");

// Agar ma'lumot bo'lsa uni qaytadan massivga o'tkazamiz, bo'lmasa default holatda ["all"] qilamiz
const tempLvl = savedLevels ? JSON.parse(savedLevels) : ["all"];

// O'zgaruvchining qiymatini tashqaridan turib xavfsiz o'zgartirish uchun funksiya
export function setSelectedLvl(newLevels) {
  selectedLvl = newLevels;
}

export function updateUI() {
  levelItems.forEach((item) => {
    const levelValue = item.getAttribute("data-level");

    if (selectedLvl.includes(levelValue)) {
      item.classList.add("bg-[#070C9C]", "text-white");
      item.classList.remove("bg-white", "text-black");
    } else {
      // Tanlanmagan bo'lsa: fon oq, matn qora
      item.classList.remove("bg-[#070C9C]", "text-white");
      item.classList.add("bg-white", "text-black");
    }
  });
}

export function randomWords(selectedlvl) {
  console.log(selectedlvl);
}

// gamee

// Tasodifiy elementlarni tanlash uchun yordamchi funksiya (Fisher-Yates / Shuffle)
function shuffleArray(array) {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Asosiy so'zlarni tanlab beruvchi funksiya
export function generateGameWords(wordsData, selectedLevels) {
  let resultWords = [];
  const targetTotal = 24;

  // 1. Agar "all" (Aralash) tanlangan bo'lsa yoki barcha 6 ta daraja tanlangan bo'lsa
  const allLevels = ["a1", "a2", "b1", "b2", "c1", "c2"];
  const isAll =
    selectedLevels.includes("all") ||
    allLevels.every((lvl) => selectedLevels.includes(lvl));

  let levelsToProcess = isAll ? allLevels : selectedLevels;

  // Har bir darajadan nechta so'z olinishini hisoblaymiz
  let countPerLevel = Math.floor(targetTotal / levelsToProcess.length);
  let remainder = targetTotal % levelsToProcess.length; // Qoldiqni hisoblaymiz

  levelsToProcess.forEach((level, index) => {
    // wordsData[0] orqali o'sha level massivini olamiz (masalan: wordsData[0]["a1"])
    let levelWords = wordsData[0][level] || [];
    let shuffled = shuffleArray(levelWords);

    // Agar qoldiq bo'lsa, uni random bitta darajaga bittadan qo'shib yuboramiz (yoki tarqatamiz)
    let takeCount = countPerLevel;
    if (index < remainder) {
      takeCount += 1; // Qoldiqdan bitta qo'shiladi, natijada aniq 24 ta chiqadi
    }

    // Kerakli miqdordagi so'zlarni olib natijaga qo'shamiz
    let selected = shuffled.slice(0, takeCount);
    resultWords.push(...selected);
  });

  // Natijani ham aralashtirib yuboramiz (har xil darajadagi so'zlar qorishib kelishi uchun)
  return shuffleArray(resultWords);
}
