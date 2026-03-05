import json
import os
import re
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
# category(選填多值/AI), techTags(選填多值/AI), timeline(選填多值/AI), next(選填多值/AI), gallery(選填多值/AI)
# pin(AI)，但你定義：只有寫「置頂/取消置頂」才判斷/改動
# 規則：標記內容優先（強制更新）；否則 AI 自動判斷要不要改；updated 用本次 workflow 日期

UPDATE_START = "=== UPDATE START ==="
UPDATE_END = "=== UPDATE END ==="

def today_ymd_utc() -> str:
    # 用 workflow 執行時間（UTC）當「推到網站的日期」
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

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

def parse_forced_fields(block: str):
    """
    回傳：
      - project_id: 必填
      - forced: dict（name/summary/cover 強制覆寫；其他欄位若未來你想也可加）
      - pin_intent: None/True/False（只有寫置頂/取消置頂才有值）
      - hints_gallery: list[str]（若 block 內寫了 成果：xxx.png，提供給 AI 參考；不強制）
    """
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]

    project_id = ""
    forced = {}
    pin_intent = None
    hints_gallery = []

    for line in lines:
        # 專案 id
        if line.startswith("專案") or line.lower().startswith("id"):
            v = _after_colon(line)
            if v:
                project_id = v
            continue

        # 置頂/取消置頂（只有出現才改）
        if "取消置頂" in line:
            pin_intent = False
            continue
        if "置頂" in line:
            pin_intent = True
            continue

        # 強制欄位（標記）
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

        # 成果檔名提示（不強制覆寫；交給 AI 判斷更新 gallery）
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
    新增專案時建立基本骨架：
    - id: KEY
    - name/content: 新增必填（name 若沒標記，先用 issue title；content 先用 issue body 或空字串）
    其他多值欄位：可先空陣列
    """
    name = forced.get("name") or (ISSUE_TITLE.strip() if ISSUE_TITLE else project_id)
    return {
        "id": project_id,
        "name": name,
        "summary": forced.get("summary", ""),
        "cover": forced.get("cover", ""),
        "status": "concept",     # 先給一個預設，後面交給 AI 修正
        "updated": today_ymd_utc(),
        "output": "",
        "content": (ISSUE_BODY.strip() or ""),
        "category": [],
        "techTags": [],
        "timeline": [],
        "next": [],
        "gallery": [],
        "pin": False
    }

def call_openai_patch(project_before: dict, issue_text: str, pin_intent, hints_gallery):
    """
    讓 AI 輸出「patch」(只包含要更新的欄位)，不允許輸出 id。
    規則：
      - 標記內容 > AI 判斷 > 原資料
      - pin 只有在 pin_intent 不為 None 時才允許 AI 變更
      - updated 不由 AI 輸出（外層自動處理）
    """
    url = "https://api.openai.com/v1/responses"
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
        "input": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)}
        ],
        "temperature": 0.2,
        "max_output_tokens": 900,
        "response_format": {"type": "json_object"},
    }

    r = requests.post(url, headers=headers, json=payload, timeout=90)
    if r.status_code >= 400:
        raise RuntimeError(f"OpenAI error {r.status_code}: {r.text}")

    data = r.json()

    # 取回 json_object
    patch = None
    # responses: output -> content -> json
    for item in data.get("output", []):
        for c in item.get("content", []):
            if c.get("type") == "output_json":
                patch = c.get("json")
                break
        if patch is not None:
            break

    # 兼容：若沒拿到 output_json，就回退抓 output_text 再 parse
    if patch is None:
        text_parts = []
        for item in data.get("output", []):
            for c in item.get("content", []):
                if c.get("type") == "output_text":
                    text_parts.append(c.get("text", ""))
        text = "".join(text_parts).strip()
        if not text:
            raise RuntimeError("No JSON returned from model.")
        patch = json.loads(text)

    if not isinstance(patch, dict):
        raise RuntimeError("Model patch is not a JSON object.")
    patch.pop("id", None)
    patch.pop("updated", None)  # updated 外層自動
    return patch

def merge_project(project_before: dict, forced: dict, pin_intent, ai_patch: dict):
    """
    合併優先序：
      1) forced（標記內）強制覆寫 name/summary/cover
      2) pin：只有 pin_intent != None 才覆寫
      3) ai_patch：覆寫允許 AI 的欄位（但不得覆蓋 forced 欄位）
      4) 若有變更 => updated=今天
    """
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

    # 3) AI patch
    allowed_ai = {
        "status", "pin", "output", "content", "category", "techTags", "timeline", "next", "gallery",
        "name", "summary", "cover"
    }

    for k, v in (ai_patch or {}).items():
        if k not in allowed_ai:
            continue
        # forced 欄位不可被 AI 覆蓋
        if k in forced:
            continue
        # pin 只有指令才允許改
        if k == "pin" and pin_intent is None:
            continue
        project_after[k] = v

    # timeline：若有 date 欄位，按日期新到舊排序（可選但很實用）
    if isinstance(project_after.get("timeline"), list):
        def _date_key(x):
            if isinstance(x, dict):
                return str(x.get("date") or "")
            return ""
        project_after["timeline"] = sorted(project_after["timeline"], key=_date_key, reverse=True)

    # 4) updated：若有變更就更新為今日（推到網站的日期）
    changed = json.dumps(project_after, ensure_ascii=False, sort_keys=True) != json.dumps(project_before, ensure_ascii=False, sort_keys=True)
    if changed:
        project_after["updated"] = today_ymd_utc()

    return project_after, changed

def sort_projects(projects: list):
    # pin true 在前；updated 新到舊；其餘維持穩定
    def key(p):
        pin = 1 if p.get("pin") else 0
        updated = str(p.get("updated") or "")
        return (-pin, updated)
    return sorted(projects, key=key, reverse=True)

def main():
    full_text = ISSUE_BODY or ""
    block = extract_update_block(full_text)
    if not block:
        raise SystemExit(f"Missing update block. Please include:\n{UPDATE_START}\n...\n{UPDATE_END}")

    project_id, forced, pin_intent, hints_gallery = parse_forced_fields(block)
    if not project_id:
        raise SystemExit("Missing project id in update block. Example: 專案：ai-x-web-automation")

    data = load_projects()
    projects = data.get("projects", [])
    idx = find_project_index(data, project_id)

    if idx is None:
        # 新增專案
        before = ensure_project_base(project_id, forced)
        projects.append(before)
        idx = len(projects) - 1
    else:
        before = projects[idx]

    # 用整個 issue（包含 block）給 AI 判斷，但你也可以只給 block
    issue_text = f"Issue title:\n{ISSUE_TITLE}\n\nIssue body:\n{ISSUE_BODY}\n"

    ai_patch = call_openai_patch(before, issue_text, pin_intent, hints_gallery)
    after, changed = merge_project(before, forced, pin_intent, ai_patch)

    # id 永遠不變
    after["id"] = before["id"]

    projects[idx] = after
    data["projects"] = sort_projects(projects)

    save_projects(data)
    print("Updated projects.json" if changed else "No changes (projects.json unchanged)")

if __name__ == "__main__":
    main()