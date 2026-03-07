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

    const event = events[0];

    if (!event.replyToken) {
      return res.status(200).json({
        ok: true,
        message: "No replyToken"
      });
    }

    if (event.type !== "message" || event.message?.type !== "text") {

      await replyText(channelAccessToken, event.replyToken, "目前只支援文字訊息");

      return res.status(200).json({
        ok: true
      });

    }

    const text = (event.message.text || "").trim();

    const replyMessage = parseCommand(text);

    await replyText(channelAccessToken, event.replyToken, replyMessage);

    return res.status(200).json({
      ok: true
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: error.message
    });

  }
}


function parseCommand(text) {

  const lower = text.toLowerCase();

  if (lower.startsWith("/update")) {

    const content = text.replace(/^\/update/i, "").trim();

    if (!content) {

      return "請在 /update 後面輸入內容";

    }

    return `已解析 update 指令

內容如下：

${content}

準備寫入 line-bot-center timeline`;

  }


  if (lower.startsWith("/todo")) {

    const content = text.replace(/^\/todo/i, "").trim();

    return `準備新增待辦

${content}`;

  }


  if (lower.startsWith("/note")) {

    const content = text.replace(/^\/note/i, "").trim();

    return `準備記錄筆記

${content}`;

  }

  return "IRIS 控制中心已收到指令";

}


async function replyText(channelAccessToken, replyToken, text) {

  const response = await fetch(
    "https://api.line.me/v2/bot/message/reply",
    {
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
            text
          }
        ]
      })
    }
  );

  const result = await response.text();

  console.log("LINE reply result:", result);

}