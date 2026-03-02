let allProjects = [];
let filteredProjects = [];

const filterState = {
  status: null,               // 單選
  directionTags: new Set(),   // 多選
  techTags: new Set()         // 多選
};

fetch("./projects.json")
  .then(res => res.json())
  .then(data => {
    allProjects = data.projects || [];

    applySort(allProjects);
    renderCounts(allProjects);
    renderStatusFilters(allProjects);
    renderTagFilters(allProjects);

    filteredProjects = allProjects.slice();
    renderProjects(filteredProjects);

    const clearBtn = document.getElementById("clearFilters");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      filterState.status = null;
      filterState.directionTags.clear();
      filterState.techTags.clear();
      refreshUI();
    });
  });

function applySort(projects){
  const statusPriority = { expanding:4, testing:3, validated:2, concept:1 };
  projects.sort((a,b)=>{
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    if ((a.updatedAt||"") > (b.updatedAt||"")) return -1;
    if ((a.updatedAt||"") < (b.updatedAt||"")) return 1;
    return (statusPriority[b.status]||0) - (statusPriority[a.status]||0);
  });
}

function refreshUI(){
  // 依條件篩選
  filteredProjects = allProjects.filter(p => {
    if (filterState.status && p.status !== filterState.status) return false;

    if (filterState.directionTags.size > 0) {
      const tags = new Set(p.directionTags || []);
      for (const t of filterState.directionTags) if (!tags.has(t)) return false;
    }

    if (filterState.techTags.size > 0) {
      const tags = new Set(p.techTags || []);
      for (const t of filterState.techTags) if (!tags.has(t)) return false;
    }

    return true;
  });

  renderCounts(filteredProjects, allProjects.length);
  renderProjects(filteredProjects);
  syncActiveButtons();
}

function renderCounts(projectsShown, total){
  const totalCount = typeof total === "number" ? total : projectsShown.length;
  const el = document.getElementById("project-count");
  if (el) el.innerText = `Projects（共 ${totalCount}）`;
}

function renderProjects(projects) {
  const container = document.getElementById("project-list");
  container.innerHTML = "";

  projects.forEach(p => {
    const card = document.createElement("div");
    card.className = "project-card";

    card.innerHTML = `
      <img src="${p.cover}" alt="${p.title}" />
      <div class="meta">
        ${formatStatus(p.status)} ｜ 更新 ${formatDate(p.updatedAt)}
      </div>
      <h3>${p.title}</h3>
      <p>產出：${p.output}</p>
      <p>${p.summary}</p>
      <div class="tags">
        ${p.directionTags.map(tag => `<span>${tag}</span>`).join("")}
        ${p.techTags.map(tag => `<span>${tag}</span>`).join("")}
      </div>
    `;

    container.appendChild(card);
  });
}

function formatStatus(status) {
  const map = {
    concept: "🟡 構想",
    testing: "🟠 驗證中",
    validated: "🟢 已驗證",
    expanding: "🔵 延伸中"
  };
  return map[status];
}

function formatDate(date) {
  return date.replace("-", ".");
}

function renderCounts(projects) {
  document.getElementById("project-count").innerText =
    `Projects（共 ${projects.length}）`;
}

function renderTags(projects) {
  const directionSet = new Set();
  const techSet = new Set();

  projects.forEach(p => {
    p.directionTags.forEach(tag => directionSet.add(tag));
    p.techTags.forEach(tag => techSet.add(tag));
  });

  document.getElementById("direction-filters").innerHTML =
    [...directionSet].map(tag => `<button>${tag}</button>`).join("");

  document.getElementById("tech-filters").innerHTML =
    [...techSet].map(tag => `<button>${tag}</button>`).join("");
}

// ===== Sidebar collapse =====
(function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarToggle");
  if (!sidebar || !toggleBtn) return;

  const saved = localStorage.getItem("sidebarCollapsed");
  if (saved === "1") sidebar.classList.add("collapsed");

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    localStorage.setItem("sidebarCollapsed", sidebar.classList.contains("collapsed") ? "1" : "0");
    toggleBtn.textContent = sidebar.classList.contains("collapsed") ? "⟩" : "⟨";
  });

  // 初始化箭頭
  toggleBtn.textContent = sidebar.classList.contains("collapsed") ? "⟩" : "⟨";
})();

