// ===============================
// IRIS ｜ AI 實驗場 - project.js
// Detail page: project.html?id=xxx
// ===============================

const statusMap = {
  concept:   { dot: "🟡", zh: "構想中" },
  testing:   { dot: "🟠", zh: "驗證中" },
  validated: { dot: "🟢", zh: "已驗證" },
  expanding: { dot: "🔵", zh: "延伸中" },
};

function $(id){ return document.getElementById(id); }

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asArray(v){
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// 允許不同欄位命名
function getDirections(p){
  return asArray(p.directionTags ?? p.direction ?? p.directions).map(String).filter(Boolean);
}
function getTech(p){
  return asArray(p.techTags ?? p.tech ?? p.techs).map(String).filter(Boolean);
}

function getIdFromQuery(){
  const url = new URL(location.href);
  return url.searchParams.get("id") || "";
}

function formatTitle(p){
  const t = p?.title ? String(p.title) : "Project";
  document.title = `${t} | IRIS ｜ AI 實驗場`;
}

function renderTagChips(tags){
  if (!tags || tags.length === 0) return `<div class="muted">（無）</div>`;
  return `<div class="chip-row">${tags.map(t => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>`;
}

function renderOutputPill(output){
  if (!output) return "";
  return `
    <div class="output-line">
      產出：<strong class="pill">${escapeHtml(output)}</strong>
    </div>
  `;
}

function renderTimeline(p){
  const timeline = asArray(p.timeline);
  if (!timeline.length) return `<div class="muted">（之後再補時間軸也可以）</div>`;

  return `
    <div class="timeline">
      ${timeline.map(item => {
        const date = escapeHtml(item.date || "");
        const title = escapeHtml(item.title || "");
        const note = escapeHtml(item.note || "");
        return `
          <div class="timeline-item">
            <div class="timeline-date">${date}</div>
            <div class="timeline-body">
              <div class="timeline-title">${title}</div>
              ${note ? `<div class="timeline-note">${note}</div>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function showFatal(msg){
  const host = $("detail") || document.body;
  host.innerHTML = `
    <div class="detail-card">
      <div class="detail-section">
        <div class="fatal">${escapeHtml(msg)}</div>
        <div style="margin-top:12px;">
          <a class="detail-link" href="./index.html">回首頁 →</a>
        </div>
      </div>
    </div>
  `;
}

function setupBackToTop(){
  const btn = $("backToTop");
  if (!btn) return;

  function refresh(){
    const canScroll = document.documentElement.scrollHeight > window.innerHeight + 10;
    if (!canScroll) {
      btn.classList.add("show");
      return;
    }
    if (window.scrollY > 50) btn.classList.add("show");
    else btn.classList.remove("show");
  }

  window.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh);

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  refresh();
}

async function init(){
  try{
    setupBackToTop();

    const id = getIdFromQuery();
    if (!id) {
      showFatal("缺少 id，網址要長這樣：project.html?id=xxx");
      return;
    }

    const res = await fetch("./projects.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`projects.json 讀取失敗：HTTP ${res.status}`);

    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.projects || []);
    const p = list.find(x => String(x.id) === String(id));

    if (!p) {
      showFatal(`找不到專案：${id}`);
      return;
    }

    formatTitle(p);

    const meta = statusMap[p.status] || { dot: "⚪️", zh: "未分類" };
    const cover = p.cover ? String(p.cover) : "";
    const coverHtml = cover ? `
      <img class="detail-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(p.title || "")}" onerror="this.remove()">
    ` : "";

    const description = p.description
      ? String(p.description).split("\n").map(line => `<p>${escapeHtml(line)}</p>`).join("")
      : `<p class="muted">（把完整內容放在 projects.json 的 description 欄位，支援換行。）</p>`;

    $("detail").innerHTML = `
      <article class="detail-card">
        ${coverHtml}

        <section class="detail-section">
          <div class="detail-meta">
            <span class="dot">${meta.dot}</span>
            <span>${meta.zh}</span>
            <span class="sep">｜</span>
            <span class="muted">更新 ${escapeHtml(p.updatedAt || "")}</span>
          </div>

          <h2 class="detail-title">${escapeHtml(p.title || "")}</h2>
          ${p.summary ? `<div class="detail-summary">${escapeHtml(p.summary)}</div>` : ""}

          ${renderOutputPill(p.output)}
        </section>

        <section class="detail-section">
          <h3 class="detail-h">專案內容</h3>
          <div class="detail-rich">${description}</div>
        </section>

        <section class="detail-section">
          <h3 class="detail-h">實驗方向</h3>
          ${renderTagChips(getDirections(p))}
        </section>

        <section class="detail-section">
          <h3 class="detail-h">技術</h3>
          ${renderTagChips(getTech(p))}
        </section>

        <section class="detail-section">
          <h3 class="detail-h">時間軸</h3>
          ${renderTimeline(p)}
        </section>

        <section class="detail-section detail-actions">
          ${p.url ? `<a class="detail-link primary" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">前往作品 →</a>` : ""}
          <a class="detail-link" href="./index.html">回首頁 →</a>
        </section>
      </article>
    `;

  }catch(e){
    console.error(e);
    showFatal("載入失敗：請確認 projects.json 路徑/格式，或此專案 id 是否存在。");
  }
}

init();