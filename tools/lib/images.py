"""Pipeline gambar: content/img/* -> docs/img/*.webp (maks 1600px, kualitas 78) + varian 640px + OG jpg."""
import pathlib
import re

from PIL import Image, ImageOps

from . import content

SRC_DIR = content.CONTENT / "img"
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAIN_W, SMALL_W, Q_MAIN, Q_SMALL = 1600, 640, 78, 74
IMG = {}  # "/img/nama.webp" -> {w,h,small,bytes,src_bytes}
WARN = []
_out = None


def _slug(stem):
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "gambar"


def process(out_dir):
    global _out
    _out = pathlib.Path(out_dir) / "img"
    _out.mkdir(parents=True, exist_ok=True)
    if not SRC_DIR.exists():
        return
    for p in sorted(SRC_DIR.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in EXTS:
            continue
        name = _slug(p.stem)
        url = f"/img/{name}.webp"
        if url in IMG:
            WARN.append(f"Nama gambar kembar setelah dinormalisasi: {p.name} -> {url}")
            continue
        try:
            im = Image.open(p)
            im = ImageOps.exif_transpose(im)
        except Exception as e:  # file rusak
            WARN.append(f"Gambar tidak bisa dibuka: {p.name} ({e})")
            continue
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.mode or "transparency" in im.info else "RGB")
        if im.width > MAIN_W:
            im = im.resize((MAIN_W, round(im.height * MAIN_W / im.width)), Image.LANCZOS)
        dest = _out / f"{name}.webp"
        im.save(dest, "WEBP", quality=Q_MAIN, method=6)
        small = False
        if im.width > 720:
            sm = im.resize((SMALL_W, round(im.height * SMALL_W / im.width)), Image.LANCZOS)
            sm.save(_out / f"{name}-640.webp", "WEBP", quality=Q_SMALL, method=6)
            small = True
        IMG[url] = {"w": im.width, "h": im.height, "small": small,
                    "bytes": dest.stat().st_size, "src_bytes": p.stat().st_size, "name": name}
        if dest.stat().st_size > 350_000:
            WARN.append(f"Gambar masih besar ({dest.stat().st_size // 1024} KB): {url}. Kecilkan/crop agar halaman cepat.")


def resolve(src):
    """Terima '/img/x.webp', '/img/x.jpg', atau 'x.png' -> kunci IMG atau None."""
    if not src:
        return None
    base = pathlib.PurePosixPath(src).stem
    key = f"/img/{_slug(base)}.webp"
    return key if key in IMG else None


def og_url(src):
    """Buat salinan JPG 1200x630 (crop tengah) untuk og:image; kembalikan path /img/..-og.jpg."""
    key = resolve(src)
    if not key:
        return None
    name = IMG[key]["name"]
    dest = _out / f"{name}-og.jpg"
    if not dest.exists():
        im = Image.open(_out / f"{name}.webp").convert("RGB")
        im = ImageOps.fit(im, (1200, 630), Image.LANCZOS, centering=(0.5, 0.5))
        im.save(dest, "JPEG", quality=82, optimize=True, progressive=True)
    return f"/img/{name}-og.jpg"
