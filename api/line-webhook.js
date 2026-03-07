export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).end()
  }

  const body = req.body

  if (!body.events) {
    return res.status(200).end()
  }

  for (const event of body.events) {

    if (event.type !== "message") continue
    if (event.message.type !== "text") continue

    const text = event.message.text.trim()
    const replyToken = event.replyToken

    const source = event.source || {}

    const userId = source.userId
    const groupId = source.groupId
    const roomId = source.roomId

    // ==============================
    // /who 指令
    // ==============================

    if (text === "/who") {

      const msg =
`userId: ${userId || "none"}
groupId: ${groupId || "none"}
roomId: ${roomId || "none"}`

      await replyMessage(replyToken, msg)
      continue
    }

    // ==============================
    // /ai 指令
    // ==============================

    if (text.startsWith("/ai")) {

      const content = text.replace("/ai", "").trim()

      if (!content) {
        await replyMessage(replyToken, "請提供 AI 更新內容")
        continue
      }

      const projectMatch = content.match(/專案[:：]\s*(.+)/)

      if (!projectMatch) {
        await replyMessage(replyToken, "找不到專案 id\n請使用：專案：xxx")
        continue
      }

      const projectId = projectMatch[1].trim()

      const date = new Date().toISOString().slice(0,10)

      const title = `line_${projectId}_${date}`

      const issueBody = content

      const issue = await createIssue(title, issueBody)

      const msg =
`🤖 已建立更新任務
🚀 正在更新網站

GitHub Issue：
#${issue.number} ${title}`

      await replyMessage(replyToken, msg)

      continue
    }

  }

  res.status(200).end()

}


// ==============================
// Reply message
// ==============================

async function replyMessage(replyToken, text) {

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
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
  })

}


// ==============================
// Create GitHub Issue
// ==============================

async function createIssue(title, body) {

  const repo = process.env.GITHUB_REPO
  const token = process.env.GITHUB_TOKEN

  const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      body,
      labels: ["portfolio-update"]
    })
  })

  const data = await r.json()

  return data
}