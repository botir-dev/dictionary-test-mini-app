import { API_URL } from "./config.js";

export const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// Brauzerda test: battle-game.html?dev=101 (har bir tabda boshqa raqam)
const params = new URLSearchParams(location.search);
const devId = params.get("dev") || sessionStorage.getItem("devId");
if (devId) sessionStorage.setItem("devId", devId);

const initData =
  tg?.initData ||
  (devId
    ? "dev:" + JSON.stringify({ id: Number(devId), first_name: "Test" + devId })
    : "");

console.log(
  "initData:",
  JSON.stringify(tg?.initData),
  "platform:",
  tg?.platform,
);

export const hasAuth = Boolean(initData);

const NO_AUTH =
  "Bu sahifa Telegram ichida (bot orqali) ochilishi kerak. Brauzerda sinash uchun manzil oxiriga ?dev=101 qo'shing.";

export async function api(path, { method = "GET", body } = {}) {
  if (!hasAuth) throw new Error(NO_AUTH);
  const res = await fetch(API_URL + path, {
    method,
    headers: { "Content-Type": "application/json", "x-init-data": initData },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");
  return data;
}

export const connectSocket = () =>
  window.io(API_URL, {
    auth: { initData },
    transports: ["websocket", "polling"],
  });

// Telegram ichida (6.2+) chiroyli oyna, boshqa joyda oddiy alert
export function notify(msg) {
  try {
    if (tg?.initData && tg.isVersionAtLeast?.("6.2")) {
      tg.showAlert(msg);
      return;
    }
  } catch {}
  alert(msg);
}

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function debugInfo() {
  return [
    `platform: ${tg?.platform}`,
    `initData uzunligi: ${tg?.initData?.length ?? 0}`,
    `hash bor: ${location.hash.includes("tgWebAppData")}`,
    `url: ${location.pathname}`,
  ].join(" | ");
}
