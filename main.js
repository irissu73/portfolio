// ===============================
// IRIS ｜ AI 實驗場 - main.js (stable)
// Works with your current index.html ids:
// - #status-filters
// - #project-list
// - #project-count
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

/** show a single fatal message (replace previous) */
function showFatal(msg) {
  const host = $("project-list") || document.body;

  // remove previous fatal box if exists
  document.getElementById("fatalBox")?.remove();

  const box = document.createElement("div");
  box.id = "fatalBox";
  box.style.cssText =
    "padding:14px;margin:12px 0;border:1px solid rgba(176,0,32,.25);background:rgba(176,0,32,.06);color:#b00020;font-weight:900;border-radius:14px;line-height:1.5;";
  box.textContent = msg;
  host.prepend(box);
}

/** clear fatal message */
function clearFatal() {
  document.getElementById("fatalBox")?.remove();
}

async function init() {
  try {
    const statusEl = $("status-filters");
    const listEl = $("project-list");
    const countEl = $("project-count");

    // If layout missing, show and stop
    if (!statusEl || !listEl) {
      if (!statusEl) showFatal("⚠️ 找不到 #status-filters（index.html 需要 <div id='status-filters'></div>）");
      if (!listEl) showFatal("⚠️ 找不到 #project-list（index.html 需要 <section id='project-list'></section>）");
      return;
    }

    // Fetch JSON (cache-bust)
    const url = "./projects.json?v=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`projects.json 讀取失敗：HTTP ${res.status} ${res.statusText}`);

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`projects.json 不是合法 JSON（前 120 字：${text.slice(0, 120)}）`);
    }

    allProjects = Array.isArray(data) ? data : (data.projects || []);
    if (!Array.isArray(allProjects)) allProjects = [];

    if (countEl) countEl.textContent = `實驗清單（共 ${allProjects.length}）`;

    renderStatusFilters();
    renderProjects();

    // ✅ If we reached here, JS is working — remove any previous warning
    clearFatal();
  } catch (e) {
    console.error(e);
    showFatal("⚠️ JS 載入失敗：" + (e?.message || String(e)));
  }
  

}

function renderStatusFilters() {
  const statusEl = $("status-filters");
  if (!statusEl) return;

  statusEl.innerHTML = statusOrder.map((status) => {
    const meta = statusMap[status];
    const count = allProjects.filter((p) => p.status === status).length;
    const active = selectedStatuses.has(status) ? "active" : "";
    return `
      <button class="tag status-tag ${active}" data-status="${status}">
        ${meta.dot} ${meta.zh}（${count}）
      </button>
    `;
  }).join("");

  statusEl.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = btn.getAttribute("data-status");
      if (!s) return;

      if (selectedStatuses.has(s)) selectedStatuses.delete(s);
      else selectedStatuses.add(s);

      renderStatusFilters();
      renderProjects();
    });
  });
}

function renderProjects() {
  const listEl = $("project-list");
  if (!listEl) return;

  let filtered = allProjects;

  // OR 多選
  if (selectedStatuses.size > 0) {
    filtered = allProjects.filter((p) => selectedStatuses.has(p.status));
  }

  // pinned 置頂 + updatedAt 新到舊
  filtered = filtered.slice().sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });

  listEl.innerHTML = filtered.map(renderCard).join("");
}

function renderCard(p) {
  const meta = statusMap[p.status] || { dot: "⚪️", zh: "未分類" };
  const detailHref = p.id ? `./project.html?id=${encodeURIComponent(p.id)}` : "./project.html";

  const coverHtml = p.cover ? `
    <div class="card-cover-wrap">
      <img class="card-cover"
           src="${escapeHtml(p.cover)}"
           alt="${escapeHtml(p.title || "")}"
           onerror="this.remove()">
    </div>
  ` : "";

  const outputHtml = p.output ? `
    <div class="output-line">
      產出：<strong>${escapeHtml(p.output)}</strong>
    </div>
  ` : "";

  return `
    <article class="project-card card">
      <div class="card-body content">
        <div class="card-meta meta">
          <span class="dot">${meta.dot}</span>
          ${meta.zh} ｜ 更新 ${escapeHtml(p.updatedAt || "")}
        </div>

        <h3 class="card-title">${escapeHtml(p.title || "")}</h3>

        ${p.summary ? `<p class="card-summary">${escapeHtml(p.summary)}</p>` : ""}

        ${outputHtml}
      </div>

      ${coverHtml}

      <div class="card-footer">
        <a class="btn primary" href="${detailHref}">查看完整內容 →</a>
      </div>
    </article>
  `;
}

  //左側篩選Drawer
function setupDrawer() {
  const menuBtn = document.getElementById("menuBtn");
  const closeBtn = document.getElementById("closeBtn");
  const overlay = document.getElementById("overlay");
  const drawer = document.getElementById("drawer");

  if (!menuBtn || !closeBtn || !overlay || !drawer) return;

  function openDrawer() {
    drawer.classList.add("open");
    overlay.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  menuBtn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  // ESC 關閉（桌機）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
}


// start
init();