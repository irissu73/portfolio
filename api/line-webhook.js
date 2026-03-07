import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Method Not Allowed"
    });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["x-line-signature"];
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    if (!channelSecret) {
      return res.status(500).json({
        ok: false,
        message: "Missing LINE_CHANNEL_SECRET"
      });
    }

    if (!signature) {
      return res.status(401).json({
        ok: false,
        message: "Missing x-line-signature"
      });
    }

    const isValid = verifyLineSignature(rawBody, channelSecret, signature);

    if (!isValid) {
      return res.status(401).json({
        ok: false,
        message: "Invalid LINE signature"
      });
    }

    const body = JSON.parse(rawBody);
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
  const normalized = text.trim();

  if (startsWithCommand(normalized, ["/update", "/更新"])) {
    const content = removeCommandPrefix(normalized, ["/update", "/更新"]);

    if (!content) {
      return "請在 /update 或 /更新 後面輸入內容";
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

  if (startsWithCommand(normalized, ["/todo", "/待辦"])) {
    const content = removeCommandPrefix(normalized, ["/todo", "/待辦"]);

    if (!content) {
      return "請在 /todo 或 /待辦 後面輸入內容";
    }

    return `準備新增待辦到 line-bot-center

${content}`;
  }

  if (startsWithCommand(normalized, ["/note", "/筆記"])) {
    const content = removeCommandPrefix(normalized, ["/note", "/筆記"]);

    if (!content) {
      return "請在 /note 或 /筆記 後面輸入內容";
    }

    return `已記下筆記草稿，暫未寫入專案資料

${content}`;
  }

  return "IRIS 控制中心已收到指令";
}

function startsWithCommand(text, commands) {
  return commands.some((cmd) => text.toLowerCase().startsWith(cmd.toLowerCase()));
}

function removeCommandPrefix(text, commands) {
  for (const cmd of commands) {
    const regex = new RegExp(`^${escapeRegExp(cmd)}`, "i");
    if (regex.test(text)) {
      return text.replace(regex, "").trim();
    }
  }
  return text.trim();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const projects = JSON.parse(contentText);
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

  target.timeline.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
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
  const taiwanNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );

  const year = taiwanNow.getFullYear();
  const month = String(taiwanNow.getMonth() + 1).padStart(2, "0");
  const day = String(taiwanNow.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function verifyLineSignature(rawBody, channelSecret, signature) {
  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(rawBody)
    .digest("base64");

  return hash === signature;
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      resolve(data);
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
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