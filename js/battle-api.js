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
  (devId ? "dev:" + JSON.stringify({ id: Number(devId), first_name: "Test" + devId }) : "");

export async function api(path, { method = "GET", body } = {}) {
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
  window.io(API_URL, { auth: { initData }, transports: ["websocket", "polling"] });

export const notify = (msg) => (tg?.showAlert ? tg.showAlert(msg) : alert(msg));

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);