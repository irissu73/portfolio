import json
import os
import re
import requests
from datetime import datetime

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
ISSUE_TITLE = (os.environ.get("ISSUE_TITLE") or "").strip()
ISSUE_BODY = (os.environ.get("ISSUE_BODY") or "").strip()

if not OPENAI_API_KEY:
    raise SystemExit("Missing OPENAI_API_KEY (GitHub Secret).")

PROJECTS_PATH = "projects.json"

def ym_today() -> str:
    return datetime.utcnow().strftime("%Y.%m")

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:40] or "project"

def load_projects():
    with open(PROJECTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_projects(data):
    with open(PROJECTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def call_openai_json(title: str, body: str) -> dict:
    url = "https://api.openai.com/v1/responses"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    system = (
        "You are generating a single portfolio project card in JSON.\n"
        "Return ONLY valid JSON, no markdown, no extra text.\n"
        "Use concise Traditional Chinese.\n"
        "Tags should be short tech keywords without spaces, e.g., SwiftUI, GitHubActions, Vercel, OpenAIAPI.\n"
        "status must be one of: Active, Exploring, Validated, Archived.\n"
        "updated must be in format YYYY.MM.\n"
        "Fields required: id, name, goal, outcome, tags, status, updated, demo_url, image.\n"
        "demo_url and image can be empty strings.\n"
    )

    user = (
        f"Issue title:\n{title}\n\n"
        f"Issue body:\n{body}\n\n"
        "Generate the JSON card."
    )

    payload = {
        "model": "gpt-4o-mini",
        "input": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "max_output_tokens": 700,
    }

    r = requests.post(url, headers=headers, json=payload, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"OpenAI error {r.status_code}: {r.text}")

    data = r.json()

    text_parts = []
    for item in data.get("output", []):
        for c in item.get("content", []):
            if c.get("type") == "output_text":
                text_parts.append(c.get("text", ""))

    text = "".join(text_parts).strip()
    if not text:
        raise RuntimeError("No text returned from model.")

    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Model did not return valid JSON. Text was:\n{text}") from e

    return obj

def normalize_card(card: dict) -> dict:
    required = ["id", "name", "goal", "outcome", "tags", "status", "updated", "demo_url", "image"]
    for k in required:
        if k not in card:
            raise ValueError(f"Missing key: {k}")

    if not card["id"]:
        card["id"] = slugify(card["name"])
    if not re.match(r"^\d{4}\.\d{2}$", str(card["updated"])):
        card["updated"] = ym_today()

    tags = card["tags"]
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    if not isinstance(tags, list):
        tags = []
    card["tags"] = tags[:12]

    allowed = {"Active", "Exploring", "Validated", "Archived"}
    if card["status"] not in allowed:
        card["status"] = "Exploring"

    for k in ["name", "goal", "outcome", "demo_url", "image"]:
        card[k] = str(card[k] or "").strip()

    return card

def upsert_project(data: dict, card: dict) -> dict:
    projects = data.get("projects", [])
    idx = next((i for i, p in enumerate(projects) if p.get("id") == card["id"]), None)
    if idx is None:
        projects.append(card)
    else:
        projects[idx] = card
    data["projects"] = projects
    return data

def main():
    title = ISSUE_TITLE or "New Project"
    body = ISSUE_BODY or ""

    data = load_projects()
    card = call_openai_json(title, body)
    card = normalize_card(card)
    data = upsert_project(data, card)
    save_projects(data)

if __name__ == "__main__":
    main()
