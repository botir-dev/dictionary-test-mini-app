import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import fs from "fs";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  BOT_TOKEN,
  CLIENT_ORIGIN,
  DEV_AUTH,
} = process.env;
const PORT = process.env.PORT || 3000;
const ORIGINS = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim());

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
const MODES = {
  battle6: { capacity: 6, fee: 5 },
  duel: { capacity: 2, fee: 40 },
};
const WORDS_PER_GAME = 20;
const TIME_LIMIT = 15000;
const START_DELAY = 8000;

// ---------- So'zlar ----------
const raw = JSON.parse(
  fs.readFileSync(new URL("./words.json", import.meta.url), "utf8"),
);
const wordsData = Array.isArray(raw) ? Object.assign({}, ...raw) : raw;
const POOLS = {};
LEVELS.forEach((l) => {
  POOLS[l] = (wordsData[l] || []).filter(
    (w) => w.en && Array.isArray(w.uz) && w.uz.length,
  );
});

// Bo'shliq, tire va apostrof olib tashlanadi ("ice cream" -> "icecream")
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[\s'’-]/g, "");

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWords(levels, n) {
  const ls = shuffle(levels);
  const counts = ls.map(() => Math.floor(n / ls.length));
  const rem = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rem; i++) counts[i]++;

  const picked = [];
  let short = 0;
  ls.forEach((l, i) => {
    const take = shuffle(POOLS[l]).slice(0, counts[i]);
    picked.push(...take.map((w) => ({ en: w.en, uz: w.uz })));
    short += counts[i] - take.length;
  });

  // Biror darajada so'z yetmasa, tanlangan darajalardan to'ldiramiz
  if (short > 0) {
    const used = new Set(picked.map((w) => w.en));
    const rest = shuffle(
      ls.flatMap((l) => POOLS[l]).filter((w) => !used.has(w.en)),
    );
    picked.push(...rest.slice(0, short).map((w) => ({ en: w.en, uz: w.uz })));
  }
  return shuffle(picked);
}

// ---------- Telegram autentifikatsiya ----------
function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || hash.length !== 64) return null;
  params.delete("hash");

  const check = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const calc = crypto.createHmac("sha256", secret).update(check).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash)))
    return null;
  if (Date.now() / 1000 - Number(params.get("auth_date")) > 86400) return null;

  try {
    return JSON.parse(params.get("user"));
  } catch {
    return null;
  }
}

function getUser(initData) {
  if (!initData) return null;
  // Faqat test uchun! Productionda DEV_AUTH ni QO'YMANG.
  if (DEV_AUTH === "1" && initData.startsWith("dev:")) {
    try {
      return JSON.parse(initData.slice(4));
    } catch {
      return null;
    }
  }
  return verifyInitData(initData);
}

const seen = new Map();
async function ensurePlayer(u) {
  const last = seen.get(u.id);
  if (last && Date.now() - last < 5 * 60e3) return;
  const { error } = await sb.from("players").upsert(
    {
      tg_id: u.id,
      first_name: u.first_name || "Player",
      last_name: u.last_name || null,
      username: u.username || null,
      photo_url: u.photo_url || null,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "tg_id" }, // yangi o'yinchiga default 150 tanga beriladi
  );
  if (error) throw error;
  seen.set(u.id, Date.now());
}

// ---------- Express ----------
const app = express();

const server = http.createServer(app);

app.use(
  cors({ origin: ORIGINS, allowedHeaders: ["Content-Type", "x-init-data"] }),
);
app.use(express.json({ limit: "10kb" }));
const io = new Server(server, { cors: { origin: ORIGINS } });

app.get("/health", (_, res) => res.json({ ok: true }));

const auth = async (req, res, next) => {
  try {
    const u = getUser(req.get("x-init-data"));
    if (!u?.id)
      return res
        .status(401)
        .json({ error: "Avtorizatsiya xatosi. Telegram ichidan oching." });
    await ensurePlayer(u);
    req.user = u;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server xatosi" });
  }
};

const h = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(400).json({ error: e.message || "Xatolik" });
  });

const tashkentDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });

async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

