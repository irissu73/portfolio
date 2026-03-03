// ===============================
// IRIS ｜ AI 實驗場 - main.js (fixed full)
// Works with your current index.html ids:
// - #status-filters
// - #project-list
// - #project-count
// - #direction-filters
// - #tech-filters
// - #menuBtn #closeBtn #overlay #drawer #clearFilters
// ===============================
console.log("✅ main.js loaded: base008");

const statusOrder = ["concept", "testing", "validated", "expanding"];

const statusMap = {
  concept:   { dot: "🟡", zh: "構想中" },
  testing:   { dot: "🟠", zh: "驗證中" },
  validated: { dot: "🟢", zh: "已驗證" },
  expanding: { dot: "🔵", zh: "延伸中" },
};

let allProjects = [];
let selectedStatuses = new Set();
let selectedDirections = new Set();
let selectedTech = new Set();

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

//強制清除函式
function nukeLegacyWarning() {
  const needle1 = "JS 尚未載入";
  const needle2 = "main.js / projects.json";

  // 刪掉我們自己的 fatal
  document.getElementById("fatalBox")?.remove();

  // 掃描整頁：只要元素文字包含關鍵字就移除
  document.querySelectorAll("body *").forEach(el => {
    if (el.children.length === 0) {
      const t = (el.textContent || "").trim();
      if (t.includes(needle1) || t.includes(needle2)) {
        el.remove();
      }
    }
  });
}

function uniqSorted(arr) {
  return Array.from(new Set((arr || []).filter(Boolean).map(String)))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

// ✅ align to your JSON fields: directionTags / techTags
function getDirections(p) {
  return Array.isArray(p?.directionTags) ? p.directionTags.map(String) : [];
}
function getTech(p) {
  return Array.isArray(p?.techTags) ? p.techTags.map(String) : [];
}

// ---------- Drawer ----------
function setupDrawer() {
  const menuBtn = $("menuBtn");
  const closeBtn = $("closeBtn");
  const overlay = $("overlay");
  const drawer = $("drawer");
  const clearBtn = $("clearFilters");

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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // ✅ 清除所有篩選（狀態+方向+技術）
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selectedStatuses.clear();
      selectedDirections.clear();
      selectedTech.clear();
      renderStatusFilters();
      renderDrawerFilters();
      renderProjects();
      nukeLegacyWarning();
    });
  }
}

//回最頂
// 回到上方按鈕
function setupBackToTop() {
  const btn = document.getElementById("backToTop");
  if (!btn) return;

  function refresh() {
    // 內容短：直接顯示（方便現在資料少測試）
    const canScroll = document.documentElement.scrollHeight > window.innerHeight + 10;
    if (!canScroll) {
      btn.classList.add("show");
      return;
    }

    // 有滾動就顯示
    if (window.scrollY > 1) btn.classList.add("show");
    else btn.classList.remove("show");
  }

  window.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh);

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 給 renderProjects 呼叫（篩選後高度變動）
  window.__updateBackToTop = refresh;

  // 初始判斷
  refresh();
}

// ---------- init ----------
async function init() {
  try {
    const statusEl = $("status-filters");
    const listEl = $("project-list");
    const countEl = $("project-count");

    if (!statusEl || !listEl) {
      if (!statusEl) showFatal("⚠️ 找不到 #status-filters（index.html 需要 <div id='status-filters'></div>）");
      if (!listEl) showFatal("⚠️ 找不到 #project-list（index.html 需要 <section id='project-list'></section>）");
      return;
    }

    // Fetch JSON (cache-bust)
    const url = "./projects.json?v=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`projects.json 讀取失敗：HTTP ${res.status} ${res.statusText}`);

    const data = await res.json();
    allProjects = Array.isArray(data) ? data : (data.projects || []);
    if (!Array.isArray(allProjects)) allProjects = [];

    if (countEl) countEl.textContent = `實驗清單（共 ${allProjects.length}）`;

    renderStatusFilters();
    renderDrawerFilters();   // ✅ must be after allProjects loaded
    renderProjects();
    document.body.classList.add("js-loaded");

    clearFatal();
  } catch (e) {
    console.error(e);
    //showFatal("⚠️ JS 載入失敗：" + (e?.message || String(e)));
  }
}

// ---------- Status Filters ----------
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

// ---------- Drawer Filters ----------
function renderDrawerFilters() {
  const dirEl = $("direction-filters");
  const techEl = $("tech-filters");
  if (!dirEl || !techEl) return;

  const allDirs = uniqSorted(allProjects.flatMap(getDirections));
  const allTech = uniqSorted(allProjects.flatMap(getTech));

  dirEl.innerHTML = allDirs.length
    ? allDirs.map((t) => {
        const active = selectedDirections.has(t) ? "active" : "";
        return `<button class="tag ${active}" data-dir="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
      }).join("")
    : `<div style="opacity:.6;font-size:14px;">（尚無實驗方向）</div>`;

  techEl.innerHTML = allTech.length
    ? allTech.map((t) => {
        const active = selectedTech.has(t) ? "active" : "";
        return `<button class="tag ${active}" data-tech="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
      }).join("")
    : `<div style="opacity:.6;font-size:14px;">（尚無技術標籤）</div>`;

  dirEl.querySelectorAll("[data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-dir");
      if (!v) return;
      if (selectedDirections.has(v)) selectedDirections.delete(v);
      else selectedDirections.add(v);
      renderDrawerFilters();
      renderProjects();
    });
  });

  techEl.querySelectorAll("[data-tech]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-tech");
      if (!v) return;
      if (selectedTech.has(v)) selectedTech.delete(v);
      else selectedTech.add(v);
      renderDrawerFilters();
      renderProjects();
    });
  });
}

// ---------- Projects ----------
function renderProjects() {
  const listEl = $("project-list");
  if (!listEl) return;

  let filtered = allProjects.slice();

  // OR 多選：狀態
  if (selectedStatuses.size > 0) {
    filtered = filtered.filter((p) => selectedStatuses.has(p.status));
  }

  // OR 多選：實驗方向
  if (selectedDirections.size > 0) {
    filtered = filtered.filter((p) => {
      const dirs = getDirections(p);
      return dirs.some((d) => selectedDirections.has(d));
    });
  }

  // OR 多選：技術
  if (selectedTech.size > 0) {
    filtered = filtered.filter((p) => {
      const techs = getTech(p);
      return techs.some((t) => selectedTech.has(t));
    });
  }

  // ✅ featured / pinned 置頂 + updatedAt 新到舊
  filtered.sort((a, b) => {
    const ap = (a.featured || a.pinned) ? 1 : 0;
    const bp = (b.featured || b.pinned) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });

  listEl.innerHTML = filtered.map(renderCard).join("");
  window.__updateBackToTop?.();
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

// start
setupDrawer();
setupBackToTop();
init();