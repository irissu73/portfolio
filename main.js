// ===============================
// IRIS AI Lab - main.js (debug-safe)
// ===============================

const statusOrder = ["concept", "testing", "validated", "expanding"];

const statusMap = {
  concept:   { dot: "🟡", zh: "構想期" },
  testing:   { dot: "🟠", zh: "驗證中" },
  validated: { dot: "🟢", zh: "已驗證" },
  expanding: { dot: "🔵", zh: "延伸中" },
};

let allProjects = [];
let selectedStatuses = new Set();

// ---------- utils ----------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function $(id) {
  return document.getElementById(id);
}

function showFatal(msg) {
  const host = $("project-list") || $("content") || document.body;
  const box = document.createElement("div");
  box.style.cssText = "padding:16px;margin:12px 16px;border:1px solid rgba(176,0,32,.25);background:rgba(176,0,32,.06);color:#b00020;font-weight:900;border-radius:14px;line-height:1.5;";
  box.textContent = msg;
  host.prepend(box);
}

// ---------- core ----------
async function init() {
  try {
    // 1) 檢查 main 容器是否存在
    if (!$("status-filters")) showFatal("⚠️ 找不到 #statusBar（請確認 index.html 有 <div id='statusBar'></div>）");
    if (!$("project-list")) showFatal("⚠️ 找不到 #projectList（請確認 index.html 有 <div id='projectList'></div>）");

    // 2) 載入 JSON（抓不到/格式錯會直接顯示原因）
    const jsonUrl = "./projects.json?v=" + Date.now();
    const res = await fetch(jsonUrl);

    if (!res.ok) {
      throw new Error(`projects.json 讀取失敗：HTTP ${res.status} ${res.statusText}（${jsonUrl}）`);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`projects.json 不是合法 JSON（前 120 字：${text.slice(0, 120)}）`);
    }

    allProjects = Array.isArray(data) ? data : (data.projects || []);
    if (!Array.isArray(allProjects)) allProjects = [];

    renderStatusBar();
    renderProjects();
  } catch (e) {
    console.error(e);
    showFatal("⚠️ JS 執行失敗：" + (e?.message || String(e)));
  }
}

function renderStatusBar() {
  const container = $("status-filters");
  if (!container) return;

  container.innerHTML = statusOrder.map((status) => {
    const count = allProjects.filter((p) => p.status === status).length;
    const meta = statusMap[status];

    const active = selectedStatuses.has(status) ? "active" : "";
    return `
      <button class="status-pill ${active}" data-status="${status}">
        <span class="dot">${meta.dot}</span>${meta.zh}（${count}）
      </button>
    `;
  }).join("");

  // 點擊事件（OR 多選）
  container.querySelectorAll(".status-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = btn.getAttribute("data-status");
      if (!s) return;

      if (selectedStatuses.has(s)) selectedStatuses.delete(s);
      else selectedStatuses.add(s);

      renderStatusBar();
      renderProjects();
    });
  });
}

function renderProjects() {
  const list = $("projectList");
  if (!list) return;

  let filtered = allProjects;

  // 狀態 OR 多選
  if (selectedStatuses.size > 0) {
    filtered = allProjects.filter((p) => selectedStatuses.has(p.status));
  }

  list.innerHTML = filtered.map(renderCard).join("");
}

function renderCard(p) {
  const meta = statusMap[p.status] || { dot: "⚪️", zh: "未分類" };
  const updated = escapeHtml(p.updatedAt || "");

  return `
    <div class="card">
      <div class="card-body">
        <div class="card-meta">
          <span class="dot">${meta.dot}</span>
          ${meta.zh} ｜ 更新 ${updated}
        </div>

        <h3 class="card-title">${escapeHtml(p.title || "")}</h3>

        ${p.summary ? `<p class="card-summary">${escapeHtml(p.summary)}</p>` : ""}

        ${p.output ? `
          <div class="output-line">產出：<strong>${escapeHtml(p.output)}</strong></div>
        ` : ""}
      </div>

      ${p.cover ? `
        <div class="card-cover-wrap">
          <img class="card-cover"
               src="${escapeHtml(p.cover)}"
               alt="${escapeHtml(p.title || "")}"
               onerror="this.remove()">
        </div>
      ` : ""}

      <div class="card-footer">
        <a class="btn primary" href="./project.html?id=${encodeURIComponent(p.id)}">查看完整內容 →</a>
      </div>
    </div>
  `;
}

// 啟動
init();