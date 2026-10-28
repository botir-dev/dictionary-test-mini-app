export const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
export const MIN_CUSTOM_WORDS = 30;
const PASS_RATIO = 0.6; // maxsus rejimda darajani "bildi" deyish chegarasi

// ---------- Tayyor rejimlar ----------
export const PRESETS = {
  full: {
    id: "full",
    name: "To'liq test",
    total: 40,
    range: "A2–C2",
    dist: { a2: 11, b1: 12, b2: 9, c1: 5, c2: 3 },
    bands: [
      { min: 0, key: "A1" },
      { min: 10, key: "A2" },
      { min: 23, key: "B1" },
      { min: 31, key: "B2" },
      { min: 36, key: "C1" },
      { min: 39, key: "C2" },
    ],
  },
  basic: {
    id: "basic",
    name: "Asosiy test",
    total: 30,
    range: "A1–B2",
    dist: { a1: 5, a2: 9, b1: 10, b2: 6 },
    bands: [
      { min: 0, key: "A1" },
      { min: 7, key: "A2" },
      { min: 16, key: "B1" },
      { min: 24, key: "B2" },
    ],
  },
  advanced: {
    id: "advanced",
    name: "Ilg'or test",
    total: 20,
    range: "B2–C2",
    dist: { a2: 1, b1: 1, b2: 5, c1: 7, c2: 6 },
    bands: [
      { min: 0, key: "<B2" },
      { min: 7, key: "B2" },
      { min: 12, key: "C1" },
      { min: 17, key: "C2" },
    ],
  },
};

export const LEVEL_INFO = {
  A1: { name: "Boshlang'ich", desc: "Eng oddiy kundalik so'zlarni bilasiz." },
  A2: { name: "Elementar", desc: "Tanish mavzulardagi so'zlarni yaxshi bilasiz." },
  B1: { name: "O'rta", desc: "Kundalik muloqot uchun yetarli lug'at bor." },
  B2: { name: "O'rta-yuqori", desc: "Murakkab matnlarni tushunadigan darajadasiz." },
  C1: { name: "Ilg'or", desc: "Lug'at boyligingiz juda yaxshi, erkin fikrlay olasiz." },
  C2: { name: "Mukammal", desc: "Ona tili darajasiga yaqin lug'atga egasiz!" },
  "<B2": { name: "B2 dan past", desc: "Bu test B2 dan yuqori so'zlar uchun, B2 darajasiga hali yetmagansiz." },
};

// ---------- Maxsus rejim: taqsimot ----------
// Tanlangan darajalarning o'rtachasi "markaz" bo'ladi.
// Markazga yaqin darajalarga ko'proq so'z beriladi.
export function buildCustomDist(levels, total = MIN_CUSTOM_WORDS) {
  const idxs = levels
    .map((l) => LEVELS.indexOf(l))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  if (!idxs.length) return {};

  const center = idxs.reduce((a, b) => a + b, 0) / idxs.length;
  const weights = idxs.map((i) => 1 / (1 + Math.abs(i - center)));
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const counts = raw.map(Math.floor);

  // Qoldiqni eng katta kasr qismlarga beramiz
  let left = total - counts.reduce((a, b) => a + b, 0);
  raw
    .map((r, k) => ({ k, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ k }) => {
      if (left > 0) {
        counts[k]++;
        left--;
      }
    });

  // Har bir tanlangan darajadan kamida 1 ta so'z bo'lsin
  counts.forEach((c, k) => {
    if (c === 0) {
      const max = counts.indexOf(Math.max(...counts));
      counts[max]--;
      counts[k]++;
    }
  });

  const dist = {};
  idxs.forEach((i, k) => (dist[LEVELS[i]] = counts[k]));
  return dist;
}

// Tanlovga qarab oldindan taxminiy guruh (A / B / C)
export function customGroup(levels) {
  const idxs = levels.map((l) => LEVELS.indexOf(l)).filter((i) => i >= 0);
  if (!idxs.length) return "";
  const center = idxs.reduce((a, b) => a + b, 0) / idxs.length;
  if (center < 1.5) return "Boshlang'ich (A)";
  if (center < 3.5) return "O'rta (B)";
  return "Ilg'or (C)";
}