async function roomWithPlayers(id) {
  const { data, error } = await sb
    .from("rooms")
    .select(
      "id,mode,levels,capacity,entry_fee,status,creator_id,created_at," +
        "room_players(tg_id,place,correct,total_time_ms,players(first_name,username,photo_url))",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function getActiveRoom(tgId) {
  const { data } = await sb
    .from("room_players")
    .select("room_id,rooms!inner(status)")
    .eq("tg_id", tgId)
    .in("rooms.status", ["lobby", "playing"])
    .limit(1);
  return data?.[0] ? roomWithPlayers(data[0].room_id) : null;
}

const lobbyChanged = () => io.to("lobby").emit("lobby:changed");

app.get(
  "/api/me",
  auth,
  h(async (req, res) => {
    const { data: me } = await sb
      .from("players")
      .select("*")
      .eq("tg_id", req.user.id)
      .single();
    const activeRoom = await getActiveRoom(req.user.id);
    res.json({
      me,
      activeRoom,
      canClaimCredit:
        me.coins === 0 && !activeRoom && me.last_credit_date !== tashkentDate(),
    });
  }),
);

app.post(
  "/api/credit",
  auth,
  h(async (req, res) => {
    const r = await rpc("claim_credit", { p_tg: req.user.id });
    if (!r.ok) throw new Error(r.error);
    res.json({ ok: true });
  }),
);

app.get(
  "/api/rooms",
  auth,
  h(async (req, res) => {
    const mode = req.query.mode;
    if (!MODES[mode]) throw new Error("Noto'g'ri rejim");
    const { data, error } = await sb
      .from("rooms")
      .select(
        "id,mode,levels,capacity,entry_fee,creator_id,created_at," +
          "room_players(tg_id,players(first_name,username,photo_url))",
      )
      .eq("status", "lobby")
      .eq("mode", mode)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ rooms: data });
  }),
);

app.get(
  "/api/rooms/:id",
  auth,
  h(async (req, res) => {
    res.json({ room: await roomWithPlayers(req.params.id) });
  }),
);

app.post(
  "/api/rooms",
  auth,
  h(async (req, res) => {
    const { mode, levels } = req.body || {};
    if (!MODES[mode]) throw new Error("Noto'g'ri rejim");
    if (
      !Array.isArray(levels) ||
      !levels.length ||
      !levels.every((l) => LEVELS.includes(l))
    )
      throw new Error("Daraja noto'g'ri");

    const uniq = [...new Set(levels)];
    const r = await rpc("create_room", {
      p_tg: req.user.id,
      p_mode: mode,
      p_levels: uniq,
    });
    lobbyChanged();
    res.json({ ok: true, roomId: r.room_id });
  }),
);

app.post(
  "/api/rooms/:id/join",
  auth,
  h(async (req, res) => {
    const r = await rpc("join_room", {
      p_room: req.params.id,
      p_tg: req.user.id,
    });
    if (!r.ok) throw new Error(r.error);
    if (r.started) await startGame(req.params.id);
    lobbyChanged();
    res.json({ ok: true, started: r.started });
  }),
);

app.post(
  "/api/rooms/:id/leave",
  auth,
  h(async (req, res) => {
    const r = await rpc("leave_room", {
      p_room: req.params.id,
      p_tg: req.user.id,
    });
    if (!r.ok) throw new Error(r.error);
    lobbyChanged();
    res.json({ ok: true });
  }),
);

app.get(
  "/api/leaderboard",
  auth,
  h(async (req, res) => {
    const type = req.query.type;
    const cols = "tg_id,first_name,username,photo_url";
    let q;
    if (type === "wins")
      q = sb
        .from("players")
        .select(`${cols},wins,games`)
        .gt("games", 0)
        .order("wins", { ascending: false })
        .limit(20);
    else if (type === "coins")
      q = sb
        .from("players")
        .select(`${cols},coins`)
        .order("coins", { ascending: false })
        .limit(20);
    else if (type === "active")
      q = sb.from("lb_active").select(`${cols},games_7d`);
    else throw new Error("Noto'g'ri tur");
    const { data, error } = await q;
    if (error) throw error;
    res.json({ rows: data });
  }),
);

// ---------- O'yin mexanikasi ----------
const games = new Map(); // roomId -> game

