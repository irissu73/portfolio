let allProjects = [];
const filterState = { status:null, direction:new Set(), tech:new Set() };

fetch("./projects.json")
  .then(r=>r.json())
  .then(data=>{
    allProjects = data.projects || [];
    renderStatus();
    renderTags();
    render();
    setupDrawer();
  });

function renderStatus(){
  const el=document.getElementById("status-filters");
  const counts={concept:0,testing:0,validated:0,expanding:0};
  allProjects.forEach(p=>counts[p.status]++);
  el.innerHTML=`
    <button data="validated">🟢 已驗證 ${counts.validated||0}</button>
    <button data="testing">🟠 驗證中 ${counts.testing||0}</button>
    <button data="concept">🟡 構想 ${counts.concept||0}</button>
    <button data="expanding">🔵 延伸中 ${counts.expanding||0}</button>
  `;
  el.querySelectorAll("button").forEach(b=>{
    b.onclick=()=>{
      filterState.status = filterState.status===b.getAttribute("data")?null:b.getAttribute("data");
      render();
    };
  });
}

function renderTags(){
  const dirEl=document.getElementById("direction-filters");
  const techEl=document.getElementById("tech-filters");
  const dirs=new Set(),techs=new Set();
  allProjects.forEach(p=>{
    (p.directionTags||[]).forEach(t=>dirs.add(t));
    (p.techTags||[]).forEach(t=>techs.add(t));
  });

  dirEl.innerHTML=[...dirs].map(t=>`<button>${t}</button>`).join("");
  techEl.innerHTML=[...techs].map(t=>`<button>${t}</button>`).join("");

  dirEl.querySelectorAll("button").forEach(b=>{
    b.onclick=()=>{filterState.direction.has(b.textContent)?filterState.direction.delete(b.textContent):filterState.direction.add(b.textContent);render();};
  });
  techEl.querySelectorAll("button").forEach(b=>{
    b.onclick=()=>{filterState.tech.has(b.textContent)?filterState.tech.delete(b.textContent):filterState.tech.add(b.textContent);render();};
  });

  document.getElementById("clearFilters").onclick=()=>{
    filterState.status=null;
    filterState.direction.clear();
    filterState.tech.clear();
    render();
  };
}

function render(){
  const list=document.getElementById("project-list");
  const title=document.getElementById("project-count");
  const filtered=allProjects.filter(p=>{
    if(filterState.status && p.status!==filterState.status)return false;
    if(filterState.direction.size && ![...filterState.direction].every(t=>(p.directionTags||[]).includes(t)))return false;
    if(filterState.tech.size && ![...filterState.tech].every(t=>(p.techTags||[]).includes(t)))return false;
    return true;
  });

  title.textContent="實驗清單";
  list.innerHTML="";
  filtered.forEach(p=>{
    list.innerHTML+=`
      <div class="project-card">
        <img src="${p.cover||""}">
        <div class="content">
          <div class="meta">${p.status||""} ｜ 更新 ${p.updatedAt||""}</div>
          <h3>${p.title||""}</h3>
          <p>產出：${p.output||""}</p>
          <p>${p.summary||""}</p>
        </div>
      </div>
    `;
  });
}

function setupDrawer(){
  const drawer=document.getElementById("drawer");
  const overlay=document.getElementById("overlay");
  document.getElementById("menuBtn").onclick=()=>{
    drawer.classList.add("open");
    overlay.classList.remove("hidden");
  };
  document.getElementById("closeBtn").onclick=()=>{
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
  };
  overlay.onclick=()=>{
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
  };
}