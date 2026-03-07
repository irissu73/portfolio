import json
import os
import re
import requests
from datetime import datetime, timezone, timedelta

OPENAI_API_KEY = (os.environ.get("OPENAI_API_KEY") or "").strip()
ISSUE_TITLE = (os.environ.get("ISSUE_TITLE") or "").strip()
ISSUE_BODY = (os.environ.get("ISSUE_BODY") or "").strip()

if not OPENAI_API_KEY:
    raise SystemExit("Missing OPENAI_API_KEY (GitHub Secret).")

PROJECTS_PATH = "projects.json"

ALLOWED_STATUS = {"concept", "testing", "validated", "expanding"}

PHASE_MAP = {
    "構想": "concept",
    "構想中": "concept",
    "準備": "concept",
    "開始準備": "concept",
    "規劃": "concept",

    "測試": "testing",
    "測試中": "testing",
    "驗證": "testing",
    "驗證中": "testing",

    "已驗證": "validated",
    "完成": "validated",

    "延伸": "expanding",
    "延伸中": "expanding",
}

BLOCK_ALIASES = {
    "專案名稱": "name",
    "名稱": "name",
    "name": "name",

    "摘要": "summary",
    "summary": "summary",

    "封面": "cover",
    "cover": "cover",

    "產出": "output",
    "output": "output",

    "狀態": "status",
    "status": "status",

    "專案內容": "content",
    "內容": "content",
    "content": "content",

    "時間軸": "timeline",
    "timeline": "timeline",

    "下一步": "next",
    "next": "next",

    "成果": "gallery",
    "gallery": "gallery",

    "技術": "techTags",
    "技術標籤": "techTags",
    "techtags": "techTags",
    "techTags": "techTags",

    "應用類型": "category",
    "category": "category",
}

DEFAULT_MODE_BY_FIELD = {
    "name": "ALL",
    "summary": "ALL",
    "cover": "ALL",
    "output": "ALL",
    "status": "ALL",
    "content": "ADD",
    "timeline": "ADD",
    "next": "ADD",
    "gallery": "ADD",
    "techTags": "ADD",
    "category": "ADD",
}


def today_dash() -> str:
    taiwan_time = datetime.now(timezone.utc) + timedelta(hours=8)
    return taiwan_time.strftime("%Y-%m-%d")


def today_dot() -> str:
    taiwan_time = datetime.now(timezone.utc) + timedelta(hours=8)
    return taiwan_time.strftime("%Y.%m.%d")


