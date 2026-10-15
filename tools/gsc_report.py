#!/usr/bin/env python3
"""Ambil data Google Search Console -> data/report.json.
Butuh secret GSC_SERVICE_ACCOUNT (JSON service account yang ditambahkan sebagai pengguna di properti Search Console).
Posisi hanya tersedia untuk query yang punya impresi; status index memakai URL Inspection API (kuota ~2000/hari/properti)."""
import datetime, json, os, pathlib, sys
import requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/report.json"
SITE = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))
KW = json.loads((ROOT / "content/keywords.json").read_text(encoding="utf-8")).get("keywords", [])
API = "https://searchconsole.googleapis.com"
SCOPE = ["https://www.googleapis.com/auth/webmasters.readonly"]


def token():
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    info = json.loads(os.environ["GSC_SERVICE_ACCOUNT"])
    c = service_account.Credentials.from_service_account_info(info, scopes=SCOPE)
    c.refresh(Request())
    return c.token


def site_url():
    d = SITE.get("gsc_property") or SITE.get("domain", "").rstrip("/") + "/"
    return d


def query(tok, prop, body):
    r = requests.post(f"{API}/webmasters/v3/sites/{requests.utils.quote(prop, safe='')}/searchAnalytics/query",
                      headers={"Authorization": "Bearer " + tok}, json=body, timeout=60)
    r.raise_for_status()
    return r.json().get("rows", [])


def inspect(tok, prop, url):
    r = requests.post(f"{API}/v1/urlInspection/index:inspect", headers={"Authorization": "Bearer " + tok},
                      json={"inspectionUrl": url, "siteUrl": prop}, timeout=60)
    if r.status_code != 200:
        return {"error": r.status_code}
    ix = r.json().get("inspectionResult", {}).get("indexStatusResult", {})
    return {"verdict": ix.get("verdict"), "coverage": ix.get("coverageState"), "lastCrawl": ix.get("lastCrawlTime"),
            "robots": ix.get("robotsTxtState"), "canonical": ix.get("googleCanonical")}


def build(tok, prop, urls):
    end = datetime.date.today() - datetime.timedelta(days=2)
    start = end - datetime.timedelta(days=27)
    base = {"startDate": start.isoformat(), "endDate": end.isoformat()}
    pages = query(tok, prop, {**base, "dimensions": ["page"], "rowLimit": 200})
    qs = query(tok, prop, {**base, "dimensions": ["query", "page"], "rowLimit": 1000})
    wanted = {k["q"].lower(): k for k in KW}
    kw = []
    for k in KW:
        rows = [r for r in qs if r["keys"][0].lower() == k["q"].lower()]
        best = min(rows, key=lambda r: r["position"]) if rows else None
        kw.append({"q": k["q"], "tier": k["tier"], "target": k["target"],
                   "position": round(best["position"], 1) if best else None, "clicks": sum(r["clicks"] for r in rows),
                   "impressions": sum(r["impressions"] for r in rows), "page": best["keys"][1] if best else None})
    top = [{"query": r["keys"][0], "page": r["keys"][1], "position": round(r["position"], 1), "clicks": r["clicks"],
            "impressions": r["impressions"]} for r in sorted(qs, key=lambda r: -r["impressions"])[:50] if r["keys"][0].lower() not in wanted]
    ins = {u: inspect(tok, prop, u) for u in urls[:150]}
    return {"generated": datetime.datetime.utcnow().isoformat() + "Z", "range": base, "property": prop,
            "pages": [{"page": r["keys"][0], "clicks": r["clicks"], "impressions": r["impressions"], "ctr": round(r["ctr"], 4),
                       "position": round(r["position"], 1)} for r in pages],
            "keywords": kw, "top_queries": top, "inspection": ins}


def main():
    if not os.environ.get("GSC_SERVICE_ACCOUNT"):
        print("GSC_SERVICE_ACCOUNT belum diisi; laporan dilewati."); return 0
    OUT.parent.mkdir(exist_ok=True)
    domain = SITE.get("domain", "").rstrip("/")
    import re
    sm = requests.get(domain + "/sitemap.xml", timeout=30).text
    urls = re.findall(r"<loc>([^<]+)</loc>", sm)
    try:
        data = build(token(), site_url(), urls)
    except Exception as e:  # tulis error agar tampil di admin
        data = {"generated": datetime.datetime.utcnow().isoformat() + "Z", "error": str(e)}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Laporan ditulis:", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
