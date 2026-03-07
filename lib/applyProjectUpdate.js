export function applyProjectUpdate({ projectId, fields }, projectsData) {
  if (!projectId) {
    throw new Error("projectId 必填");
  }

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("fields 必須是物件");
  }

  if (!projectsData || !Array.isArray(projectsData.projects)) {
    throw new Error("projectsData 格式錯誤，缺少 projects 陣列");
  }

  const today = getTodayInTaiwan();

  const allowedFields = [
    "name",
    "summary",
    "cover",
    "status",
    "output",
    "content",
    "category",
    "techTags",
    "timeline",
    "next",
    "gallery",
    "pin"
  ];

  const forbiddenFields = ["id", "updated"];

  const fieldKeys = Object.keys(fields);

  if (!fieldKeys.length) {
    throw new Error("沒有可更新的欄位");
  }

  for (const key of fieldKeys) {
    if (forbiddenFields.includes(key)) {
      throw new Error(`不可更新欄位: ${key}`);
    }

    if (!allowedFields.includes(key)) {
      throw new Error(`不支援欄位: ${key}`);
    }
  }

  let project = projectsData.projects.find((p) => p.id === projectId);

  // project 不存在：建立 skeleton
  if (!project) {
    project = {
      id: projectId,
      name: "",
      summary: "",
      cover: `./assets/${projectId}-cover.png`,
      status: "concept",
      updated: today,
      output: "開發中",
      content: [],
      category: [],
      techTags: [],
      timeline: [],
      next: [],
      gallery: [],
      pin: false
    };

    projectsData.projects.push(project);
  }

  for (const [key, value] of Object.entries(fields)) {
    if (key === "timeline") {
      applyTimelineUpdate(project, value, today);
      continue;
    }

    if (key === "content" || key === "category" || key === "techTags" || key === "next" || key === "gallery") {
      if (!Array.isArray(value)) {
        throw new Error(`${key} 必須是陣列`);
      }
      project[key] = value;
      continue;
    }

    project[key] = value;
  }

  project.updated = today;

  return projectsData;
}

function applyTimelineUpdate(project, value, today) {
  if (!Array.isArray(value)) {
    throw new Error("timeline 必須是陣列");
  }

  if (!Array.isArray(project.timeline)) {
    project.timeline = [];
  }

  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("timeline 項目格式錯誤");
    }

    if (!item.title || !String(item.title).trim()) {
      throw new Error("timeline.title 必填");
    }

    project.timeline.push({
      date: today,
      phase: item.phase || project.status || "concept",
      title: String(item.title).trim(),
      note: item.note ? String(item.note).trim() : ""
    });
  }
}

function getTodayInTaiwan() {
  const now = new Date();
  const taiwanNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );

  const year = taiwanNow.getFullYear();
  const month = String(taiwanNow.getMonth() + 1).padStart(2, "0");
  const day = String(taiwanNow.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}