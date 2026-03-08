export function parseCommand(text) {
  const normalized = String(text || "").trim();

  if (!normalized) {
    throw new Error("指令內容為空");
  }

  // /update
  if (startsWithCommand(normalized, ["/update"])) {
    const content = removeCommandPrefix(normalized, ["/update"]);

    if (!content) {
      throw new Error("請在 /update 後輸入內容");
    }

    const projectId = extractProjectId(content);
    if (!projectId) {
      throw new Error("缺少專案：請加入「專案：project-id」");
    }

    const fields = parseUpdateFields(content);

    if (!Object.keys(fields).length) {
      throw new Error("找不到可更新欄位");
    }

    return {
      mode: "direct",
      projectId,
      fields
    };
  }

  return {
    message: "IRIS 控制中心已收到指令"
  };
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

function extractProjectId(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("專案：")) {
      return line.replace("專案：", "").trim();
    }
    if (line.startsWith("專案:")) {
      return line.replace("專案:", "").trim();
    }
  }

  return "";
}

function parseUpdateFields(rawText) {
  const aliasMap = {
    "專案名稱": "name",
    "名稱": "name",
    "name": "name",

    "摘要": "summary",
    "summary": "summary",

    "封面": "cover",
    "cover": "cover",

    "產出": "output",
    "output": "output",

    "狀態": "status",
    "status": "status",

    "專案內容": "content",
    "內容": "content",
    "content": "content",

    "時間軸": "timeline",
    "timeline": "timeline",

    "下一步": "next",
    "next": "next",

    "成果畫面": "gallery",
    "成果": "gallery",
    "gallery": "gallery",

    "技術": "techTags",
    "技術標籤": "techTags",
    "techtags": "techTags",
    "techTags": "techTags",

    "應用類型": "category",
    "category": "category"
  };

  const pattern = /【([^】]+)】([\s\S]*?)【\/\1】/g;
  const fields = {};
  let match;

  while ((match = pattern.exec(rawText)) !== null) {
    const rawName = match[1].trim();
    const rawBody = match[2].replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    const fieldKey = aliasMap[rawName];
    if (!fieldKey) continue;

    const { mode, body } = parseModeAndBody(rawBody, fieldKey);

    if (fieldKey === "name" || fieldKey === "summary" || fieldKey === "cover" || fieldKey === "output" || fieldKey === "status") {
      if (body) {
        fields[fieldKey] = body.trim();
      }
      continue;
    }

    if (fieldKey === "content") {
      const items = splitParagraphs(body);
      if (!items.length) continue;

      if (mode === "ALL") {
        fields[fieldKey] = items;
      } else {
        fields[fieldKey] = items;
      }
      continue;
    }

    if (fieldKey === "next" || fieldKey === "category" || fieldKey === "techTags") {
      const items = splitList(body);
      if (!items.length) continue;
      fields[fieldKey] = items;
      continue;
    }

    if (fieldKey === "gallery") {
      const items = splitList(body);
      if (!items.length) continue;
      fields[fieldKey] = items;
      continue;
    }

    if (fieldKey === "timeline") {
      const items = parseTimeline(body);
      if (!items.length) continue;
      fields[fieldKey] = items;
    }
  }

  return fields;
}

function parseModeAndBody(rawBody, fieldKey) {
  const defaultModeMap = {
    name: "ALL",
    summary: "ALL",
    cover: "ALL",
    output: "ALL",
    status: "ALL",
    content: "ADD",
    timeline: "ADD",
    next: "ADD",
    gallery: "ADD",
    techTags: "ADD",
    category: "ADD"
  };

  const lines = String(rawBody || "").split("\n");
  let mode = defaultModeMap[fieldKey] || "ALL";
  let body = rawBody;

  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim().toUpperCase();
    if (!s) continue;

    if (s === "ALL" || s === "ADD") {
      mode = s;
      body = lines.slice(i + 1).join("\n").trim();
    } else {
      body = lines.slice(i).join("\n").trim();
    }
    break;
  }

  return { mode, body };
}

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitList(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function parseTimeline(text) {
  const blocks = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!lines.length) continue;

    const first = lines[0];
    const m = first.match(/^(今天|昨天|\d{4}[.-]\d{2}[.-]\d{2})\s+(.+)$/);

    if (!m) continue;

    const date = m[1].trim();
    const title = m[2].trim();
    const note = lines.slice(1).join("\n").trim();

    result.push({
      date,
      title,
      note
    });
  }

  return result;
}