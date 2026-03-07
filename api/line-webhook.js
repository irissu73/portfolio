export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Method Not Allowed"
    });
  }

  try {
    const body = req.body;
    const events = body.events || [];

    if (!events.length) {
      return res.status(200).json({
        ok: true,
        message: "No events"
      });
    }

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
      return res.status(500).json({
        ok: false,
        message: "Missing LINE_CHANNEL_ACCESS_TOKEN"
      });
    }

    // 這一版先只處理第一個 event
    const event = events[0];

    // 沒有 replyToken 時，仍回 200，避免 LINE 重送
    if (!event.replyToken) {
      return res.status(200).json({
        ok: true,
        message: "No replyToken"
      });
    }

    // 只處理文字訊息
    if (event.type !== "message" || event.message?.type !== "text") {
      await replyText(channelAccessToken, event.replyToken, "目前只支援文字指令");
      return res.status(200).json({
        ok: true,
        message: "Non-text message handled"
      });
    }

    const userText = (event.message.text || "").trim();
    const replyMessage = getReplyMessage(userText);

    await replyText(channelAccessToken, event.replyToken, replyMessage);

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

function getReplyMessage(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.startsWith("/update")) {
    return "準備更新 line-bot-center 時間軸";
  }

  if (lowerText.startsWith("/todo")) {
    return "準備新增待辦到 line-bot-center";
  }

  if (lowerText.startsWith("/note")) {
    return "準備記錄筆記到 line-bot-center";
  }

  return "IRIS 控制中心已收到指令";
}

async function replyText(channelAccessToken, replyToken, text) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text
        }
      ]
    })
  });

  const resultText = await response.text();
  console.log("LINE reply result:", resultText);

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${resultText}`);
  }
}