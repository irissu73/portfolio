// ===============================
// IRIS ｜ AI 實驗場 - main.js
// Works with index.html ids:
// - #status-filters, #project-list, #project-count
// - drawer: #drawer, #overlay, #menuBtn, #closeDrawerBtn, #clearFiltersBtn
// - tags: #directionTags, #techTags
// ===============================

const statusOrder = ["concept", "testing", "validated", "expanding"];

const statusMap = {
  concept:   { dot: "🟡", zh: "構想中" },
  testing:   { dot: "🟠", zh: "驗證中" },
  validated: { dot: "🟢", zh: "已驗證" },
  expanding: { dot: "🔵", zh: "延伸中" },
};

// filters (OR multi-select)
let allProjects = [];
let selectedStatuses = new Set();
let selectedDirections = new Set();
let selectedTech = new Set();

// ---------- utils ----------
function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showFatal(msg) {
  const host = $("project-list") || document.body;
  const box = document.createElement("div");
  box.className = "warn";
  box.textContent = msg;
  host.prepend(box);
}

function removeJsWarning() {
  $("js-warning")?.remove();
}

function isNonEmptyArray(x) {
  return Array.isArray(x) && x.length > 0;
}

function includesAny(arr, selectedSet) {
  if (!isNonEmptyArray(arr) || selectedSet.size === 0) return false;
  for (const v of arr) if (selectedSet.has(v)) return true;
  return false;
}

// ---------- drawer ----------
function openDrawer() {
  $("drawer")?.classList.add("open");
  $("overlay")?.classList.add("show");
  document.body.classList.add("no-scroll");
}
function closeDrawer() {
  $("drawer")?.classList.remove("open");
  $("overlay")?.classList.remove("show");
  document.body.classList.remove("no-scroll");
}
function bindDrawer() {
  $("menuBtn")?.addEventListener("click", openDrawer);
  $("closeDrawerBtn")?.addEventListener("click", closeDrawer);
  $("overlay")?.addEventListener("click", closeDrawer);

  $("clearFiltersBtn")?.addEventListener("click", () => {
    selectedDirections.clear();
    selectedTech.clear();
    renderDrawerTags();
    renderProjects();
  });
}

// ---------- to top ----------
function bindToTop() {
  const btn = $("toTopBtn");
  if (!btn) return;

  function onScroll() {
    if (window.scrollY > 400) btn.classList.add("show");
    else btn.classList.remove("show");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------- data load ----------
async function loadProjects() {
  const url = "./projects.json?v=" + Date.now();
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`projects.json 讀取失敗：HTTP ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`projects.json 不是合法 JSON（前 120 字：${text.slice(0, 120)}）`);
  }

  const arr = Array.isArray(data) ? data : (data.projects || []);
  return Array.isArray(arr) ? arr : [];
}

// ---------- status bar ----------
function statusCount(status) {
  return allProjects.filter(p => p.status === status).length;
}

function renderStatusFilters() {
  const el = $("status-filters");
  if (!el) return;

  // 固定 4 個都顯示，即使為 0
  el.innerHTML = statusOrder.map((status) => {
    const meta = statusMap[status];
    const count = statusCount(status);
    const active = selectedStatuses.has(status) ? "active" : "";
    return `
      <button class="tag status-tag ${active}" data-status="${status}">
        ${meta.dot} ${meta.zh}（${count}）
      </button>
    `;
  }).join("");

  el.querySelectorAll("[data-status]").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = btn.getAttribute("data-status");
      if (!s) return;

      // 多選 OR
      if (selectedStatuses.has(s)) selectedStatuses.delete(s);
      else selectedStatuses.add(s);

      renderStatusFilters();
      renderProjects();
    });
  });
}

// ---------- drawer tags ----------
function collectTagSets() {
  const directionSet = new Set();
  const techSet = new Set();

  for (const p of allProjects) {
    if (Array.isArray(p.directions)) p.directions.forEach(t => directionSet.add(t));
    if (Array.isArray(p.tech)) p.tech.forEach(t => techSet.add(t));
  }

  // sort A-Z (中文會用字典序)
  return {
    directions: Array.from(directionSet).sort((a,b)=>String(a).localeCompare(String(b))),
    tech: Array.from(techSet).sort((a,b)=>String(a).localeCompare(String(b))),
  };
}

function renderTagGroup(containerId, tags, selectedSet) {
  const el = $(containerId);
  if (!el) return;

  el.innerHTML = tags.map(tag => {
    const active = selectedSet.has(tag) ? "active" : "";
    return `<button class="tag ${active}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
  }).join("");

  el.querySelectorAll("[data-tag]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.getAttribute("data-tag");
      if (!tag) return;

      // 多選 OR
      if (selectedSet.has(tag)) selectedSet.delete(tag);
      else selectedSet.add(tag);

      renderDrawerTags();
      renderProjects();
    });
  });
}

