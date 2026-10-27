module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("ok");

  const msg = req.body?.message;

  if (msg?.text?.startsWith("/start")) {
    await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: `O'yinni boshlash uchun pastdagi "Boshlash" tugmasini bosing!👇🏻`,
        }),
      },
    );
  }

  res.status(200).send("ok");
};
