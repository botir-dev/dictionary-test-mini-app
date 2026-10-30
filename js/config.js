const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

export const API_URL = isLocal
  ? "http://localhost:3000"
  : "https://dictionary-test-mini-app.onrender.com"; // Render manzilingizni yozing
