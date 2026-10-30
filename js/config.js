const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

export const API_URL = "https://dictionary-test-mini-app.onrender.com"; // Render manzilingizni yozing

export const PAY = {
  card: "4073 4200 5759 9494", // ← o'zingizning karta raqamingiz
  owner: "BOTIRJON SOBIROV",       // ← karta egasi
  amount: "10 000",
  coins: 100,
  contact: "botirdev",
};