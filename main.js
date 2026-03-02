let allProjects = [];
const filterState = { status: null, direction: new Set(), tech: new Set() };

fetch("./projects.json")
  .then(r => r.json())
  .then(data => {
    allProjects = data.projects || [];
    renderStatus();   // 1) 固定四個都顯示（含 0）
    renderTags();
    render();
    setupDrawer();
  });

/* ===== helpers ===== */
function statusLabel(status) {
  return ({
    validated: "🟢 已驗證",
    testing: "🟠 驗證中",
    concept: "🟡 構想",
    expanding: "🔵 延伸中"
  })[status] || status;
}

function statusOrder(status) {
  return ({ expanding: 4, testing: 3, validated: 2, concept: 1 })[status] || 0;
}

function sortProjects(arr) {
  arr.sort((a, b) => {
    // featured first
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;

    // updatedAt desc
    const au = a.updatedAt || "";
    const bu = b.updatedAt || "";
    if (au > bu) return -1;
    if (au < bu) return 1;

    // status priority desc
    return statusOrder(b.status) - statusOrder(a.status);
  });
}

function syncActiveUI() {
  // 狀態 active
  document.querySelectorAll('#status-filters button[data-status]').forEach(btn => {
    const s = btn.getAttribute("data-status");
    btn.classList.toggle("active", filterState.status === s);
  });

  // direction tag active
  document.querySelectorAll('#direction-filters button[data-dir]').forEach(btn => {
    const t = btn.getAttribute("data-dir");
    btn.classList.toggle("active", filterState.direction.has(t));
  });

  // tech tag active
  document.querySelectorAll('#tech-filters button[data-tech]').forEach(btn => {
    const t = btn.getAttribute("data-tech");
    btn.classList.toggle("active", filterState.tech.has(t));
  });
}

/* ===== status ===== */
function renderStatus() {
  const el = document.getElementById("status-filters");
  if (!el) return;

  const counts = { validated: 0, testing: 0, concept: 0, expanding: 0 };
  allProjects.forEach(p => {
    if (counts[p.status] != null) counts[p.status] += 1;
  });

  // 1) 固定四個都顯示，即便是 0
  // 3) 筆數前後加（）
  const items = [
    { key: "validated", text: `🟢 已驗證（${counts.validated}）` },
    { key: "testing",   text: `🟠 驗證中（${counts.testing}）` },
    { key: "concept",   text: `🟡 構想（${counts.concept}）` },
    { key: "expanding", text: `🔵 延伸中（${counts.expanding}）` }
  ];

  el.innerHTML = items
    .map(i => `<button data-status="${i.key}">${i.text}</button>`)
    .join("");

  el.querySelectorAll("button").forEach(b => {
    b.onclick = () => {
      const s = b.getAttribute("data-status");
      filterState.status = (filterState.status === s) ? null : s;

      render();         // 更新卡片
      syncActiveUI();   // 2) 狀態按鈕選中變色（跟 tag 一樣）
    };
  });

  syncActiveUI();
}

/* ===== tags in drawer ===== */
function renderTags() {
  const dirEl = document.getElementById("direction-filters");
  const techEl = document.getElementById("tech-filters");
  if (!dirEl || !techEl) return;

  const dirs = new Set(), techs = new Set();
  allProjects.forEach(p => {
    (p.directionTags || []).forEach(t => dirs.add(t));
    (p.techTags || []).forEach(t => techs.add(t));
  });

  dirEl.innerHTML = [...dirs].sort().map(t => `<button data-dir="${t}">${t}</button>`).join("");
  techEl.innerHTML = [...techs].sort().map(t => `<button data-tech="${t}">${t}</button>`).join("");

  dirEl.querySelectorAll("button").forEach(b => {
    b.onclick = () => {
      const t = b.getAttribute("data-dir");
      filterState.direction.has(t) ? filterState.direction.delete(t) : filterState.direction.add(t);
      render();
      syncActiveUI();
    };
  });

  techEl.querySelectorAll("button").forEach(b => {
    b.onclick = () => {
      const t = b.getAttribute("data-tech");
      filterState.tech.has(t) ? filterState.tech.delete(t) : filterState.tech.add(t);
      render();
      syncActiveUI();
    };
  });

  document.getElementById("clearFilters").onclick = () => {
    filterState.status = null;
    filterState.direction.clear();
    filterState.tech.clear();
    render();
    syncActiveUI();
  };

  syncActiveUI();
}

/* ===== render cards ===== */
function render() {
  sortProjects(allProjects);

  const list = document.getElementById("project-list");
  const title = document.getElementById("project-count");
  if (!list || !title) return;

  const filtered = allProjects.filter(p => {
    if (filterState.status && p.status !== filterState.status) return false;

    if (filterState.direction.size) {
      const tags = p.directionTags || [];
      for (const t of filterState.direction) if (!tags.includes(t)) return false;
    }

    if (filterState.tech.size) {
      const tags = p.techTags || [];
      for (const t of filterState.tech) if (!tags.includes(t)) return false;
    }

    return true;
  });

  title.textContent = "實驗清單";

  list.innerHTML = "";
  filtered.forEach(p => {
    // 4) 專案卡狀態：燈號 + 中文（不要英文）
    const statusText = statusLabel(p.status);
    const updated = (p.updatedAt || "").replace("-", ".");

    list.innerHTML += `
      <div class="project-card">
        <img src="${p.cover || ""}">
        <div class="content">
          <div class="meta">${statusText} ｜ 更新 ${updated}</div>
          <h3>${p.title || ""}</h3>
          <p>產出：${p.output || ""}</p>
          <p>${p.summary || ""}</p>
        </div>
      </div>
    `;
  });

  syncActiveUI();
}

/* ===== drawer open/close ===== */
function setupDrawer() {
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");
  const closeBtn = document.getElementById("closeBtn");
  if (!drawer || !overlay || !menuBtn || !closeBtn) return;

  menuBtn.onclick = () => {
    drawer.classList.add("open");
    overlay.classList.remove("hidden");
  };
  closeBtn.onclick = () => {
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
  };
  overlay.onclick = () => {
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
  };
}