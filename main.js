// ===============================
// IRIS AI Lab - main.js
// ===============================

const statusOrder = ["concept", "testing", "validated", "expanding"];

const statusMap = {
  concept:   { dot: "🟡", zh: "構想期" },
  testing:   { dot: "🟠", zh: "驗證中" },
  validated: { dot: "🟢", zh: "已驗證" },
  expanding: { dot: "🔵", zh: "延伸中" }
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

// ---------- init ----------
async function init() {
  try {
    const res = await fetch("./projects.json?v=" + Date.now());
    const data = await res.json();
    allProjects = Array.isArray(data) ? data : (data.projects || []);
  } catch (e) {
    console.error("載入 projects.json 失敗", e);
    return;
  }

  renderStatusBar();
  renderProjects();
}

init();

// ===============================
// 狀態區
// ===============================

function renderStatusBar() {
  const container = document.getElementById("statusBar");
  if (!container) return;

  container.innerHTML = statusOrder.map(status => {
    const count = allProjects.filter(p => p.status === status).length;
    const meta = statusMap[status];

    return `
      <button 
        class="status-pill ${selectedStatuses.has(status) ? "active" : ""}"
        onclick="toggleStatus('${status}')">
        <span class="dot">${meta.dot}</span>
        ${meta.zh}（${count}）
      </button>
    `;
  }).join("");
}

function toggleStatus(status) {
  if (selectedStatuses.has(status)) {
    selectedStatuses.delete(status);
  } else {
    selectedStatuses.add(status);
  }

  renderStatusBar();
  renderProjects();
}

// ===============================
// 專案卡
// ===============================

function renderProjects() {
  const list = document.getElementById("projectList");
  if (!list) return;

  let filtered = allProjects;

  // OR 篩選
  if (selectedStatuses.size > 0) {
    filtered = allProjects.filter(p => selectedStatuses.has(p.status));
  }

  list.innerHTML = filtered.map(p => renderCard(p)).join("");
}

function renderCard(p) {
  const meta = statusMap[p.status] || { dot: "⚪️", zh: "未分類" };

  return `
    <div class="card">

      <div class="card-body">

        <div class="card-meta">
          <span class="dot">${meta.dot}</span>
          ${meta.zh} ｜ 更新 ${escapeHtml(p.updatedAt || "")}
        </div>

        <h3 class="card-title">
          ${escapeHtml(p.title)}
        </h3>

        <p class="card-summary">
          ${escapeHtml(p.summary || "")}
        </p>

        ${p.output ? `
          <div class="output-line">
            產出：<strong>${escapeHtml(p.output)}</strong>
          </div>
        ` : ""}

      </div>

      ${p.cover ? `
        <div class="card-cover-wrap">
          <img src="${escapeHtml(p.cover)}" 
               alt="${escapeHtml(p.title)}"
               class="card-cover"
               onerror="this.remove()">
        </div>
      ` : ""}

      <div class="card-footer">
        <a href="./project.html?id=${encodeURIComponent(p.id)}" 
           class="btn primary">
          查看完整內容 →
        </a>
      </div>

    </div>
  `;
}