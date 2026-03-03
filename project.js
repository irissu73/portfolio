// ===============================
// project.js - IRIS ｜ AI 實驗場（Detail Page）
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

function getQueryParam(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function showFatal(msg) {
  const host = $("detail") || document.body;
  host.innerHTML = `
    <div class="fatal">
      ${escapeHtml(msg)}
    </div>
  `;
}

function formatTitle(p) {
  document.title = `${p?.title || "Project"} | IRIS ｜ AI 實驗場`;
}

function renderTagRow(title, tags) {
  const arr = asArray(tags).map(String).filter(Boolean);
  return `
    <section class="detail-section">
      <h2 class="section-title">${escapeHtml(title)}</h2>
      ${
        arr.length
          ? `<div class="tag-row">${arr.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}</div>`
          : `<div class="muted">（尚無）</div>`
      }
    </section>
  `;
}

function renderOutputLine(output) {
  if (!output) return "";
  // 點紫色標籤 => 跳到成果畫面（最後區塊）
  return `
    <div class="output-line">
      產出： <a class="output-pill" href="#gallery">${escapeHtml(output)}</a>
    </div>
  `;
}

function renderContent(p) {
  const lines = asArray(p.content).map(String).filter(Boolean);

  return `
    <section class="detail-section">
      <h2 class="section-title">專案內容</h2>
      ${
        lines.length
          ? `<div class="content-text">
              ${lines.map(t => `<p>${escapeHtml(t)}</p>`).join("")}
            </div>`
          : `<div class="muted">（尚未填寫內容）</div>`
      }
      ${renderOutputLine(p.output)}
    </section>
  `;
}

function renderTimeline(p) {
  const items = asArray(p.timeline);

  return `
    <section class="detail-section">
      <h2 class="section-title">時間軸</h2>
      ${
        items.length
          ? `<div class="timeline2">
              ${items.map((it) => {
                const meta = statusMap[it.status] || { dot: "⚪️", zh: "未分類" };
                return `
                  <div class="tl-item">
                    <div class="tl-left">
                      <div class="tl-dot" data-status="${escapeHtml(it.status || "")}" aria-label="${escapeHtml(meta.zh)}">${meta.dot}</div>
                      <div class="tl-line"></div>
                    </div>
                    <div class="tl-right">
                      <div class="tl-date">${escapeHtml(it.date || "")}</div>
                      ${it.title ? `<div class="tl-title">${escapeHtml(it.title)}</div>` : ""}
                      ${it.note ? `<div class="tl-note">${escapeHtml(it.note)}</div>` : ""}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>`
          : `<div class="muted">（尚無時間軸）</div>`
      }
    </section>
  `;
}

function renderNextSteps(p) {
  const arr = asArray(p.nextSteps).map(String).filter(Boolean);

  return `
    <section class="detail-section">
      <h2 class="section-title">下一步</h2>
      ${
        arr.length
          ? `<ul class="next-list">
              ${arr.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
            </ul>`
          : `<div class="muted">（暫無）</div>`
      }
    </section>
  `;
}

// ---------- Gallery (App Store style) ----------
function setupGallery(container, galleryItems) {
  const items = asArray(galleryItems).filter(x => x && x.src);

  if (!items.length) {
    container.innerHTML = `<div class="muted">（尚未提供成果畫面）</div>`;
    return;
  }

  let index = 0;

  const html = `
    <div class="gallery-shell">
      <button class="g-nav g-prev" type="button" aria-label="上一張">‹</button>

      <div class="gallery-frame" tabindex="0" aria-label="成果畫面輪播">
        <div class="gallery-viewport">
          <img class="gallery-img" src="${escapeHtml(items[0].src)}" alt="${escapeHtml(items[0].alt || "")}">
        </div>
      </div>

      <button class="g-nav g-next" type="button" aria-label="下一張">›</button>
    </div>

    <div class="gallery-hint muted">可左右切換，點擊放大</div>

    <div class="lightbox hidden" aria-hidden="true">
      <div class="lightbox-backdrop" data-close="1"></div>
      <div class="lightbox-panel" role="dialog" aria-modal="true">
        <button class="lb-close" type="button" aria-label="關閉">✕</button>
        <button class="lb-nav lb-prev" type="button" aria-label="上一張">‹</button>
        <img class="lb-img" src="" alt="">
        <button class="lb-nav lb-next" type="button" aria-label="下一張">›</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const frame = container.querySelector(".gallery-frame");
  const img = container.querySelector(".gallery-img");
  const prevBtn = container.querySelector(".g-prev");
  const nextBtn = container.querySelector(".g-next");

  const lb = container.querySelector(".lightbox");
  const lbImg = container.querySelector(".lb-img");
  const lbClose = container.querySelector(".lb-close");
  const lbPrev = container.querySelector(".lb-prev");
  const lbNext = container.querySelector(".lb-next");
  const lbBackdrop = container.querySelector(".lightbox-backdrop");

  function apply() {
    const it = items[index];
    img.src = it.src;
    img.alt = it.alt || "";

    // 常駐箭頭，但在邊界要「不顯示」且不影響圖片位置
    const hasPrev = index > 0;
    const hasNext = index < items.length - 1;

    prevBtn.style.opacity = hasPrev ? "1" : "0";
    prevBtn.style.pointerEvents = hasPrev ? "auto" : "none";

    nextBtn.style.opacity = hasNext ? "1" : "0";
    nextBtn.style.pointerEvents = hasNext ? "auto" : "none";
  }

  function go(delta) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    index = next;
    apply();
  }

  function openLightbox() {
    const it = items[index];
    lbImg.src = it.src;
    lbImg.alt = it.alt || "";
    lb.classList.remove("hidden");
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    syncLightboxNav();
  }

  function closeLightbox() {
    lb.classList.add("hidden");
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  function syncLightboxNav() {
    const hasPrev = index > 0;
    const hasNext = index < items.length - 1;

    lbPrev.style.opacity = hasPrev ? "1" : "0";
    lbPrev.style.pointerEvents = hasPrev ? "auto" : "none";

    lbNext.style.opacity = hasNext ? "1" : "0";
    lbNext.style.pointerEvents = hasNext ? "auto" : "none";
  }

  function lbGo(delta) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    index = next;
    const it = items[index];
    lbImg.src = it.src;
    lbImg.alt = it.alt || "";
    apply();
    syncLightboxNav();
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  img.addEventListener("click", openLightbox);

  lbClose.addEventListener("click", closeLightbox);
  lbBackdrop.addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", () => lbGo(-1));
  lbNext.addEventListener("click", () => lbGo(1));

  // 鍵盤支援：← →
  function onKey(e) {
    if (e.key === "ArrowLeft") {
      if (!lb.classList.contains("hidden")) lbGo(-1);
      else go(-1);
    }
    if (e.key === "ArrowRight") {
      if (!lb.classList.contains("hidden")) lbGo(1);
      else go(1);
    }
    if (e.key === "Escape") {
      if (!lb.classList.contains("hidden")) closeLightbox();
    }
  }

  // 在 frame focus 或 lightbox 開啟時可用（簡化：直接掛 document）
  document.addEventListener("keydown", onKey);

  // 初始
  apply();
}

function setupBackToTop() {
  const btn = $("backToTop");
  if (!btn) return;

  function refresh() {
    const canScroll = document.documentElement.scrollHeight > window.innerHeight + 10;
    if (!canScroll) {
      btn.classList.add("show");
      return;
    }
    if (window.scrollY > 80) btn.classList.add("show");
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

async function init() {
  // 保險：避免被錯誤載到首頁
  if (!$("detail")) return;

  const id = getQueryParam("id");
  if (!id) {
    showFatal("缺少 id，網址要長這樣：project.html?id=xxx");
    return;
  }

  try {
    const res = await fetch("./projects.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`projects.json 讀取失敗：HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();

    const list = Array.isArray(data) ? data : (data.projects || []);
    const p = list.find(x => String(x.id) === String(id));

    if (!p) {
      showFatal(`找不到專案：${id}`);
      return;
    }

    formatTitle(p);

    // ✅ Header：專案標題 + 摘要 + 狀態/更新（你剛定案）
    const meta = statusMap[p.status] || { dot: "⚪️", zh: "未分類" };
    const brand = document.querySelector(".brand");
    if (brand) {
      brand.innerHTML = `
  <h1 class="brand-title">${escapeHtml(p.title || "")}</h1>
  ${p.summary ? `<p class="brand-summary">${escapeHtml(p.summary)}</p>` : ""}
`;
    }

    const coverHtml = p.cover
      ? `<img class="detail-cover" src="${escapeHtml(p.cover)}" alt="${escapeHtml(p.title || "")}" onerror="this.remove()">`
      : "";

    const html = `
      <article class="detail-card">
        ${coverHtml}

        ${renderContent(p)}

        ${renderTagRow("實驗方向", p.directionTags)}
        ${renderTagRow("技術", p.techTags)}

        ${renderTimeline(p)}
        ${renderNextSteps(p)}

        <section class="detail-section" id="gallery">
          <h2 class="section-title">成果畫面</h2>
          <div class="gallery-host"></div>
        </section>
      </article>
    `;

    $("detail").innerHTML = html;

    // 成果畫面：最後區塊（App Store style + 箭頭 + 鍵盤 + 放大）
    const galleryHost = document.querySelector("#gallery .gallery-host");
    if (galleryHost) setupGallery(galleryHost, p.gallery);

  } catch (e) {
    console.error(e);
    showFatal("載入失敗，請檢查 projects.json / 路徑 / 格式");
  }
}

// start
setupBackToTop();
init();