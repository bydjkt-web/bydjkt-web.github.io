"""Loader konten: JSON, artikel/halaman markdown, jadwal terbit."""
import datetime
import json
import os
import pathlib
import re
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CONTENT = ROOT / "content"
TZ = ZoneInfo("Asia/Jakarta")
FM = re.compile(r"^---\n(.*?)\n---\n?(.*)$", re.S)


def parse_dt(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        d = datetime.datetime.fromisoformat(s + "T00:00:00" if len(s) == 10 else s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=TZ)


def now():
    forced = os.environ.get("BUILD_NOW")
    return (parse_dt(forced) if forced else None) or datetime.datetime.now(TZ)


def load_json(name, default=None):
    p = CONTENT / name
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def as_list(v, sep=","):
    return [x.strip() for x in (v or "").split(sep) if x.strip()]


def parse_md(path):
    raw = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    m = FM.match(raw)
    if not m:
        raise SystemExit(f"Front matter hilang: {path}")
    meta = {}
    for ln in m.group(1).split("\n"):
        if not ln.strip() or ln.lstrip().startswith("#"):
            continue
        k, _, v = ln.partition(":")
        meta[k.strip()] = v.strip()
    return meta, m.group(2).strip() + "\n"


def load_items(folder, kind):
    """Baca semua .md di content/<folder>; hitung kapan tayang."""
    items, n = [], now()
    d = CONTENT / folder
    for p in sorted(d.glob("*.md")) if d.exists() else []:
        meta, body = parse_md(p)
        slug = meta.get("slug") or p.stem
        title = meta.get("title", slug)
        status = meta.get("status", "published")
        pub = parse_dt(meta.get("publish_at", ""))
        dt = pub or parse_dt(meta.get("date", "")) or n
        it = {
            "kind": kind, "file": p.name, "slug": slug, "title": title,
            "h1": meta.get("h1") or title,
            "keyword": meta.get("keyword", ""),
            "secondary": as_list(meta.get("secondary", ""), ";"),
            "tier": meta.get("tier", "easy"),
            "intent": meta.get("intent", "info"),
            "description": meta.get("description", ""),
            "date": dt.date().isoformat(),
            "updated": (parse_dt(meta.get("updated", "")) or dt).date().isoformat(),
            "publish_at": meta.get("publish_at", ""),
            "status": status,
            "category": meta.get("category", "Panduan"),
            "cover": meta.get("cover", ""),
            "cover_alt": meta.get("cover_alt", ""),
            "author": meta.get("author", ""),
            "models": as_list(meta.get("models", "")),
            "placements": as_list(meta.get("placements", "")),
            "pillar": meta.get("pillar", ""),
            "in_footer": meta.get("in_footer", "") in ("1", "yes", "ya", "true"),
            "body": body, "dt": dt,
        }
        due = status in ("published", "scheduled") and dt <= n
        # Gerbang mutu: konten tanpa keyword/description tidak ikut tayang (ditahan, bukan menggagalkan deploy)
        it["blocked"] = bool(due and not (it["keyword"] and it["description"]))
        it["visible"] = due and not it["blocked"]
        items.append(it)
    return items