// ---------- Konfiguratsiya ----------
export function getDist(config) {
  return config.type === "preset"
    ? PRESETS[config.id].dist
    : buildCustomDist(config.levels);
}

export function describeConfig(config) {
  if (config.type === "preset") {
    const p = PRESETS[config.id];
    return `${p.name} (${p.range})`;
  }
  return `Maxsus: ${config.levels.map((l) => l.toUpperCase()).join(", ")}`;
}

export function loadConfig() {
  try {
    const c = JSON.parse(localStorage.getItem("gameConfig"));
    if (c?.type === "preset" && PRESETS[c.id]) return c;
    if (c?.type === "custom" && Array.isArray(c.levels) && c.levels.length)
      return { type: "custom", levels: c.levels.filter((l) => LEVELS.includes(l)) };
  } catch {}
  return { type: "preset", id: "full" };
}

// ---------- So'zlarni tanlash ----------
function getLevel(w) {
  return String(w.level ?? w.lvl ?? w.cefr ?? w.daraja ?? "").toLowerCase();
}

function flatten(data) {
  // Massiv ichidagi obyektni ochamiz: [ { a1: [...], a2: [...] } ]
  if (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((item) => item && !Array.isArray(item) && typeof item === "object" && !("en" in item))
  ) {
    data = Object.assign({}, ...data);
  }

  // { a1: [...], a2: [...] } ko'rinishi
  if (!Array.isArray(data)) {
    return Object.entries(data).flatMap(([lvl, arr]) =>
      Array.isArray(arr)
        ? arr.map((w) => ({ ...w, _lvl: lvl.toLowerCase() }))
        : [],
    );
  }

  // Tekis massiv: har bir so'zda level maydoni bor
  return data.map((w) => ({ ...w, _lvl: getLevel(w) }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Oson -> qiyin tartibida, takrorlanmaydigan so'zlar
export function buildGameWords(data, config) {
  const all = flatten(data);
  const dist = getDist(config);
  const pools = {};
  LEVELS.forEach((l) => (pools[l] = shuffle(all.filter((w) => w._lvl === l))));

  const picked = [];
  let shortage = 0;
  Object.entries(dist).forEach(([lvl, n]) => {
    const take = pools[lvl].splice(0, n);
    picked.push(...take);
    shortage += n - take.length;
  });

  // Biror darajada so'z yetmasa, boshqa tanlangan darajalardan to'ldiramiz
  if (shortage > 0) {
    for (const lvl of Object.keys(dist)) {
      if (shortage <= 0) break;
      const extra = pools[lvl].splice(0, shortage);
      picked.push(...extra);
      shortage -= extra.length;
    }
  }

  return picked
    .map((w) => ({ ...w, lvl: w._lvl }))
    .sort((a, b) => LEVELS.indexOf(a.lvl) - LEVELS.indexOf(b.lvl));
}

// ---------- Natijadan daraja aniqlash ----------
// stats: { score, total, byLevel: { a1: {asked, correct}, ... } }
export function estimateLevel(config, stats) {
  let key;

  if (config.type === "preset") {
    const bands = PRESETS[config.id].bands;
    key = bands.filter((b) => stats.score >= b.min).pop().key;
  } else {
    // Eng yuqori daraja: o'sha daraja so'zlarining kamida 60% i topilgan bo'lsa
    const asked = LEVELS.filter((l) => stats.byLevel?.[l]?.asked > 0);
    const passed = asked.filter((l) => {
      const s = stats.byLevel[l];
      return s.correct / s.asked >= PASS_RATIO;
    });

    if (passed.length) {
      key = passed[passed.length - 1].toUpperCase();
    } else {
      const low = LEVELS.indexOf(asked[0]);
      key = low <= 0 ? "A1" : `<${asked[0].toUpperCase()}`;
    }
  }

  if (LEVEL_INFO[key]) return { badge: key, ...LEVEL_INFO[key] };

  // Masalan "<C1" kabi dinamik holat
  const base = key.slice(1);
  const below = LEVELS[Math.max(LEVELS.indexOf(base.toLowerCase()) - 1, 0)].toUpperCase();
  return {
    badge: key,
    name: `${below} yoki past`,
    desc: `${base} darajadagi so'zlarning kamida 60% ini topa olmadingiz.`,
  };
}