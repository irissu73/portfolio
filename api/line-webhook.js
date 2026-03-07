export default async function handler(req, res) {
  // 只接受 POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  try {
    const body = req.body;

    console.log("LINE webhook body:", JSON.stringify(body, null, 2));

    // LINE event 陣列
    const events = body.events || [];

    // 先處理第一個 event
    const event = events[0];

    // 沒有 event 也先回成功，避免 LINE 一直重送
    if (!event) {
      return res.status(200).json({ ok: true, message: "No events" });
    }

    // replyToken 用來回覆訊息
    const replyToken = event.replyToken;

    // 沒有 replyToken 就不回覆，但 webhook 仍回 200
    if (!replyToken) {
      return res.status(200).json({ ok: true, message: "No replyToken" });
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
      return res.status(500).json({
        ok: false,
        message: "Missing LINE_CHANNEL_ACCESS_TOKEN"
      });
    }

    // 回覆 LINE 訊息
    const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [
          {
            type: "text",
            text: "IRIS 控制中心已收到指令"
          }
        ]
      })
    });

    const lineData = await lineRes.text();
    console.log("LINE reply result:", lineData);

    return res.status(200).json({
      ok: true,
      message: "Reply sent"
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({
      ok: false,
      message: error.message
    });
  }
}