import importlib.util, json, pathlib, sys, types
ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("gsc", ROOT / "tools/gsc_report.py"); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

class Resp:
    def __init__(s, j, code=200): s._j, s.status_code = j, code; s.text = ""
    def json(s): return s._j
    def raise_for_status(s): pass

def fake_post(url, headers=None, json=None, timeout=0):
    if "searchAnalytics" in url:
        if json["dimensions"] == ["page"]:
            return Resp({"rows": [{"keys": ["https://x.com/blog/a/"], "clicks": 5, "impressions": 100, "ctr": .05, "position": 7.3}]})
        return Resp({"rows": [{"keys": ["harga mobil listrik", "https://x.com/harga-mobil-listrik/"], "clicks": 1, "impressions": 50, "ctr": .02, "position": 22.0},
                              {"keys": ["Harga Mobil Listrik", "https://x.com/blog/a/"], "clicks": 0, "impressions": 10, "ctr": 0, "position": 15.5},
                              {"keys": ["peluang baru", "https://x.com/blog/a/"], "clicks": 1, "impressions": 70, "ctr": .01, "position": 9.0}]})
    return Resp({"inspectionResult": {"indexStatusResult": {"verdict": "PASS", "coverageState": "Submitted and indexed", "lastCrawlTime": "2026-10-10T00:00:00Z"}}})

g.requests.post = fake_post
data = g.build("tok", "https://x.com/", ["https://x.com/blog/a/"])
kw = {k["q"]: k for k in data["keywords"]}
assert kw["harga mobil listrik"]["position"] == 15.5 and kw["harga mobil listrik"]["impressions"] == 60, kw["harga mobil listrik"]
assert kw["mobil listrik murah"]["position"] is None  # tanpa impresi -> None, bukan angka palsu
assert data["top_queries"][0]["query"] == "peluang baru"
assert data["inspection"]["https://x.com/blog/a/"]["verdict"] == "PASS"
assert data["pages"][0]["position"] == 7.3
print("gsc_report OK")
