import { setSelectedLvl } from "./functions.js";
import { levelItems, startButtonEl } from "./html-elements.js";

const infoEl = document.getElementById("selected-info");
const SPECIFIC = ["a1", "a2", "b1", "b2", "c1", "c2"];
const ON = ["btn-warning", "shadow-md", "scale-105"];
const OFF = ["btn-outline", "btn-neutral"];

// Holat shu fayl ichida saqlanadi
let levels = ["all"];
try {
  const saved = JSON.parse(localStorage.getItem("selectedLevels"));
  if (Array.isArray(saved) && saved.length) levels = saved;
} catch {}

function sync() {
  setSelectedLvl(levels); // functions.js bilan moslik uchun
  localStorage.setItem("selectedLevels", JSON.stringify(levels));
}

function renderLevels() {
  levelItems.forEach((item) => {
    const active = levels.includes(item.dataset.level);
    item.classList.remove(...ON, ...OFF);
    item.classList.add(...(active ? ON : OFF));
    item.setAttribute("aria-pressed", String(active));
  });

  if (infoEl) {
    infoEl.textContent = levels.includes("all")
      ? "Aralash"
      : levels.map((l) => l.toUpperCase()).join(", ");
  }
}

levelItems.forEach((item) => {
  item.addEventListener("click", () => {
    const lvl = item.dataset.level;

    if (lvl === "all") {
      levels = ["all"];
    } else {
      let next = levels.filter((l) => l !== "all");
      next = next.includes(lvl)
        ? next.filter((l) => l !== lvl)
        : [...next, lvl];

      const allSelected = SPECIFIC.every((l) => next.includes(l));
      levels = allSelected || next.length === 0 ? ["all"] : next;
    }

    sync();
    renderLevels();
  });
});

if (startButtonEl) {
  startButtonEl.addEventListener("click", () => {
    sync();
    localStorage.removeItem("gameResult");
    window.location.href = "./pages/game.html";
  });
}

sync();
renderLevels();
