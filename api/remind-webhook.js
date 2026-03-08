export default async function handler(req, res) {
  const body = req.body;

  const events = body.events || [];

  for (const event of events) {
    if (event.type === "message") {
      const replyToken = event.replyToken;

      const message = {
        type: "text",
        text: "🔔 提醒小助手已收到訊息"
      };

      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN_REMIND}`
        },
        body: JSON.stringify({
          replyToken,
          messages: [message]
        })
      });
    }
  }

  res.status(200).json({ ok: true });
}