let cachedTagSets = { directions: [], tech: [] };

function renderDrawerTags() {
  renderTagGroup("directionTags", cachedTagSets.directions, selectedDirections);
  renderTagGroup("techTags", cachedTagSets.tech, selectedTech);
}

// ---------- filtering ----------
function applyFilters(projects) {
  return projects.filter(p => {
    // status OR
    const statusOk = (selectedStatuses.size === 0) || selectedStatuses.has(p.status);

    // direction OR
    const dirOk =
      (selectedDirections.size === 0) ||
      includesAny(p.directions, selectedDirections);

    // tech OR
    const techOk =
      (selectedTech.size === 0) ||
      includesAny(p.tech, selectedTech);

    return statusOk && dirOk && techOk;
  });
}

// ---------- sorting ----------
function sortProjects(projects) {
  return projects.slice().sort((a, b) => {
    // pinned first
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;

    // updatedAt desc
    const ad = String(a.updatedAt || "");
    const bd = String(b.updatedAt || "");
    if (ad !== bd) return bd.localeCompare(ad);

    // fallback: title
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

// ---------- render cards ----------
function renderCard(p) {
  const meta = statusMap[p.status] || { dot: "⚪️", zh: "未分類" };
  const detailHref = p.id ? `./project.html?id=${encodeURIComponent(p.id)}` : "./project.html";

  const coverHtml = p.cover ? `
    <div class="card-cover-wrap">
      <img class="card-cover"
           src="${escapeHtml(p.cover)}"
           alt="${escapeHtml(p.title || "")}"
           loading="lazy"
           onerror="this.remove()">
    </div>
  ` : "";

  const outputHtml = p.output ? `
    <div class="output-line">產出：<strong>${escapeHtml(p.output)}</strong></div>
  ` : "";

  const techTags = Array.isArray(p.tech) ? p.tech : [];
  const tagHtml = techTags.length ? `
    <div class="mini-tags">
      ${techTags.map(t => `<span class="mini-tag">${escapeHtml(t)}</span>`).join("")}
    </div>
  ` : "";

  return `
    <article class="card project-card">
      <div class="card-body">
        <div class="card-meta">
          <span class="dot">${meta.dot}</span>
          ${meta.zh} ｜ 更新 ${escapeHtml(p.updatedAt || "")}
        </div>

        <h3 class="card-title">${escapeHtml(p.title || "")}</h3>

        ${p.summary ? `<p class="card-summary">${escapeHtml(p.summary)}</p>` : ""}

        ${outputHtml}
        ${tagHtml}
      </div>

      ${coverHtml}

      <div class="card-footer right">
        <a class="btn primary" href="${detailHref}">查看完整內容 →</a>
      </div>
    </article>
  `;
}

function renderProjects() {
  const listEl = $("project-list");
  if (!listEl) return;

  const filtered = sortProjects(applyFilters(allProjects));
  listEl.innerHTML = filtered.map(renderCard).join("");

  const countEl = $("project-count");
  if (countEl) {
    countEl.textContent = `Projects（共 ${filtered.length}）`;
  }
}

// ---------- init ----------
async function init() {
  try {
    bindDrawer();
    bindToTop();

    allProjects = await loadProjects();

    // cache tag sets from loaded projects
    cachedTagSets = collectTagSets();

    renderStatusFilters();
    renderDrawerTags();
    renderProjects();

    removeJsWarning();
  } catch (e) {
    console.error(e);
    showFatal("⚠️ JS 載入失敗：" + (e?.message || String(e)));
  }
}

init();