def load_projects():
    with open(PROJECTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_projects(data):
    with open(PROJECTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _after_colon(line: str) -> str:
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


def _split_paragraphs(text: str):
    text = str(text or "").strip().replace("\r\n", "\n").replace("\r", "\n")
    if not text:
        return []
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _ensure_content(v):
    if v is None:
        return []

    if isinstance(v, list):
        out = []
        for x in v:
            t = str(x or "").strip()
            if t:
                out.append(t)
        return out

    if isinstance(v, str):
        return _split_paragraphs(v)

    s = str(v).strip()
    return [s] if s else []


def _normalize_date_text(s: str) -> str:
    s = str(s or "").strip()
    if not s:
        return ""

    taiwan_time = datetime.now(timezone.utc) + timedelta(hours=8)

    if s == "今天":
        return taiwan_time.strftime("%Y.%m.%d")
    if s == "昨天":
        return (taiwan_time - timedelta(days=1)).strftime("%Y.%m.%d")

    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s.replace("-", ".")

    if re.match(r"^\d{4}\.\d{2}\.\d{2}$", s):
        return s

    return s


def _ensure_timeline(v):
    if v is None:
        return []
    if not isinstance(v, list):
        return []

    out = []

    for item in v:
        if not isinstance(item, dict):
            continue

        date = _normalize_date_text(item.get("date"))
        phase = str(item.get("phase") or "").strip()
        title = str(item.get("title") or "").strip()
        note = str(item.get("note") or "").strip()

        if phase in PHASE_MAP:
            phase = PHASE_MAP[phase]

        if title:
            out.append({
                "date": date,
                "phase": phase,
                "title": title,
                "note": note,
            })

    return out


def _ensure_gallery(v):
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
            out.append(item)
    return out


def _lines_to_items(text: str):
    lines = []
    for line in str(text or "").splitlines():
        s = line.strip()
        if not s:
            continue
        s = re.sub(r"^[-•]\s*", "", s)
        if s:
            lines.append(s)
    return lines


def _parse_block_mode_and_body(field_key: str, text: str):
    lines = str(text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    lines = [ln.rstrip() for ln in lines]

    mode = None
    body_lines = lines

    for idx, raw in enumerate(lines):
        s = raw.strip()
        if not s:
            continue
        upper = s.upper()
        if upper in ("ALL", "ADD"):
            mode = upper
            body_lines = lines[idx + 1:]
        else:
            body_lines = lines[idx:]
        break

    if not mode:
        mode = DEFAULT_MODE_BY_FIELD.get(field_key, "ALL")

    body = "\n".join(body_lines).strip()
    return mode, body


def _normalize_block_name(name: str):
    return BLOCK_ALIASES.get(str(name or "").strip(), "")


def _parse_timeline_text(text: str):
    """
    支援：
    今天 測試
    note...

    2026.03.06 構想2
    note...
    """
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []

    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    result = []

    for block in blocks:
        lines = [ln.strip() for ln in block.split("\n") if ln.strip()]
        if not lines:
            continue

        first = lines[0]

        date = ""
        title = ""
        note = ""
        phase = ""

        m = re.match(r"^(今天|昨天|\d{4}[.-]\d{2}[.-]\d{2})\s+(.+)$", first)
        if m:
            date = m.group(1).strip()
            title = m.group(2).strip()
            note = "\n".join(lines[1:]).strip()
        else:
            # 若不是標準格式，整段跳過，交給 AI
            continue

        if title:
            # 從 title 猜 phase
            title_first_word = title.split()[0]
            if title_first_word in PHASE_MAP:
                phase = PHASE_MAP[title_first_word]
            elif title in PHASE_MAP:
                phase = PHASE_MAP[title]

            result.append({
                "date": date,
                "phase": phase,
                "title": title,
                "note": note,
            })

    return result


def extract_structured_parts(full_text: str):
    """
    回傳：
      project_id: str
      forced_ops: {
        field_key: {
          "mode": "ALL" | "ADD",
          "value": ...
        }
      }
      pin_intent: None / True / False
      remaining_text: 已移除標記區塊後的文字
    """
    text = (full_text or "").replace("\r\n", "\n").replace("\r", "\n")

    project_id = ""
    pin_intent = None

    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue

        if line.startswith("專案") or line.lower().startswith("id"):
            v = _after_colon(line)
            if v:
                project_id = v

        if "取消置頂" in line:
            pin_intent = False
        elif "置頂" in line:
            pin_intent = True

    forced_ops = {}

    pattern = re.compile(r"【([^】]+)】(.*?)【/\1】", re.DOTALL)
    matches = list(pattern.finditer(text))

    for m in matches:
        raw_name = m.group(1).strip()
        body = m.group(2).strip()
        field_key = _normalize_block_name(raw_name)
        if not field_key:
            continue

        mode, body_text = _parse_block_mode_and_body(field_key, body)

        if field_key in {"name", "summary", "cover", "output", "status"}:
            forced_ops[field_key] = {
                "mode": "ALL",
                "value": body_text.strip()
            }

        elif field_key == "content":
            forced_ops[field_key] = {
                "mode": mode,
                "value": _ensure_content(body_text)
            }

        elif field_key == "timeline":
            forced_ops[field_key] = {
                "mode": mode,
                "value": _parse_timeline_text(body_text)
            }

        elif field_key in {"gallery", "next", "category", "techTags"}:
            forced_ops[field_key] = {
                "mode": mode,
                "value": _lines_to_items(body_text)
            }

    remaining_text = pattern.sub("", text)
    remaining_text = re.sub(r"\n{3,}", "\n\n", remaining_text).strip()

    return project_id, forced_ops, pin_intent, remaining_text


def find_project_index(data: dict, project_id: str):
    projects = data.get("projects", [])
    for i, p in enumerate(projects):
        if p.get("id") == project_id:
            return i
    return None


def ensure_project_base(project_id: str, forced_ops: dict):
    name = str(forced_ops.get("name", {}).get("value") or "").strip() or (ISSUE_TITLE.strip() if ISSUE_TITLE else project_id)
    summary = str(forced_ops.get("summary", {}).get("value") or "").strip()

    cover = str(forced_ops.get("cover", {}).get("value") or "").strip()
    if not cover:
        cover = f"./assets/{project_id}-cover.png"

    output = str(forced_ops.get("output", {}).get("value") or "").strip() or "開發中"

    status = str(forced_ops.get("status", {}).get("value") or "").strip()
    if status in PHASE_MAP:
        status = PHASE_MAP[status]
    if status not in ALLOWED_STATUS:
        status = "concept"

    return {
        "id": project_id,
        "name": name,
        "summary": summary,
        "cover": cover,
        "status": status,
        "updated": today_dash(),
        "output": output,
        "content": [],
        "category": [],
        "techTags": [],
        "timeline": [],
        "next": [],
        "gallery": [],
        "pin": False
    }


def call_openai_patch(project_before: dict, issue_text: str, pin_intent):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    system = (
        "你是 projects.json 的更新器。你只能輸出 JSON 物件作為 patch，不要輸出 markdown 或多餘文字。\n"
        "Schema：id(KEY不可修改)、name、summary、cover、status、updated、output、content、category、techTags、timeline、next、gallery、pin。\n"
        "規則：\n"
        "1) 絕對不能輸出或修改 id。\n"
        "2) updated 不要輸出，外層程式會自動更新。\n"
        "3) name / cover / output / status 不要自行判斷輸出，只有標記區塊才會處理；你現在只處理剩餘自然語言。\n"
        "4) summary 若未使用標記區塊，必要時可根據自然語言判斷輸出。\n"
        "5) category/techTags/next 必須是字串陣列。\n"
        "6) content 必須是字串陣列，且只整理真正屬於專案內容的敘述。\n"
        "7) gallery 必須是物件陣列，每筆格式為 {\"src\":\"檔名或路徑\",\"alt\":\"\"}。\n"
        "8) timeline 必須是物件陣列，每筆至少包含 date, phase, title, note。\n"
        "9) 若 date 使用中文（今天/昨天）可保留，外層程式會正規化。\n"
        "10) phase 若使用中文（構想/測試/已驗證/延伸）可保留，外層程式會轉英文。\n"
        "11) 口語化時間軸解析規則：\n"
        "11.1) 若一行同時包含日期與標題，例如『今天 測試』或『2026.03.06 構想2』，則 date = 第一段日期，title = 其餘文字。\n"
        "11.2) 下一行若為說明，請放入 note。\n"
        "11.3) 若有說明文字，note 不可省略。\n"
        "12) 若出現『下一步』加清單，請整理為 next。\n"
        "13) pin 只有在使用者明確提到「置頂」或「取消置頂」時才允許輸出。\n"
        "14) 這次輸入給你的 issue 內容，已經移除所有明確標記區塊；請只根據剩餘自然語言判斷其他可更新欄位。\n"
        "15) 若資訊不足，不要清空原有欄位。\n"
    )

    user = {
        "project_before": project_before,
        "issue": issue_text,
        "pin_intent": pin_intent
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

    # 這些不給 AI 自行更新
    for key in ["id", "updated", "name", "cover", "output", "status"]:
        patch.pop(key, None)

    return patch


def _apply_forced_ops(project_after: dict, forced_ops: dict):
    for field, op in forced_ops.items():
        mode = str(op.get("mode") or "ALL").upper()
        value = op.get("value")

        if field in {"name", "summary", "cover", "output", "status"}:
            if value:
                project_after[field] = str(value).strip()
            continue

        if field == "content":
            incoming = _ensure_content(value)
            if mode == "ADD":
                project_after["content"] = _ensure_content(project_after.get("content")) + incoming
            else:
                project_after["content"] = incoming
            continue

        if field == "timeline":
            incoming = _ensure_timeline(value)
            current = _ensure_timeline(project_after.get("timeline"))
            if mode == "ADD":
                project_after["timeline"] = current + incoming
            else:
                project_after["timeline"] = incoming
            continue

        if field in {"gallery", "next", "category", "techTags"}:
            incoming = _ensure_list_of_str(value)
            current = _ensure_list_of_str(project_after.get(field))
            if mode == "ADD":
                project_after[field] = current + incoming
            else:
                project_after[field] = incoming
            continue

    return project_after


def merge_project(project_before: dict, forced_ops: dict, pin_intent, ai_patch: dict):
    project_after = json.loads(json.dumps(project_before, ensure_ascii=False))

    project_after = _apply_forced_ops(project_after, forced_ops)

    if pin_intent is True:
        project_after["pin"] = True
    elif pin_intent is False:
        project_after["pin"] = False

    allowed_ai = {
        "summary", "content", "timeline", "next", "gallery", "techTags", "category", "pin"
    }

    forced_fields = set(forced_ops.keys())

    for k, v in (ai_patch or {}).items():
        if k not in allowed_ai:
            continue
        if k in forced_fields:
            continue
        if k == "pin" and pin_intent is None:
            continue
        if k == "summary" and isinstance(v, str) and not v.strip():
            continue

        if k in {"category", "techTags", "next"}:
            current = _ensure_list_of_str(project_after.get(k))
            incoming = _ensure_list_of_str(v)
            project_after[k] = current + incoming

        elif k == "content":
            current = _ensure_content(project_after.get("content"))
            incoming = _ensure_content(v)
            project_after["content"] = current + incoming

        elif k == "timeline":
            current = _ensure_timeline(project_after.get("timeline"))
            incoming = _ensure_timeline(v)
            project_after["timeline"] = current + incoming

        elif k == "gallery":
            current = _ensure_gallery(project_after.get("gallery"))
            incoming = _ensure_gallery(v)
            project_after["gallery"] = current + incoming

        else:
            project_after[k] = v

    # Normalize status
    status = str(project_after.get("status") or "").strip()
    if status in PHASE_MAP:
        status = PHASE_MAP[status]
    if status not in ALLOWED_STATUS:
        old = str(project_before.get("status") or "").strip()
        project_after["status"] = old if old in ALLOWED_STATUS else "concept"
    else:
        project_after["status"] = status

    # Normalize timeline
    tl = _ensure_timeline(project_after.get("timeline"))
    fixed = []
    for it in tl:
        phase = str(it.get("phase") or "").strip()
        date = _normalize_date_text(it.get("date"))
        title = str(it.get("title") or "").strip()
        note = str(it.get("note") or "").strip()

        if phase in PHASE_MAP:
            phase = PHASE_MAP[phase]
        if not phase:
            phase = project_after.get("status") or "concept"

        if not title:
            continue

        fixed.append({
            "date": date,
            "phase": phase,
            "title": title,
            "note": note
        })

    seen = set()
    unique = []
    for it in fixed:
        key = (str(it.get("date") or "").strip(), str(it.get("title") or "").strip())
        if key in seen:
            continue
        seen.add(key)
        unique.append(it)

    unique = sorted(unique, key=lambda x: str(x.get("date") or ""), reverse=True)
    project_after["timeline"] = unique

    # Normalize cover
    cover = str(project_after.get("cover") or "").strip()
    if not cover:
        project_after["cover"] = f"./assets/{project_after['id']}-cover.png"
    elif not cover.startswith(("http://", "https://", "/", "./")):
        project_after["cover"] = f"./assets/{cover}"

    cover_basename = str(project_after.get("cover") or "").strip().split("/")[-1]

    # Normalize gallery
    g = project_after.get("gallery")
    if isinstance(g, list) and g and isinstance(g[0], str):
        g = [{"src": str(s).strip(), "alt": ""} for s in g if str(s).strip()]
        project_after["gallery"] = g

    g = project_after.get("gallery")
    if isinstance(g, list):
        cleaned = []
        for it in g:
            if isinstance(it, str):
                src = it.strip()
                if src:
                    cleaned.append({"src": src, "alt": ""})
                continue

            if not isinstance(it, dict):
                continue

            src = str(it.get("src") or "").strip()
            if not src:
                continue

            cleaned.append({
                "src": src,
                "alt": str(it.get("alt") or "").strip()
            })

        filtered = []
        for it in cleaned:
            src = str(it.get("src") or "").strip()
            if cover_basename and src.split("/")[-1] == cover_basename:
                continue
            filtered.append(it)

        seen = set()
        unique = []
        for it in filtered:
            src = str(it.get("src") or "").strip()
            if not src or src in seen:
                continue
            seen.add(src)
            unique.append(it)

        project_id = project_after.get("id")
        for it in unique:
            src = str(it.get("src") or "").strip()
            if src and not src.startswith(("http://", "https://", "/", "./")):
                it["src"] = f"./assets/{project_id}/{src}"

        project_after["gallery"] = unique

    project_after["content"] = _ensure_content(project_after.get("content"))
    project_after["category"] = _ensure_list_of_str(project_after.get("category"))
    project_after["techTags"] = _ensure_list_of_str(project_after.get("techTags"))
    project_after["next"] = _ensure_list_of_str(project_after.get("next"))

    changed = json.dumps(project_after, ensure_ascii=False, sort_keys=True) != json.dumps(
        project_before, ensure_ascii=False, sort_keys=True
    )
    if changed:
        project_after["updated"] = today_dash()

    project_after["id"] = project_before["id"]
    return project_after, changed


def sort_projects(projects: list):
    def key(p):
        pin = 1 if p.get("pin") else 0
        updated = str(p.get("updated") or "")
        return (pin, updated)
    return sorted(projects, key=key, reverse=True)


def main():
    full_text = ISSUE_BODY.strip()
    if not full_text:
        raise SystemExit("Issue body is empty.")

    project_id, forced_ops, pin_intent, remaining_text = extract_structured_parts(full_text)
    if not project_id:
        raise SystemExit("Missing project id. Example: 專案：ai-x-web-automation")

    data = load_projects()
    projects = data.get("projects", [])
    idx = find_project_index(data, project_id)

    if idx is None:
        before = ensure_project_base(project_id, forced_ops)
        projects.append(before)
        idx = len(projects) - 1
    else:
        before = projects[idx]
        before.setdefault("summary", "")
        before.setdefault("cover", f"./assets/{project_id}-cover.png")
        before.setdefault("status", "concept")
        before.setdefault("output", "開發中")
        before.setdefault("content", [])
        before.setdefault("category", [])
        before.setdefault("techTags", [])
        before.setdefault("timeline", [])
        before.setdefault("next", [])
        before.setdefault("gallery", [])
        before.setdefault("pin", False)

        before["content"] = _ensure_content(before.get("content"))
        before["category"] = _ensure_list_of_str(before.get("category"))
        before["techTags"] = _ensure_list_of_str(before.get("techTags"))
        before["next"] = _ensure_list_of_str(before.get("next"))
        before["timeline"] = _ensure_timeline(before.get("timeline"))
        before["gallery"] = _ensure_gallery(before.get("gallery"))

    issue_text = f"Issue title:\n{ISSUE_TITLE}\n\nIssue body:\n{remaining_text}\n"

    ai_patch = call_openai_patch(before, issue_text, pin_intent)
    after, changed = merge_project(before, forced_ops, pin_intent, ai_patch)

    projects[idx] = after
    data["projects"] = sort_projects(projects)

    save_projects(data)
    print("Updated projects.json" if changed else "No changes (projects.json unchanged)")


if __name__ == "__main__":
    main()