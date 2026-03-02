let allProjects = [];

const filterState = {
  status: null,              // 單選（主頁狀態）
  directionTags: new Set(),  // 多選（Drawer）
  techTags: new Set()        // 多選（Drawer）
};

const statusPriority = { expanding:4, testing:3, validated:2, concept:1 };

fetch("./projects.json")
  .then(res => res.json())
  .then(data => {
    allProjects = (data.projects || []).slice();
    sortProjects(allProjects);

    renderStatusFilters(allProjects);
    renderTagFilters(allProjects);
    refreshUI();

    setupDrawer();
    setupClear();
  })
  .catch(err => {
    console.error(err);
    const el = document.getElementById("project-count");
    if (el) el.textContent = "讀取 projects.json 失敗";
  });

function sortProjects(arr){
  arr.sort((a,b)=>{
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;

    if ((a.updatedAt||"") > (b.updatedAt||"")) return -1;
    if ((a.updatedAt||"") < (b.updatedAt||"")) return 1;

    return (statusPriority[b.status]||0) - (statusPriority[a.status]||0);
  });
}

function refreshUI(){
  const shown = allProjects.filter(p => {
    if (filterState.status && p.status !== filterState.status) return false;

    if (filterState.directionTags.size){
      const set = new Set(p.directionTags || []);
      for (const t of filterState.directionTags) if (!set.has(t)) return false;
    }
    if (filterState.techTags.size){
      const set = new Set(p.techTags || []);
      for (const t of filterState.techTags) if (!set.has(t)) return false;
    }
    return true;
  });

  renderCounts(allProjects.length, shown.length);
  renderProjects(shown);
  syncActiveButtons();
}

function renderCounts(total, shown){
  const el = document.getElementById("project-count");
  if (!el) return;
  el.textContent = `Projects（共 ${total}）${shown === total ? "" : ` · 篩選後 ${shown}`}`;
}

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
  ].filter(i => counts[i.key] > 0);

  el.innerHTML = items.map(i => `<button data-status="${i.key}">${i.label}</button>`).join("");

  el.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const s = btn.getAttribute("data-status");
      filterState.status = (filterState.status === s) ? null : s;
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
  projects.forEach(p=>{
    (p.directionTags||[]).forEach(t=>dirSet.add(t));
    (p.techTags||[]).forEach(t=>techSet.add(t));
  });

  dirEl.innerHTML = [...dirSet].sort().map(t=>`<button data-dir="${t}">${t}</button>`).join("");
  techEl.innerHTML = [...techSet].sort().map(t=>`<button data-tech="${t}">${t}</button>`).join("");

  dirEl.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const t = btn.getAttribute("data-dir");
      filterState.directionTags.has(t) ? filterState.directionTags.delete(t) : filterState.directionTags.add(t);
      refreshUI();
    });
  });

  techEl.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
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
      <img src="${p.cover || ""}" alt="${escapeHtml(p.title || "")}">
      <div class="content">
        <div class="meta">${formatStatus(p.status)} ｜ 更新 ${formatDate(p.updatedAt)}</div>
        <h3>${escapeHtml(p.title || "")}</h3>
        <p>產出：${escapeHtml(p.output || "")}</p>
        <p>${escapeHtml(p.summary || "")}</p>
        <div class="tags">
          ${(p.directionTags||[]).slice(0,2).map(t=>`<span>${escapeHtml(t)}</span>`).join("")}
          ${(p.techTags||[]).slice(0,2).map(t=>`<span>${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function setupDrawer(){
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");
  const closeBtn = document.getElementById("closeBtn");
  if (!drawer || !overlay || !menuBtn || !closeBtn) return;

  const open = () => {
    drawer.classList.add("open");
    overlay.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  menuBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
}

function setupClear(){
  const btn = document.getElementById("clearFilters");
  if (!btn) return;
  btn.addEventListener("click", ()=>{
    filterState.status = null;
    filterState.directionTags.clear();
    filterState.techTags.clear();
    refreshUI();
  });
}

function formatStatus(status){
  return ({ concept:"🟡 構想", testing:"🟠 驗證中", validated:"🟢 已驗證", expanding:"🔵 延伸中" })[status] || status;
}
function formatDate(s){ return (s||"").replace("-", "."); }

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[m]));
}