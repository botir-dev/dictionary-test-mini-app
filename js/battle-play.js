import { api, connectSocket, notify, esc } from "./battle-api.js";

const $ = (id) => document.getElementById(id);
const roomId = new URLSearchParams(location.search).get("room");
if (!roomId) location.href = "../battle-game.html";

const boxesEl = $("boxes");
const inputEl = $("word-input");

const BASE =
  "w-9 h-12 sm:w-12 sm:h-14 shrink-0 border-2 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-bold uppercase bg-base-100 transition-all duration-200";
const STATES = {
  warning: ["border-warning"],
  success: ["border-success", "bg-success/10", "text-success"],
  error: ["border-error", "bg-error/10", "text-error"],
};
const ALL = ["border-warning", "border-success", "border-error", "bg-success/10", "bg-error/10", "text-success", "text-error"];
const ACTIVE = ["ring-2", "ring-warning/50", "-translate-y-1"];

let myId = null;
let current = null; // {index, length}
let locked = true;
let boxState = "warning";
let deadline = 0;
let tick = null;
let cdTimer = null;
let ended = false;

const spans = () => boxesEl.querySelectorAll("span");

function setState(s) {
  boxState = s;
  spans().forEach((sp) => {
    sp.classList.remove(...ALL, ...ACTIVE);
    sp.classList.add(...STATES[s]);
  });
}

function paint(val) {
  spans().forEach((sp, i) => {
    sp.textContent = val[i] || "";
    sp.classList.remove(...ACTIVE);
    if (boxState === "warning" && i === val.length) sp.classList.add(...ACTIVE);
  });
}

function setMessage(text, type) {
  const el = $("message");
  el.textContent = text;
  el.className = "h-5 text-sm font-semibold " + (type ? `text-${type}` : "");
}

function clearInput() {
  inputEl.value = "";
  inputEl.setSelectionRange(0, 0);
}

function shake() {
  boxesEl.classList.remove("shake");
  void boxesEl.offsetWidth;
  boxesEl.classList.add("shake");
}

function show(name) {
  ["countdown", "game", "waiting", "result"].forEach((s) => ($(s).hidden = s !== name));
}

// ---------- Jonli reyting ----------
function renderBoard(players) {
  const sorted = [...players].sort((a, b) => b.correct - a.correct || b.idx - a.idx);
  $("board").innerHTML = sorted
    .map(
      (p) => `
    <div class="flex items-center gap-2 text-sm ${p.tg_id === myId ? "font-bold" : ""}">
      <span class="w-24 truncate">${esc(p.name)}${p.tg_id === myId ? " (siz)" : ""}</span>
      <div class="bar flex-1"><i style="width:${Math.round(((p.finished ? 20 : p.idx) / 20) * 100)}%"></i></div>
      <span class="w-10 text-right">✓ ${p.correct}</span>
    </div>`,
    )
    .join("");
  const me = players.find((p) => p.tg_id === myId);
  if (me) $("score-badge").textContent = `✓ ${me.correct}`;
}

// ---------- So'zni ko'rsatish ----------
function showWord({ index, total, uz, length, remainingMs }) {
  current = { index, length };
  show("game");

  $("meaning").textContent = uz.join(", ");
  $("progress-badge").textContent = `So'z ${index + 1}/${total}`;
  setMessage("", null);

  spans().forEach((s) => s.remove());
  for (let i = 0; i < length; i++) {
    const sp = document.createElement("span");
    sp.className = BASE;
    boxesEl.insertBefore(sp, inputEl);
  }
  setState("warning");
  paint("");
  clearInput();
  locked = false;
  inputEl.focus();

  deadline = performance.now() + remainingMs;
  clearInterval(tick);
  const render = () => {
    const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    $("timer").textContent = `${left}s`;
    $("timer-bar").value = left;
    $("timer-bar").classList.toggle("progress-error", left <= 5);
    $("timer-bar").classList.toggle("progress-warning", left > 5);
  };
  render();
  tick = setInterval(render, 250);
}

