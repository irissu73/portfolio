import crypto from "crypto";
import { parseCommand } from "../lib/parseCommand.js";
import { applyProjectUpdate } from "../lib/applyProjectUpdate.js";

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
    let replyMessage = "IRIS 控制中心已收到指令";

    try {
      const parsed = parseCommand(text);

      if (parsed.message) {
        replyMessage = parsed.message;
      } else if (parsed.mode === "ai") {
        const issue = await createGitHubIssueFromAi(parsed.rawText);
        replyMessage = `已收到 AI 更新指令

GitHub Issue 已建立：
#${issue.number} ${issue.title}

接下來將交由既有工作流程處理，完成後網站會自動更新。`;
      } else {
        const updatedProjectsData = await updateProjectsJson(parsed);

        if (parsed.fields?.timeline) {
          const note = parsed.fields.timeline.map((item) => item.note || "").join("\n\n");
          replyMessage = `已更新 ${parsed.projectId} 時間軸

內容如下：

${note}`.trim();
        } else {
          replyMessage = `已更新 ${parsed.projectId} 專案資料`;
        }

        console.log("Updated projects count:", updatedProjectsData.projects.length);
      }
    } catch (error) {
      replyMessage = `更新失敗：${error.message}`;
      console.error("Command handling error:", error);
    }

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

async function createGitHubIssueFromAi(rawText) {
  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const label = process.env.GITHUB_ISSUE_LABEL || "portfolio-update";
  const titlePrefix = process.env.GITHUB_ISSUE_TITLE_PREFIX || "line";

  if (!githubToken || !owner || !repo) {
    throw new Error("Missing GitHub environment variables");
  }

  const projectId = extractProjectId(rawText);
  if (!projectId) {
    throw new Error("缺少專案：請在 /ai 內容中加入「專案：project-id」");
  }

  const today = getTodayDashInTaiwan();
  const title = `${titlePrefix}_${projectId}_${today}`;

  const issueUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;

  const createRes = await fetch(issueUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      body: rawText
    })
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`建立 GitHub Issue 失敗：${errorText}`);
  }

  const issue = await createRes.json();

  const labelRes = await fetch(`${issueUrl}/${issue.number}/labels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      labels: [label]
    })
  });

  if (!labelRes.ok) {
    const errorText = await labelRes.text();
    throw new Error(`Issue 已建立，但加 label 失敗：${errorText}`);
  }

  return issue;
}

function extractProjectId(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("專案：")) {
      return line.replace("專案：", "").trim();
    }
    if (line.toLowerCase().startsWith("id:")) {
      return line.split(":", 2)[1]?.trim() || "";
    }
    if (line.includes("：") && line.startsWith("專案")) {
      return line.split("：", 2)[1]?.trim() || "";
    }
  }

  return "";
}

async function updateProjectsJson(parsed) {
  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = process.env.PROJECTS_JSON_PATH || "projects.json";

  if (!githubToken || !owner || !repo) {
    throw new Error("Missing GitHub environment variables");
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const getRes = await fetch(url, {
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

  const projectsData = JSON.parse(contentText);
  const updatedProjectsData = applyProjectUpdate(parsed, projectsData);

  const newContentText = JSON.stringify(updatedProjectsData, null, 2);
  const newContentBase64 = Buffer.from(newContentText, "utf8").toString("base64");

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `update ${parsed.projectId} via LINE bot`,
      content: newContentBase64,
      sha
    })
  });

  if (!putRes.ok) {
    const errorText = await putRes.text();
    throw new Error(`Failed to update projects.json: ${errorText}`);
  }

  return updatedProjectsData;
}

function getTodayDashInTaiwan() {
  const now = new Date();
  const taiwanNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );

  const year = taiwanNow.getFullYear();
  const month = String(taiwanNow.getMonth() + 1).padStart(2, "0");
  const day = String(taiwanNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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