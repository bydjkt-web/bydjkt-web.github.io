#!/usr/bin/env python3
"""Kirim URL baru/berubah ke IndexNow (Bing, Yandex, dll). Google TIDAK memakai IndexNow."""
import hashlib, json, pathlib, re, sys
import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))
SENT = ROOT / "data/indexnow-sent.json"


def main():
    domain, key = SITE.get("domain", "").rstrip("/"), (SITE.get("indexnow_key") or "").strip()
    if not key or "DOMAIN-ANDA" in domain:
        print("IndexNow dilewati: isi domain dan indexnow_key di Admin → Pengaturan."); return 0
    sm = requests.get(domain + "/sitemap.xml", timeout=30)
    if sm.status_code != 200:
        print("Sitemap belum bisa diakses:", sm.status_code); return 0
    items = re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]*)</lastmod>", sm.text)
    prev = json.loads(SENT.read_text()) if SENT.exists() else {}
    cur = {u: hashlib.sha1(l.encode()).hexdigest()[:10] for u, l in items}
    todo = [u for u, h in cur.items() if prev.get(u) != h]
    if not todo:
        print("Tidak ada URL baru."); return 0
    host = domain.split("://", 1)[1]
    r = requests.post("https://api.indexnow.org/indexnow", json={
        "host": host, "key": key, "keyLocation": f"{domain}/{key}.txt", "urlList": todo[:9000]}, timeout=30)
    print("IndexNow", r.status_code, len(todo), "URL")
    if r.status_code in (200, 202):
        SENT.parent.mkdir(exist_ok=True); SENT.write_text(json.dumps(cur, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