// ---------- Natija ----------
function showResult(res) {
  if (ended) return;
  ended = true;
  clearInterval(tick);
  show("result");

  const mine = res.ranking.find((r) => r.tg_id === myId);
  const won = mine?.place === 1;
  $("r-emoji").textContent = won ? "🏆" : mine?.place === 2 ? "🥈" : "🏁";
  $("r-title").textContent = won ? "Siz g'olibsiz!" : `${mine?.place ?? "-"}-o'rin`;
  $("r-coins").textContent = won ? `+${res.pot - res.fee} 🪙` : `-${res.fee} 🪙`;
  $("r-coins").className = "font-bold mt-1 " + (won ? "text-success" : "text-error");

  const medal = ["🥇", "🥈", "🥉"];
  $("r-list").innerHTML = res.ranking
    .map(
      (r) => `
    <div class="flex items-center gap-3 rounded-xl px-3 py-2 ${r.tg_id === myId ? "bg-warning/15" : "bg-base-200/60"}">
      <span class="w-7 text-lg">${medal[r.place - 1] || r.place}</span>
      <span class="flex-1 truncate font-semibold">${esc(r.name)}</span>
      <span class="text-sm">✓ ${r.correct}/20 · ${(r.timeMs / 1000).toFixed(1)}s</span>
    </div>`,
    )
    .join("");
}

// ---------- Kiritish ----------
document.addEventListener("click", () => {
  if (!$("game").hidden && document.activeElement !== inputEl) inputEl.focus();
});

inputEl.addEventListener("input", (e) => {
  if (locked || !current) return clearInput();

  const val = e.target.value.toLowerCase().replace(/\s/g, "").slice(0, current.length);
  if (e.target.value !== val) e.target.value = val;
  e.target.setSelectionRange(val.length, val.length);
  paint(val);

  if (val.length !== current.length) return;
  locked = true;

  socket.emit("answer", { roomId, index: current.index, value: val }, (res) => {
    if (res?.ok && !res.correct) {
      setState("error");
      paint(val);
      setMessage("Xato, qayta urinib ko'ring", "error");
      shake();
      setTimeout(() => {
        clearInput();
        setState("warning");
        paint("");
        setMessage("", null);
        locked = false;
        inputEl.focus();
      }, 700);
    }
    // To'g'ri bo'lsa, "word:result" hodisasi holatni o'zgartiradi
  });
});

$("skip-btn").addEventListener("mousedown", (e) => e.preventDefault());
$("skip-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (current && !locked) socket.emit("skip", { roomId, index: current.index });
});

// ---------- Socket ----------
const socket = connectSocket();

socket.on("connect", () => {
  socket.emit("game:ready", { roomId }, (res) => {
    if (res?.error) {
      notify(res.error);
      return (location.href = "../battle-game.html");
    }
    renderBoard(res.players);
    if (res.result) return showResult(res.result);
    if (res.finished) return show("waiting");

    if (res.startsInMs > 0) {
      show("countdown");
      const end = performance.now() + res.startsInMs;
      clearInterval(cdTimer);
      cdTimer = setInterval(() => {
        const s = Math.ceil((end - performance.now()) / 1000);
        $("cd-num").textContent = Math.max(s, 0);
        if (s <= 0) clearInterval(cdTimer);
      }, 200);
    }
  });
});

socket.on("word:show", (w) => {
  clearInterval(cdTimer);
  showWord(w);
});

socket.on("word:result", ({ kind, answer }) => {
  locked = true;
  clearInterval(tick);
  const word = answer ? answer.toLowerCase().replace(/[\s'’-]/g, "") : null;
  if (kind === "correct") {
    setState("success");
    setMessage("To'g'ri! 🎉", "success");
  } else {
    setState("error");
    if (word) paint(word);
    setMessage(kind === "timeout" ? `Vaqt tugadi! (${answer})` : `O'tkazildi (${answer})`, "error");
    shake();
  }
});

socket.on("game:progress", renderBoard);
socket.on("game:done", () => show("waiting"));
socket.on("game:result", showResult);

(async () => {
  try {
    myId = (await api("/api/me")).me.tg_id;
  } catch (e) {
    notify(e.message);
  }
})();