"""Membuat berkas logo BYD (SVG + ikon PNG) ke src/assets/brand/. Jalankan sekali: python3 tools/make_logo.py"""
import pathlib, sys
OUT = pathlib.Path(__file__).resolve().parent.parent / "src/assets/brand"
OUT.mkdir(parents=True, exist_ok=True)
# viewBox 0 0 1780 340 (geometri wordmark BYD digambar ulang sebagai vektor)
D3 = ("M64 0H380Q505 0 505 115Q505 160 485 172Q510 195 505 230Q505 335 380 335H64Q0 335 0 325V280Q0 270 10 270H430Q445 270 445 255"
      "V240Q445 202 430 202H10Q0 202 0 192V150Q0 140 10 140H430Q445 140 445 125V110Q445 70 430 70H10Q0 70 0 60V10Q0 0 10 0Z")
DY = ("M0 0H70V140Q70 150 80 150H205V0H70Z")  # placeholder, diganti di bawah
PATHS = [
    # "3"
    ("M10 0H385Q505 0 505 112Q505 160 485 170Q510 192 505 225Q505 335 385 335H10Q0 335 0 325V280Q0 270 10 270H425Q440 270 440 255V240Q440 202 425 202H10Q0 202 0 192V150Q0 140 10 140H425Q440 140 440 125V110Q440 68 425 68H10Q0 68 0 58V10Q0 0 10 0Z"),
    # Y: lengan kiri + dasar
    ("M595 0H665V140Q665 150 675 150H810V210H655Q595 210 595 150Z"),
    # Y: lengan kanan + dasar
    ("M1085 0H1155V150Q1155 210 1095 210H920V150H1075Q1085 150 1085 140Z"),
    # Y: batang tengah
    ("M840 150H900V335H850Q840 335 840 325Z"),
    # D
    ("M1235 0H1580A168 168 0 0 1 1580 335H1235Q1225 335 1225 325V280Q1225 270 1235 270H1580A103 103 0 0 0 1580 68H1235Q1225 68 1225 58V10Q1225 0 1235 0Z"),
]
def svg(fill, extra=""):
    p = "".join(f'<path d="{d}"/>' for d in PATHS)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1748 335"{extra}><g fill="{fill}">{p}</g></svg>'
(OUT / "byd-dark.svg").write_text(svg("#16222d"), encoding="utf-8")
(OUT / "byd-light.svg").write_text(svg("#eef3f6"), encoding="utf-8")
# ikon persegi
def icon(size, r):
    pad = size * 0.14
    w = size - 2 * pad
    h = w * 335 / 1748
    inner = svg("#f2f6f8").replace("<svg ", f'<svg x="{pad}" y="{(size - h) / 2}" width="{w}" height="{h}" ', 1)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d2233"/><stop offset="1" stop-color="#07131c"/></linearGradient></defs>'
            f'<rect width="{size}" height="{size}" rx="{r}" fill="url(#g)"/>{inner}</svg>')
(OUT / "icon.svg").write_text(icon(512, 112), encoding="utf-8")
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("playwright tidak ada: hanya SVG yang dibuat")
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page()
    for name, size, r in (("favicon-32.png", 32, 7), ("favicon-48.png", 48, 10), ("apple-touch-icon.png", 180, 0), ("icon-192.png", 192, 42), ("icon-512.png", 512, 112)):
        pg.set_viewport_size({"width": size, "height": size})
        pg.set_content(f'<body style="margin:0;background:transparent">{icon(size, r)}</body>')
        pg.screenshot(path=str(OUT / name), omit_background=True)
    pg.set_viewport_size({"width": 800, "height": 154})
    pg.set_content(f'<body style="margin:0;background:transparent">{svg("#eef3f6",' width="800" height="154"')}</body>')
    pg.screenshot(path=str(OUT / "byd-light.png"), omit_background=True)
    # pratinjau
    pg.set_viewport_size({"width": 1000, "height": 340})
    pg.set_content(f'<body style="margin:0;display:flex"><div style="flex:1;background:#fff;padding:40px">{svg("#16222d",' width="420"')}</div><div style="flex:1;background:#0b1f2e;padding:40px">{svg("#eef3f6",' width="420"')}</div></body>')
    pg.screenshot(path="/tmp/lg/logo_prev.png"); b.close()
print("ok")
