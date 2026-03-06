// ===============================
// project.js - IRIS ｜ AI 協作開發實驗（Detail Page）
// Schema-aligned to FINAL projects.json:
// - name / summary / cover / status / updated / output / content
// - category / techTags / timeline[{date,phase,title,note}] / next / gallery / pin
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
  document.title = `${p?.name || "Project"} | IRIS ｜ AI 協作開發實驗`;
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
              ${lines.map(t => {
                const html = escapeHtml(t)
                  .replace(/\\\\n/g, "<br>")
                  .replace(/\n/g, "<br>");
                return `<p>${html}</p>`;
              }).join("")}
            </div>`
          : `<div class="muted">（尚未填寫內容）</div>`
      }
      ${renderOutputLine(p.output)}
    </section>
  `;
}

function renderTimeline(p) {
  // ✅ date 格式是 "YYYY.MM.DD"：字串排序即可（避免 Date 解析失敗）
  const items = asArray(p.timeline)
    .filter(it => it && typeof it === "object")
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    //.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))); // 新到舊

  return `
    <section class="detail-section">
      <h2 class="section-title">時間軸</h2>
      ${
        items.length
          ? `<div class="timeline2">
              ${items.map((it) => {
                const meta = statusMap[it.phase] || { dot: "⚪️", zh: "未分類" };
                return `
                  <div class="tl-item">
                    <div class="tl-left">
                      <div class="tl-dot" data-phase="${escapeHtml(it.phase || "")}" aria-label="${escapeHtml(meta.zh)}">${meta.dot}</div>
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
  const arr = asArray(p.next).map(String).filter(Boolean);

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
  // ✅ 支援：
  // 1) [{src,alt}, ...]
  // 2) ["./a.jpg", "./b.jpg"]
  const raw = Array.isArray(galleryItems) ? galleryItems : [];
  const items = raw
    .map((x) => {
      if (!x) return null;
      if (typeof x === "string") return { src: x, alt: "" };
      if (typeof x === "object" && x.src) return { src: x.src, alt: x.alt || "" };
      return null;
    })
    .filter(x => x && x.src);

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
          <img class="gallery-img"
               src="${escapeHtml(items[0].src)}"
               alt="${escapeHtml(items[0].alt || "")}">
        </div>
      </div>

      <button class="g-nav g-next" type="button" aria-label="下一張">›</button>
    </div>

    <div class="lightbox hidden" aria-hidden="true">
      <div class="lightbox-backdrop" data-close="1"></div>
      <div class="lightbox-panel" role="dialog" aria-modal="true">
        <button class="lb-close" type="button" aria-label="關閉">✕</button>

        <!-- 放大後不顯示箭頭，但仍保留鍵盤切換 -->
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

  function setNavVisibility(btn, show) {
    btn.style.opacity = show ? "1" : "0";
    btn.style.pointerEvents = show ? "auto" : "none";
  }

  function apply() {
    const it = items[index];
    img.src = it.src;
    img.alt = it.alt || "";

    if (items.length <= 1) {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      return;
    } else {
      prevBtn.style.display = "";
      nextBtn.style.display = "";
    }

    setNavVisibility(prevBtn, index > 0);
    setNavVisibility(nextBtn, index < items.length - 1);
  }

  function go(delta) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    index = next;
    apply();
    syncLightbox();
  }

  function openLightbox() {
    const it = items[index];
    lbImg.src = it.src;
    lbImg.alt = it.alt || "";

    lb.classList.remove("hidden");
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");

    syncLightbox();
  }

  function closeLightbox() {
    lb.classList.add("hidden");
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  function syncLightbox() {
    if (lb.classList.contains("hidden")) return;

    const it = items[index];
    lbImg.src = it.src;
    lbImg.alt = it.alt || "";

    // 你要求：放大後不顯示 < >
    lbPrev.style.display = "none";
    lbNext.style.display = "none";
  }

  // click nav
  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  // click image -> lightbox
  img.addEventListener("click", openLightbox);

  // close
  lbClose.addEventListener("click", closeLightbox);
  lbBackdrop.addEventListener("click", closeLightbox);

  // (lightbox arrows hidden, but keep handlers just in case)
  lbPrev.addEventListener("click", () => go(-1));
  lbNext.addEventListener("click", () => go(1));

  // keyboard: ← → , ESC closes lightbox
  function onKey(e) {
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
    if (e.key === "Escape") {
      if (!lb.classList.contains("hidden")) closeLightbox();
    }
  }
  document.addEventListener("keydown", onKey);

  // focus frame
  frame?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  });

  // ----- Lightbox swipe (mobile) -----
  let startX = 0;
  let startY = 0;

  function lbTouchStart(e) {
    if (lb.classList.contains("hidden")) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
  }

  function lbTouchEnd(e) {
    if (lb.classList.contains("hidden")) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (Math.abs(dx) < 40) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;

    if (dx < 0) go(1);
    else go(-1);
  }

  const lbPanel = container.querySelector(".lightbox-panel");
  if (lbPanel) {
    lbPanel.addEventListener("touchstart", lbTouchStart, { passive: true });
    lbPanel.addEventListener("touchend", lbTouchEnd, { passive: true });
  }

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

    // Header：專案標題 + 摘要
    const brand = document.querySelector(".brand");
    if (brand) {
      brand.innerHTML = `
        <h1 class="brand-title">${escapeHtml(p.name || "")}</h1>
        ${p.summary ? `<p class="brand-summary">${escapeHtml(p.summary)}</p>` : ""}
      `;
    }

    const coverHtml = p.cover
      ? `<img class="detail-cover" src="${escapeHtml(p.cover)}" alt="${escapeHtml(p.name || "")}" onerror="this.remove()">`
      : "";

    const meta = statusMap[p.status] || { dot: "⚪️", zh: "未分類" };

    const html = `
      <article class="detail-card">
        ${coverHtml}

        <section class="detail-section">
          <div class="detail-meta">
            <span class="dot">${meta.dot}</span>
            ${escapeHtml(meta.zh)} ｜ 更新 ${escapeHtml(p.updated || "")}
          </div>
        </section>

        ${renderContent(p)}

        ${renderTagRow("應用類型", p.category)}
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