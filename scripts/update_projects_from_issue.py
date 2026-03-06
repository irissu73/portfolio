import json
import os
import requests
from datetime import datetime, timezone

OPENAI_API_KEY = (os.environ.get("OPENAI_API_KEY") or "").strip()
ISSUE_TITLE = (os.environ.get("ISSUE_TITLE") or "").strip()
ISSUE_BODY = (os.environ.get("ISSUE_BODY") or "").strip()

if not OPENAI_API_KEY:
    raise SystemExit("Missing OPENAI_API_KEY (GitHub Secret).")

PROJECTS_PATH = "projects.json"

# ====== 定案規則 ======
# Schema（定案）
# id (KEY，不可修改)
# name(必填/標記)、summary(選填/標記)、cover(選填/標記)
# status(AI), updated(AI), output(AI), content(AI)
# category(選填多值/AI), techTags(選填多值/AI),
# timeline(選填多值/AI；子欄位：date/phase/title/note),
# next(選填多值/AI), gallery(選填多值/AI)
# pin(AI)，但：只有寫「置頂/取消置頂」才判斷/改動
# 規則：標記內容優先（強制更新）；否則 AI 自動判斷要不要改；updated 用本次 workflow 日期

UPDATE_START = "=== UPDATE START ==="
UPDATE_END = "=== UPDATE END ==="

ALLOWED_STATUS = {"concept", "testing", "validated", "expanding"}


# 用 workflow 執行時間（UTC+8台灣時間）當「推到網站的日期」
from datetime import timedelta
def today_ymd_utc() -> str:
    taiwan_time = datetime.now(timezone.utc) + timedelta(hours=8)
    return taiwan_time.strftime("%Y-%m-%d")

