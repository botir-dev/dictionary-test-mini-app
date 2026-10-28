import {
  LEVELS,
  PRESETS,
  buildCustomDist,
  customGroup,
  loadConfig,
} from "./modes.js";

const presetItems = document.querySelectorAll(".preset-item");
const levelItems = document.querySelectorAll(".level-item");
const startBtn = document.getElementById("start-button");
const titleEl = document.getElementById("plan-title");
const guessEl = document.getElementById("plan-guess");
const distEl = document.getElementById("plan-dist");

const P_ON = ["border-warning", "bg-warning/10", "shadow-md"];
const P_OFF = ["border-base-300"];
const L_ON = ["btn-warning", "shadow-md", "scale-105"];
const L_OFF = ["btn-outline", "btn-neutral"];

let config = loadConfig();

const fmt = (dist) =>
  Object.entries(dist)
    .map(([l, n]) => `${l.toUpperCase()} ${n}`)
    .join(" · ");

function render() {
  presetItems.forEach((el) => {
    const on = config.type === "preset" && config.id === el.dataset.preset;
    el.classList.remove(...P_ON, ...P_OFF);
    el.classList.add(...(on ? P_ON : P_OFF));
    el.setAttribute("aria-pressed", String(on));
  });

  levelItems.forEach((el) => {
    const on =
      config.type === "custom" && config.levels.includes(el.dataset.level);
    el.classList.remove(...L_ON, ...L_OFF);
    el.classList.add(...(on ? L_ON : L_OFF));
    el.setAttribute("aria-pressed", String(on));
  });

  if (config.type === "preset") {
    const p = PRESETS[config.id];
    titleEl.textContent = `${p.name} · ${p.total} ta so'z`;
    guessEl.textContent = "";
    distEl.textContent = fmt(p.dist);
  } else {
    const dist = buildCustomDist(config.levels);
    titleEl.textContent = "Maxsus test · 30 ta so'z";
    guessEl.textContent = `Taxminiy daraja: ${customGroup(config.levels)}`;
    distEl.textContent = fmt(dist);
  }
}

presetItems.forEach((el) =>
  el.addEventListener("click", () => {
    config = { type: "preset", id: el.dataset.preset };
    render();
  }),
);

levelItems.forEach((el) =>
  el.addEventListener("click", () => {
    const lvl = el.dataset.level;
    let levels = config.type === "custom" ? [...config.levels] : [];

    levels = levels.includes(lvl)
      ? levels.filter((l) => l !== lvl)
      : [...levels, lvl];
    levels.sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b));

    // Hech narsa qolmasa, To'liq testga qaytamiz
    config = levels.length
      ? { type: "custom", levels }
      : { type: "preset", id: "full" };
    render();
  }),
);

startBtn.addEventListener("click", () => {
  localStorage.setItem("gameConfig", JSON.stringify(config));
  localStorage.removeItem("gameResult");
  window.location.href = "./pages/game.html";
});

render();