// ===== Drawer open/close =====
(function setupDrawer(){
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");
  const closeBtn = document.getElementById("closeBtn");

  if (!drawer || !overlay || !menuBtn || !closeBtn) return;

  const open = () => {
    drawer.classList.add("open");
    overlay.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
  };

  menuBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
})();

function renderStatusFilters(projects){
  const el = document.getElementById("status-filters");
  if (!el) return;

  const counts = { concept:0, testing:0, validated:0, expanding:0 };
  projects.forEach(p => { if (counts[p.status] != null) counts[p.status]++; });

  const items = [
    {key:"validated", label:`🟢 已驗證 ${counts.validated}`},
    {key:"testing", label:`🟠 驗證中 ${counts.testing}`},
    {key:"concept", label:`🟡 構想 ${counts.concept}`},
    {key:"expanding", label:`🔵 延伸中 ${counts.expanding}`}
  ];

  el.innerHTML = items
    .filter(i => counts[i.key] > 0) // 只顯示有用到的
    .map(i => `<button data-status="${i.key}">${i.label}</button>`)
    .join("");

  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = btn.getAttribute("data-status");
      filterState.status = (filterState.status === s) ? null : s; // 再點一次取消
      refreshUI();
    });
  });
}

function renderTagFilters(projects){
  const dirEl = document.getElementById("direction-filters");
  const techEl = document.getElementById("tech-filters");
  if (!dirEl || !techEl) return;

  const dirSet = new Set();
  const techSet = new Set();
  projects.forEach(p => {
    (p.directionTags||[]).forEach(t => dirSet.add(t));
    (p.techTags||[]).forEach(t => techSet.add(t));
  });

  dirEl.innerHTML = [...dirSet].sort().map(t => `<button data-dir="${t}">${t}</button>`).join("");
  techEl.innerHTML = [...techSet].sort().map(t => `<button data-tech="${t}">${t}</button>`).join("");

  dirEl.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-dir");
      filterState.directionTags.has(t) ? filterState.directionTags.delete(t) : filterState.directionTags.add(t);
      refreshUI();
    });
  });

  techEl.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-tech");
      filterState.techTags.has(t) ? filterState.techTags.delete(t) : filterState.techTags.add(t);
      refreshUI();
    });
  });
}

function syncActiveButtons(){
  document.querySelectorAll("[data-status]").forEach(b=>{
    b.classList.toggle("active", b.getAttribute("data-status") === filterState.status);
  });
  document.querySelectorAll("[data-dir]").forEach(b=>{
    b.classList.toggle("active", filterState.directionTags.has(b.getAttribute("data-dir")));
  });
  document.querySelectorAll("[data-tech]").forEach(b=>{
    b.classList.toggle("active", filterState.techTags.has(b.getAttribute("data-tech")));
  });
}

function renderProjects(projects){
  const container = document.getElementById("project-list");
  if (!container) return;
  container.innerHTML = "";

  projects.forEach(p=>{
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      <img src="${p.cover}" alt="${p.title}">
      <div class="content">
        <div class="meta">${formatStatus(p.status)} ｜ 更新 ${formatDate(p.updatedAt)}</div>
        <h3>${p.title}</h3>
        <p>產出：${p.output}</p>
        <p>${p.summary || ""}</p>
        <div class="tags">
          ${(p.directionTags||[]).slice(0,2).map(t=>`<span>${t}</span>`).join("")}
          ${(p.techTags||[]).slice(0,2).map(t=>`<span>${t}</span>`).join("")}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function formatStatus(status){
  return ({
    concept:"🟡 構想",
    testing:"🟠 驗證中",
    validated:"🟢 已驗證",
    expanding:"🔵 延伸中"
  })[status] || status;
}
function formatDate(s){ return (s||"").replace("-", "."); }