def load_projects():
    with open(PROJECTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_projects(data):
    with open(PROJECTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

def extract_update_block(full_text: str) -> str:
    i = full_text.find(UPDATE_START)
    j = full_text.find(UPDATE_END)
    if i == -1 or j == -1 or j <= i:
        return ""
    return full_text[i + len(UPDATE_START): j].strip()

def _after_colon(line: str) -> str:
    # 支援全形/半形冒號
    if "：" in line:
        return line.split("：", 1)[1].strip()
    if ":" in line:
        return line.split(":", 1)[1].strip()
    return ""

def _ensure_list_of_str(v):
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        s = v.strip()
        return [s] if s else []
    return [str(v).strip()] if str(v).strip() else []

def _ensure_content(v):
    """
    content 我們允許 AI 回：
      - 字串
      - 字串陣列

    最終一律存成「字串陣列」，並保留換行段落
    """
    if v is None:
        return []

    lines = []

    # AI 回傳 list
    if isinstance(v, list):
        for item in v:
            if item is None:
                continue
            text = str(item)
            lines.extend(text.splitlines())

    # AI 回傳 string
    elif isinstance(v, str):
        lines.extend(v.splitlines())

    else:
        lines.append(str(v))

    # 清理空行
    cleaned = []
    for line in lines:
        t = line.strip()
        if t:
            cleaned.append(t)

    return cleaned

def _ensure_timeline(v):
    if v is None:
        return []
    if not isinstance(v, list):
        return []
    out = []
    for item in v:
        if not isinstance(item, dict):
            continue
        out.append({
            "date": str(item.get("date") or "").strip(),
            "phase": str(item.get("phase") or "").strip(),
            "title": str(item.get("title") or "").strip(),
            "note": str(item.get("note") or "").strip(),
        })
    return out

def _ensure_gallery(v):
    """
    gallery 允許兩種：
      - ["./a.png", "./b.png"]
      - [{"src":"./a.png","alt":"..."}, ...]
    最終保留原型態（字串或 dict），但去重複時以 src/字串值作 key。
    """
    if v is None:
        return []
    if not isinstance(v, list):
        return []
    out = []
    for item in v:
        if isinstance(item, str):
            s = item.strip()
            if s:
                out.append(s)
        elif isinstance(item, dict):
            # 允許 src/alt 以外多欄位，先保留
            out.append(item)
    return out

def parse_forced_fields(block: str):
    """
    回傳：
      - project_id: 必填
      - forced: dict（name/summary/cover 強制覆寫）
      - pin_intent: None/True/False（只有寫置頂/取消置頂才有值）
      - hints_gallery: list[str]（block 內寫了 成果：xxx.png 的提示；不強制）
    """
    lines = [ln.rstrip() for ln in block.splitlines()]

    project_id = ""
    forced = {}
    pin_intent = None
    hints_gallery = []

    pending_key = None  # 用來接【封面】下一行這種格式

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # ---------- 先處理「【欄位】」標題 ----------
        if line in ("【專案】", "【專案ID】", "【id】", "【ID】"):
            pending_key = "project_id"
            continue

        if line in ("【專案名稱】", "【名稱】", "【name】", "【Name】"):
            pending_key = "name"
            continue

        if line in ("【摘要】", "【summary】", "【Summary】"):
            pending_key = "summary"
            continue

        if line in ("【封面】", "【cover】", "【Cover】"):
            pending_key = "cover"
            continue

        if line in ("【成果】", "【成果畫面】", "【gallery】", "【Gallery】"):
            pending_key = "gallery"
            continue

        # ---------- 若上一行是【欄位】，這一行就當值 ----------
        if pending_key:
            if pending_key == "project_id":
                project_id = line
            elif pending_key in ("name", "summary", "cover"):
                forced[pending_key] = line
            elif pending_key == "gallery":
                hints_gallery.append(line)

            pending_key = None
            continue

        # ---------- 置頂 / 取消置頂 ----------
        if "取消置頂" in line:
            pin_intent = False
            continue
        if "置頂" in line:
            pin_intent = True
            continue

        # ---------- 冒號格式 ----------
        if line.startswith("專案") or line.lower().startswith("id"):
            v = _after_colon(line)
            if v:
                project_id = v
            continue

        if line.startswith("專案名稱") or line.lower().startswith("name"):
            v = _after_colon(line)
            if v:
                forced["name"] = v
            continue

        if line.startswith("摘要") or line.lower().startswith("summary"):
            v = _after_colon(line)
            if v:
                forced["summary"] = v
            continue

        if line.startswith("封面") or line.lower().startswith("cover"):
            v = _after_colon(line)
            if v:
                forced["cover"] = v
            continue

        if line.startswith("成果") or line.lower().startswith("gallery"):
            v = _after_colon(line)
            if v:
                hints_gallery.append(v)
            continue

    return project_id, forced, pin_intent, hints_gallery

def find_project_index(data: dict, project_id: str):
    projects = data.get("projects", [])
    for i, p in enumerate(projects):
        if p.get("id") == project_id:
            return i
    return None

def ensure_project_base(project_id: str, forced: dict):
    """
    新增專案時建立基本骨架
    """
    name = forced.get("name") or (ISSUE_TITLE.strip() if ISSUE_TITLE else project_id)
    base = {
        "id": project_id,
        "name": name,
        "summary": forced.get("summary", ""),
        "cover": forced.get("cover", ""),
        "status": "concept",
        "updated": today_ymd_utc(),
        "output": "",
        # content 最終用 list[str]
        "content": _ensure_content(ISSUE_BODY.strip() or ""),
        "category": [],
        "techTags": [],
        "timeline": [],
        "next": [],
        "gallery": [],
        "pin": False
    }
    return base

def call_openai_patch(project_before: dict, issue_text: str, pin_intent, hints_gallery):
    """
    讓 AI 輸出「patch」(只包含要更新的欄位)，不允許輸出 id。
    使用 Chat Completions + response_format(json_object) 取得穩定 JSON。
    """
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    pin_rule = (
        "pin 欄位只有在使用者明確提到「置頂」或「取消置頂」時才允許改動；"
        "若本次更新沒有此指令，請不要輸出 pin。"
    )

    system = (
        "你是 projects.json 的更新器。你只能輸出「JSON物件」作為 patch（不要 markdown / 不要多餘文字）。\n"
        "定案 Schema：id(KEY不可修改)、name、summary、cover、status、updated、output、content、category、techTags、timeline、next、gallery、pin。\n"
        "規則：\n"
        "1) 絕對不能輸出或修改 id。\n"
        "2) 你只能輸出需要更新的欄位；不需要更新就不要輸出該欄位。\n"
        "3) 多值欄位：category/techTags/timeline/next/gallery 必須是陣列（可空）。\n"
        "3.1) content 必須是字串陣列，且只能整理【專案內容】區塊的文字；不要包含專案清單、更新指令、或 UPDATE START/END 文字。\n"
        "3.2) timeline 必須是物件陣列，每筆一定要有 date, phase, title；phase 必填且只能是 concept/testing/validated/expanding。\n"
        "3.3) gallery 必須是物件陣列，每筆格式為 {\"src\":\"檔名或路徑\",\"alt\":\"\"}；不要輸出字串陣列。\n"
        "4) status 只能是 concept/testing/validated/expanding 四種之一。\n"
        "5) updated 不要輸出（外層程式會在有變更時自動更新）。\n"
        f"6) {pin_rule}\n"
        "7) 若 issue 內容有提到成果檔名，合理時更新 gallery（加入或整理）。\n"
        "8) 若 issue 有新增內容，合理時更新 content/timeline/next/category/techTags/output/status。\n"
        "輸出務必是有效 JSON 物件。\n"
    )

    user = {
        "project_before": project_before,
        "issue": issue_text,
        "pin_intent": pin_intent,          # None/True/False
        "gallery_hints": hints_gallery      # 檔名提示（不一定要全用）
    }

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    r = requests.post(url, headers=headers, json=payload, timeout=90)
    if r.status_code >= 400:
        raise RuntimeError(f"OpenAI error {r.status_code}: {r.text}")

    data = r.json()
    content = data["choices"][0]["message"]["content"]
    patch = json.loads(content)

    if not isinstance(patch, dict):
        raise RuntimeError("Model patch is not a JSON object.")

    # 保護：永遠不允許 id / updated 由 AI 改
    patch.pop("id", None)
    patch.pop("updated", None)
    return patch

def merge_project(project_before: dict, forced: dict, pin_intent, ai_patch: dict):
    project_after = json.loads(json.dumps(project_before, ensure_ascii=False))

    # 1) forced
    for k in ["name", "summary", "cover"]:
        if k in forced and forced[k]:
            project_after[k] = forced[k]

    # 2) pin（只有明確指令才改）
    if pin_intent is True:
        project_after["pin"] = True
    elif pin_intent is False:
        project_after["pin"] = False

    # 3) AI patch（不得覆蓋 forced；pin 無指令不得改）
    allowed_ai = {
        "status", "pin", "output", "content",
        "category", "techTags", "timeline", "next", "gallery",
        "name", "summary", "cover"
    }

    for k, v in (ai_patch or {}).items():
        if k not in allowed_ai:
            continue
        if k in forced:
            continue
        if k == "pin" and pin_intent is None:
            continue
        if k in {"name", "summary", "cover", "output"} and isinstance(v, str) and not v.strip():
            continue

        # 型別統一（避免 AI 回錯型態）
        if k in {"category", "techTags", "next"}:
            project_after[k] = _ensure_list_of_str(v)
        elif k == "content":
            project_after[k] = _ensure_content(v)
        elif k == "timeline":
            project_after[k] = _ensure_timeline(v)
        elif k == "gallery":
            project_after[k] = _ensure_gallery(v)
        else:
            project_after[k] = v

    # status 校正
    if project_after.get("status") not in ALLOWED_STATUS:
        old = project_before.get("status")
        project_after["status"] = old if old in ALLOWED_STATUS else "concept"

    # ----------------------------
    # Normalize: timeline
    # ----------------------------
    tl = project_after.get("timeline")
    if isinstance(tl, list):
        # phase 空值保底
        fixed = []
        for it in tl:
            if not isinstance(it, dict):
                continue
            if not str(it.get("phase") or "").strip():
                it["phase"] = project_after.get("status") or "concept"
            fixed.append(it)

        # 去重複（date+title）
        seen = set()
        unique = []
        for it in fixed:
            date = str(it.get("date") or "").strip()
            title = str(it.get("title") or "").strip()
            key = (date, title)
            if key in seen:
                continue
            seen.add(key)
            unique.append(it)

        # 排序：新到舊（你若要舊到新，把 reverse 改 False）
        unique = sorted(unique, key=lambda x: str(x.get("date") or ""), reverse=True)
        project_after["timeline"] = unique

    # ----------------------------
    # Normalize: cover path
    # ----------------------------
    cover = str(project_after.get("cover") or "").strip()
    if cover and not cover.startswith(("http://", "https://", "/", "./")):
        project_after["cover"] = f"./assets/{cover}"
    cover_basename = str(project_after.get("cover") or "").strip().split("/")[-1]

    # ----------------------------
    # Normalize: gallery (type -> remove cover -> dedupe -> path)
    # ----------------------------
    g = project_after.get("gallery")

    # 1) list[str] -> list[dict]
    if isinstance(g, list) and g and isinstance(g[0], str):
        g = [{"src": str(s).strip(), "alt": ""} for s in g if str(s).strip()]
        project_after["gallery"] = g

    g = project_after.get("gallery")
    if isinstance(g, list):
        cleaned = []
        for it in g:
            if not isinstance(it, dict):
                continue
            src = str(it.get("src") or "").strip()
            if not src:
                continue
            # 去掉跟封面同檔名
            if cover_basename and src.split("/")[-1] == cover_basename:
                continue
            cleaned.append(it)

        # 去重複（以 src）
        seen = set()
        unique = []
        for it in cleaned:
            src = str(it.get("src") or "").strip()
            if not src or src in seen:
                continue
            seen.add(src)
            unique.append(it)

        # 補路徑：./assets/{projectId}/
        project_id = project_after.get("id")
        for it in unique:
            src = str(it.get("src") or "").strip()
            if src and not src.startswith(("http://", "https://", "/", "./")):
                it["src"] = f"./assets/{project_id}/{src}"

        project_after["gallery"] = unique

    # ----------------------------
    # 最後：算 changed / updated（一定要放最後）
    # ----------------------------
    changed = json.dumps(project_after, ensure_ascii=False, sort_keys=True) != json.dumps(project_before, ensure_ascii=False, sort_keys=True)
    if changed:
        project_after["updated"] = today_ymd_utc()

    # id 永遠不變
    project_after["id"] = project_before["id"]
    return project_after, changed
    
    
def sort_projects(projects: list):
    # pin true 在前；updated 新到舊
    def key(p):
        pin = 1 if p.get("pin") else 0
        updated = str(p.get("updated") or "")
        return (pin, updated)
    return sorted(projects, key=key, reverse=True)

def main():
    full_text = ISSUE_BODY or ""
    block = extract_update_block(full_text)
    if not block:
        raise SystemExit(
            f"Missing update block. Please include:\n{UPDATE_START}\n...\n{UPDATE_END}"
        )

    project_id, forced, pin_intent, hints_gallery = parse_forced_fields(block)
    if not project_id:
        raise SystemExit("Missing project id in update block. Example: 專案：ai-x-web-automation")

    data = load_projects()
    projects = data.get("projects", [])
    idx = find_project_index(data, project_id)

    if idx is None:
        before = ensure_project_base(project_id, forced)
        projects.append(before)
        idx = len(projects) - 1
    else:
        before = projects[idx]
        # 補缺欄位（避免舊資料少欄位）
        before.setdefault("summary", "")
        before.setdefault("cover", "")
        before.setdefault("output", "")
        before.setdefault("content", [])
        before.setdefault("category", [])
        before.setdefault("techTags", [])
        before.setdefault("timeline", [])
        before.setdefault("next", [])
        before.setdefault("gallery", [])
        before.setdefault("pin", False)

        # content 統一型態
        before["content"] = _ensure_content(before.get("content"))
        before["category"] = _ensure_list_of_str(before.get("category"))
        before["techTags"] = _ensure_list_of_str(before.get("techTags"))
        before["next"] = _ensure_list_of_str(before.get("next"))
        before["timeline"] = _ensure_timeline(before.get("timeline"))
        before["gallery"] = _ensure_gallery(before.get("gallery"))

    issue_text = f"Issue title:\n{ISSUE_TITLE}\n\nUpdate block:\n{block}\n"
    
    ai_patch = call_openai_patch(before, issue_text, pin_intent, hints_gallery)
    after, changed = merge_project(before, forced, pin_intent, ai_patch)

    projects[idx] = after
    data["projects"] = sort_projects(projects)

    save_projects(data)
    print("Updated projects.json" if changed else "No changes (projects.json unchanged)")

if __name__ == "__main__":
    main()