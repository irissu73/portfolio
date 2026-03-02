document.addEventListener("DOMContentLoaded", () => {
  // ✅ 一進來就標記：JS 有跑（你的紅字就會消失）
  document.body.classList.add("js-loaded");

  let allProjects = [];
  const filterState = { status: null, direction: new Set(), tech: new Set() };

  fetch("./projects.json")
    .then(r => r.json())
    .then(data => {
      allProjects = data.projects || [];
      renderStatus();
      renderTags();
      render();
      setupDrawer();
      setupBackToTop();
    })
    .catch(err => {
      // 就算 JSON 壞掉，也至少讓你知道原因
      const list = document.getElementById("project-list");
      if (list) {
        list.innerHTML = `<div style="padding:14px;color:#b00020">⚠️ projects.json 讀取失敗：${String(err)}</div>`;
      }
      console.error(err);
    });

  function statusLabel(status) {
    return ({
      concept: "🟡 構想中",
      testing: "🟠 驗證中",
      validated: "🟢 已驗證",
      expanding: "🔵 延伸中",
    })[status] || status;
  }

  function renderStatus() {
    const el = document.getElementById("status-filters");
    if (!el) return;

    const counts = { concept: 0, testing: 0, validated: 0, expanding: 0 };
    allProjects.forEach(p => { if (counts[p.status] != null) counts[p.status]++; });

    // ✅ 固定順序：構想中 → 驗證中 → 已驗證 → 延伸中（即使 0 也顯示）
    const items = [
      { key: "concept",   text: `🟡 構想中（${counts.concept}）` },
      { key: "testing",   text: `🟠 驗證中（${counts.testing}）` },
      { key: "validated", text: `🟢 已驗證（${counts.validated}）` },
      { key: "expanding", text: `🔵 延伸中（${counts.expanding}）` },
    ];

    el.innerHTML = items.map(i => `<button data-status="${i.key}">${i.text}</button>`).join("");

    el.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const s = btn.getAttribute("data-status");
        filterState.status = (filterState.status === s) ? null : s;
        render();
        syncActiveUI();
      });
    });

    syncActiveUI();
  }

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

    dirEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-dir");
        filterState.direction.has(t) ? filterState.direction.delete(t) : filterState.direction.add(t);
        render(); syncActiveUI();
      });
    });

    techEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-tech");
        filterState.tech.has(t) ? filterState.tech.delete(t) : filterState.tech.add(t);
        render(); syncActiveUI();
      });
    });

    const clearBtn = document.getElementById("clearFilters");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        filterState.status = null;
        filterState.direction.clear();
        filterState.tech.clear();
        render(); syncActiveUI();
      });
    }

    syncActiveUI();
  }

  function syncActiveUI() {
    document.querySelectorAll('#status-filters button[data-status]').forEach(btn => {
      const s = btn.getAttribute("data-status");
      btn.classList.toggle("active", filterState.status === s);
    });
    document.querySelectorAll('#direction-filters button[data-dir]').forEach(btn => {
      const t = btn.getAttribute("data-dir");
      btn.classList.toggle("active", filterState.direction.has(t));
    });
    document.querySelectorAll('#tech-filters button[data-tech]').forEach(btn => {
      const t = btn.getAttribute("data-tech");
      btn.classList.toggle("active", filterState.tech.has(t));
    });
  }

  function render() {
    const list = document.getElementById("project-list");
    const title = document.getElementById("project-count");
    if (!list || !title) return;

    const filtered = allProjects.filter(p => {
      if (filterState.status && p.status !== filterState.status) return false;
      for (const t of filterState.direction) if (!(p.directionTags || []).includes(t)) return false;
      for (const t of filterState.tech) if (!(p.techTags || []).includes(t)) return false;
      return true;
    });

    title.textContent = "實驗狀態";

    list.innerHTML = "";
    filtered.forEach(p => {
      const statusText = statusLabel(p.status);
      const updated = (p.updatedAt || "").replace("-", ".");
      const coverHtml = p.cover
  ? `<img class="card-cover" src="${p.cover}" onerror="this.remove()">`
  : "";

const detailHtml = p.detailUrl
  ? `<a class="detail-link" href="${p.detailUrl}">查看完整內容 →</a>`
  : "";

list.innerHTML += `
  <div class="project-card">
    <div class="content">
      <div class="meta">${statusText} ｜ 更新 ${updated}</div>
      <h3>${p.title || ""}</h3>
      <p>產出：${p.output || ""}</p>
      <p>${p.summary || ""}</p>
      ${detailHtml}
    </div>
    ${coverHtml}
  </div>
`;
    });

    syncActiveUI();
  }

  function setupDrawer() {
    const drawer = document.getElementById("drawer");
    const overlay = document.getElementById("overlay");
    const menuBtn = document.getElementById("menuBtn");
    const closeBtn = document.getElementById("closeBtn");
    if (!drawer || !overlay || !menuBtn || !closeBtn) return;

    const open = () => { drawer.classList.add("open"); overlay.classList.remove("hidden"); };
    const close = () => { drawer.classList.remove("open"); overlay.classList.add("hidden"); };

    menuBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", close);
  }

  function setupBackToTop() {
    const btn = document.getElementById("backToTop");
    if (!btn) return;

    window.addEventListener("scroll", () => {
      btn.classList.toggle("show", window.scrollY > 300);
    });

    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});