const snap = (g) =>
  [...g.players.values()].map((p) => ({
    tg_id: p.tgId,
    name: p.name,
    username: p.username,
    idx: p.idx,
    correct: p.correct,
    finished: p.finished,
  }));

const progress = (g) =>
  io.to(`game:${g.roomId}`).emit("game:progress", snap(g));

async function startGame(roomId) {
  try {
    const { data: room, error } = await sb
      .from("rooms")
      .select(
        "id,levels,entry_fee,room_players(tg_id,players(first_name,username))",
      )
      .eq("id", roomId)
      .single();
    if (error) throw error;

    const g = {
      roomId,
      fee: room.entry_fee,
      words: pickWords(room.levels, WORDS_PER_GAME),
      startAt: Date.now() + START_DELAY,
      players: new Map(),
      done: false,
      result: null,
    };
    room.room_players.forEach((rp) =>
      g.players.set(rp.tg_id, {
        tgId: rp.tg_id,
        name: rp.players.first_name,
        username: rp.players.username,
        idx: 0,
        correct: 0,
        timeMs: 0,
        sentAt: null,
        waiting: false,
        finished: false,
        finishedAt: null,
        droppedAt: null,
        timer: null,
        startTimer: null,
      }),
    );
    g.deadline = setTimeout(
      () => settle(g),
      START_DELAY + WORDS_PER_GAME * TIME_LIMIT + 20000,
    );
    games.set(roomId, g);

    for (const id of g.players.keys())
      io.to(`user:${id}`).emit("room:started", { roomId });
  } catch (e) {
    console.error("startGame xatosi:", e);
    await sb.rpc("cancel_room", { p_room: roomId }); // tangalar qaytadi
  }
}

function sendWord(g, p) {
  if (g.done || p.finished || p.waiting) return;

  const wait = g.startAt - Date.now();
  if (wait > 0) {
    clearTimeout(p.startTimer);
    p.startTimer = setTimeout(() => sendWord(g, p), wait + 20);
    return;
  }

  if (!p.sentAt) {
    p.sentAt = Date.now();
    p.timer = setTimeout(() => closeWord(g, p, "timeout"), TIME_LIMIT);
  }
  const w = g.words[p.idx];
  io.to(`user:${p.tgId}`).emit("word:show", {
    index: p.idx,
    total: WORDS_PER_GAME,
    uz: w.uz,
    length: norm(w.en).length,
    remainingMs: Math.max(0, TIME_LIMIT - (Date.now() - p.sentAt)),
  });
}

// kind: correct | timeout | skip
function closeWord(g, p, kind) {
  if (g.done || p.finished || p.waiting) return;
  clearTimeout(p.timer);
  p.sentAt = null;
  p.waiting = true;

  io.to(`user:${p.tgId}`).emit("word:result", {
    index: p.idx,
    kind,
    answer: kind === "correct" ? undefined : g.words[p.idx].en,
  });
  progress(g);
  setTimeout(() => advance(g, p), kind === "correct" ? 900 : 1600);
}

function advance(g, p) {
  if (g.done || p.finished) return;
  p.waiting = false;
  p.idx++;
  if (p.idx >= WORDS_PER_GAME) return finishPlayer(g, p);
  // Uzoq vaqt ulanmagan o'yinchi qolgan so'zlarni xato bilan tugatadi
  if (p.droppedAt && Date.now() - p.droppedAt > 20000)
    return finishPlayer(g, p);
  progress(g);
  sendWord(g, p);
}

function finishPlayer(g, p) {
  p.finished = true;
  p.finishedAt = Date.now();
  clearTimeout(p.timer);
  clearTimeout(p.startTimer);
  io.to(`user:${p.tgId}`).emit("game:done", {
    correct: p.correct,
    timeMs: p.timeMs,
  });
  progress(g);
  if ([...g.players.values()].every((x) => x.finished)) settle(g);
}

