import { API_URL } from "./config.js";

export const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// Brauzerda lokal test: ?dev=101
const params = new URLSearchParams(location.search);
const devId = params.get("dev") || sessionStorage.getItem("devId");
if (devId) sessionStorage.setItem("devId", devId);

// Qurilma kaliti: birinchi kirishda yaratiladi
let memToken = null;
function guestToken() {
  try {
    let t = localStorage.getItem("guestToken");
    if (!t || t.length < 32) {
      t = crypto.randomUUID();
      localStorage.setItem("guestToken", t);
    }
    return t;
  } catch {
    // localStorage yopiq bo'lsa, faqat shu sessiya uchun
    return (memToken ??= crypto.randomUUID());
  }
}

function getInitData() {
  if (tg?.initData) return tg.initData;
  return devId
    ? "dev:" + JSON.stringify({ id: Number(devId), first_name: "Test" + devId })
    : "";
}

export const hasAuth = true;

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-init-data": getInitData(),
      "x-guest-token": guestToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");
  return data;
}

export const connectSocket = () =>
  window.io(API_URL, {
    auth: { initData: getInitData(), guest: guestToken() },
    transports: ["websocket", "polling"],
  });

export function notify(msg) {
  try {
    if (tg?.initData && tg.isVersionAtLeast?.("6.2")) {
      tg.showAlert(msg);
      return;
    }
  } catch {}
  alert(msg);
}

export function debugInfo() {
  return `platform: ${tg?.platform} | initData: ${tg?.initData?.length ?? 0} | url: ${location.pathname}`;
}

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
