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
      return res.status(200).json({ ok: true });
    }

    const text = (event.message.text || "").trim();
    const replyMessage = await handleCommand(text);

    await replyText(channelAccessToken, event.replyToken, replyMessage);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({
      ok: false,
      message: error.message
    });
  }
}

async function handleCommand(text) {
  const lower = text.toLowerCase();

  if (lower.startsWith("/update")) {
    const content = text.replace(/^\/update/i, "").trim();

    if (!content) {
      return "請在 /update 後面輸入內容";
    }

    await appendTimelineToProject({
      projectId: "line-bot-center",
      title: "進度更新",
      note: content
    });

    return `已更新 line-bot-center 時間軸

內容如下：

${content}`;
  }

  if (lower.startsWith("/todo")) {
    const content = text.replace(/^\/todo/i, "").trim();

    if (!content) {
      return "請在 /todo 後面輸入內容";
    }

    return `準備新增待辦到 line-bot-center

${content}`;
  }

  if (lower.startsWith("/note")) {
    const content = text.replace(/^\/note/i, "").trim();

    if (!content) {
      return "請在 /note 後面輸入內容";
    }

    return `準備記錄筆記到 line-bot-center

${content}`;
  }

  return "IRIS 控制中心已收到指令";
}

async function appendTimelineToProject({ projectId, title, note }) {
  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = process.env.PROJECTS_JSON_PATH || "projects.json";

  if (!githubToken || !owner || !repo) {
    throw new Error("Missing GitHub environment variables");
  }

  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const getRes = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (!getRes.ok) {
    const errorText = await getRes.text();
    throw new Error(`Failed to read projects.json: ${errorText}`);
  }

  const fileData = await getRes.json();
  const sha = fileData.sha;
  const contentBase64 = fileData.content.replace(/\n/g, "");
  const contentText = Buffer.from(contentBase64, "base64").toString("utf8");

  let projects = JSON.parse(contentText);

  // 如果你的 projects.json 是 { "projects": [...] } 這種格式
  const projectList = Array.isArray(projects) ? projects : projects.projects;

  if (!Array.isArray(projectList)) {
    throw new Error("projects.json 格式不是陣列，也不是 { projects: [] }");
  }

  const target = projectList.find((p) => p.id === projectId);

  if (!target) {
    throw new Error(`找不到專案 id：${projectId}`);
  }

  if (!Array.isArray(target.timeline)) {
    target.timeline = [];
  }

  const today = getTodayInTaiwan();

  
  target.timeline.push({
    date: today,
    phase: target.status || "concept",
    title,
    note
  });

  // 依日期排序（舊到新）
  target.timeline.sort((a, b) => {
    const aDate = a.date || "";
    const bDate = b.date || "";
    return aDate.localeCompare(bDate);
  });

  // 若有 updated 欄位，一起更新
  target.updated = today;

  const newContentText = JSON.stringify(projects, null, 2);
  const newContentBase64 = Buffer.from(newContentText, "utf8").toString("base64");

  const putRes = await fetch(getUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `update ${projectId} timeline via LINE bot`,
      content: newContentBase64,
      sha
    })
  });

  if (!putRes.ok) {
    const errorText = await putRes.text();
    throw new Error(`Failed to update projects.json: ${errorText}`);
  }

  return await putRes.json();
}

function getTodayInTaiwan() {
  const now = new Date();
  const taiwanDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);

  return taiwanDate;
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

  const result = await response.text();
  console.log("LINE reply result:", result);

  if (!response.ok) {
    throw new Error(`LINE reply failed: ${result}`);
  }
}