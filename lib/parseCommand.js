export function parseCommand(text) {
  const normalized = String(text || "").trim();

  if (!normalized) {
    throw new Error("指令內容為空");
  }

  if (startsWithCommand(normalized, ["/ai"])) {
    const content = removeCommandPrefix(normalized, ["/ai"]);

    if (!content) {
      throw new Error("請在 /ai 後輸入內容");
    }

    return {
      mode: "ai",
      rawText: content
    };
  }

  if (startsWithCommand(normalized, ["/update", "/更新"])) {
    const content = removeCommandPrefix(normalized, ["/update", "/更新"]);

    if (!content) {
      throw new Error("請在 /update 或 /更新 後面輸入內容");
    }

    return {
      mode: "direct",
      projectId: "line-bot-center",
      fields: {
        timeline: [
          {
            title: "進度更新",
            note: content
          }
        ]
      }
    };
  }

  if (startsWithCommand(normalized, ["/todo", "/待辦"])) {
    const content = removeCommandPrefix(normalized, ["/todo", "/待辦"]);

    return {
      message: content
        ? `準備新增待辦到 line-bot-center\n\n${content}`
        : "請在 /todo 或 /待辦 後面輸入內容"
    };
  }

  if (startsWithCommand(normalized, ["/note", "/筆記"])) {
    const content = removeCommandPrefix(normalized, ["/note", "/筆記"]);

    return {
      message: content
        ? `已記下筆記草稿，暫未寫入專案資料\n\n${content}`
        : "請在 /note 或 /筆記 後面輸入內容"
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