async function settle(g) {
  if (g.done) return;
  g.done = true;
  clearTimeout(g.deadline);
  g.players.forEach((p) => {
    clearTimeout(p.timer);
    clearTimeout(p.startTimer);
  });

  const ranked = [...g.players.values()].sort(
    (a, b) =>
      b.correct - a.correct ||
      a.timeMs - b.timeMs ||
      (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity),
  );

  try {
    await rpc("settle_room", {
      p_room: g.roomId,
      p_ranking: ranked.map((p) => ({
        tg_id: p.tgId,
        correct: p.correct,
        time_ms: p.timeMs,
      })),
    });
  } catch (e) {
    console.error("settle xatosi:", e);
  }

  g.result = {
    fee: g.fee,
    pot: g.fee * g.players.size,
    ranking: ranked.map((p, i) => ({
      place: i + 1,
      tg_id: p.tgId,
      name: p.name,
      username: p.username,
      correct: p.correct,
      timeMs: p.timeMs,
    })),
  };
  for (const id of g.players.keys())
    io.to(`user:${id}`).emit("game:result", g.result);
  lobbyChanged();
  setTimeout(() => games.delete(g.roomId), 10 * 60e3);
}

// ---------- Socket ----------
io.use(async (socket, next) => {
  try {
    const u = getUser(socket.handshake.auth?.initData || "");
    if (!u?.id) return next(new Error("auth"));
    await ensurePlayer(u);
    socket.user = u;
    next();
  } catch {
    next(new Error("auth"));
  }
});

io.on("connection", (socket) => {
  const id = socket.user.id;
  socket.join("lobby");
  socket.join(`user:${id}`);

  const ctx = (roomId) => {
    const g = games.get(roomId);
    return { g, p: g?.players.get(id) };
  };

  socket.on("game:ready", ({ roomId }, ack) => {
    const { g, p } = ctx(roomId);
    if (!p) return ack?.({ error: "O'yin topilmadi" });

    socket.join(`game:${roomId}`);
    p.droppedAt = null;
    ack?.({
      startsInMs: Math.max(0, g.startAt - Date.now()),
      total: WORDS_PER_GAME,
      players: snap(g),
      finished: p.finished,
      result: g.result,
    });
    if (!g.done) sendWord(g, p);
  });

  socket.on("answer", ({ roomId, index, value }, ack) => {
    const { g, p } = ctx(roomId);
    if (!p || g.done || p.finished || p.waiting || !p.sentAt || index !== p.idx)
      return ack?.({ ok: false });

    const elapsed = Date.now() - p.sentAt;
    if (elapsed > TIME_LIMIT + 500) return ack?.({ ok: false });

    const right = norm(g.words[p.idx].en);
    if (norm(String(value || "").slice(0, 64)) === right) {
      p.correct++;
      p.timeMs += Math.min(elapsed, TIME_LIMIT);
      ack?.({ ok: true, correct: true });
      closeWord(g, p, "correct");
    } else {
      ack?.({ ok: true, correct: false });
    }
  });

  socket.on("skip", ({ roomId, index }) => {
    const { g, p } = ctx(roomId);
    if (!p || g.done || p.finished || p.waiting || !p.sentAt || index !== p.idx)
      return;
    closeWord(g, p, "skip");
  });

  socket.on("disconnect", () => {
    if (io.sockets.adapter.rooms.get(`user:${id}`)?.size) return;
    for (const g of games.values()) {
      const p = g.players.get(id);
      if (p && !p.finished) p.droppedAt = Date.now();
    }
  });
});

// ---------- Tozalash va tiklash ----------
// To'lmagan xonalar 15 daqiqadan keyin bekor qilinadi
setInterval(async () => {
  const cutoff = new Date(Date.now() - 15 * 60e3).toISOString();
  const { data } = await sb
    .from("rooms")
    .select("id")
    .eq("status", "lobby")
    .lt("created_at", cutoff);
  for (const r of data || []) await sb.rpc("cancel_room", { p_room: r.id });
  if (data?.length) lobbyChanged();
}, 60e3);

// Server qayta ishga tushganda xotiradagi o'yinlar yo'qoladi: tangalarni qaytaramiz
const { data: stuck } = await sb
  .from("rooms")
  .select("id")
  .eq("status", "playing");
for (const r of stuck || []) await sb.rpc("cancel_room", { p_room: r.id });

server.listen(PORT, () => console.log("Server ishga tushdi:", PORT));
