// ===============================
// IRIS AI Lab - main.js
// ===============================

const statusOrder = ["concept", "testing", "validated", "expanding"];

const statusMap = {
  concept:   { dot: "🟡", zh: "構想中" },
  testing:   { dot: "🟠", zh: "驗證中" },
  validated: { dot: "🟢", zh: "已驗證" },
  expanding: { dot: "🔵", zh: "延伸中" },
};

let allProjects = [];
let selectedStatuses = new Set();

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

function hideJsWarning() {
  document.getElementById("js-warning")?.remove();
}

async function init() {
  try {
    const res = await fetch("./projects.json?v=" + Date.now());
    if (!res.ok) throw new Error("projects.json 讀取失敗");

    const data = await res.json();
    allProjects = Array.isArray(data) ? data : data.projects || [];

    renderStatusFilters();
    renderProjects();
    updateCount();
    hideJsWarning();

  } catch (e) {
    console.error(e);
  }
}

function updateCount() {
  $("project-count").textContent = `Projects（共 ${allProjects.length}）`;
}

function renderStatusFilters() {
  const container = $("status-filters");

  container.innerHTML = statusOrder.map(status => {
    const meta = statusMap[status];
    const count = allProjects.filter(p => p.status === status).length;
    const active = selectedStatuses.has(status) ? "active" : "";

    return `
      <button class="tag ${active}" data-status="${status}">
        ${meta.dot} ${meta.zh}（${count}）
      </button>
    `;
  }).join("");

  container.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = btn.dataset.status;
      if (selectedStatuses.has(s)) selectedStatuses.delete(s);
      else selectedStatuses.add(s);
      renderStatusFilters();
      renderProjects();
    });
  });
}

function renderProjects() {
  let filtered = allProjects;

  if (selectedStatuses.size > 0) {
    filtered = allProjects.filter(p => selectedStatuses.has(p.status));
  }

  const list = $("project-list");

  list.innerHTML = filtered.map(renderCard).join("");
}

function renderCard(p) {
  const meta = statusMap[p.status];

  return `
    <article class="card">

      <div class="card-content">
        <div class="card-meta">
          ${meta.dot} ${meta.zh} ｜ 更新 ${escapeHtml(p.updatedAt || "")}
        </div>

        <h3 class="card-title">${escapeHtml(p.title)}</h3>

        ${p.summary ? `<p class="card-summary">${escapeHtml(p.summary)}</p>` : ""}

        ${p.output ? `
          <div class="output-line">
            產出：<strong>${escapeHtml(p.output)}</strong>
          </div>
        ` : ""}
      </div>

      ${p.cover ? `
        <div class="card-image">
          <img src="${escapeHtml(p.cover)}" alt="${escapeHtml(p.title)}">
        </div>
      ` : ""}

      <div class="card-footer">
        <a class="btn" href="./project.html?id=${encodeURIComponent(p.id)}">
          查看完整內容 →
        </a>
      </div>

    </article>
  `;
}

init();