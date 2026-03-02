fetch("./projects.json")
  .then(res => res.json())
  .then(data => {
    let projects = data.projects;

    // ===== 排序 =====
    const statusPriority = {
      expanding: 4,
      testing: 3,
      validated: 2,
      concept: 1
    };

    projects.sort((a, b) => {
      // 1. featured
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;

      // 2. updatedAt
      if (a.updatedAt > b.updatedAt) return -1;
      if (a.updatedAt < b.updatedAt) return 1;

      // 3. status priority
      return statusPriority[b.status] - statusPriority[a.status];
    });

    renderProjects(projects);
    renderCounts(projects);
    renderTags(projects);
  });

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