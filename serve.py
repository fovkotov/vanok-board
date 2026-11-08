#!/usr/bin/env python3
"""Local preview. HTML stays uncached so the browser cannot keep an old page.
Static files send a day of cache.

GET/POST/DELETE /api/signatures is the local catalog. Raster payloads are
written as WebP under design/stamps/custom-signatures/. DELETE remembers
the id in design/stamps/removed-seals.json and in the GET body, including
preset ids. GitHub Pages is static, so the public site uses
worker/signatures-worker.js for the same routes.
"""
import base64
import io
import json
import mimetypes
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from PIL import Image

mimetypes.add_type("model/gltf-binary", ".glb")

ROOT = Path(__file__).resolve().parent
STORE = ROOT / "design" / "stamps" / "custom-signatures.json"
DENY = ROOT / "design" / "stamps" / "removed-seals.json"
SIG_DIR = ROOT / "design" / "stamps" / "custom-signatures"
SIG_PREFIX = "design/stamps/custom-signatures/"
MAX_ITEMS = 80
MAX_SRC = 1_500_000
MAX_EDGE = 1600
SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$")
DATA_URL = re.compile(
    r"^data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$",
    re.S,
)


def read_raw_store():
    if not STORE.exists():
        return []
    try:
        data = json.loads(STORE.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def write_store(items):
    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps(items[:MAX_ITEMS]) + "\n")


def read_removed():
    if not DENY.exists():
        return []
    try:
        data = json.loads(DENY.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(data, list):
        return []
    ids = []
    seen = set()
    for item in data:
        if isinstance(item, str) and SAFE_ID.match(item) and item not in seen:
            seen.add(item)
            ids.append(item)
    return ids


def remember_removed(item_id):
    if not SAFE_ID.match(item_id):
        return
    ids = read_removed()
    if item_id in ids:
        return
    ids.append(item_id)
    DENY.parent.mkdir(parents=True, exist_ok=True)
    DENY.write_text(json.dumps(ids) + "\n")


def read_store():
    items = read_raw_store()
    changed = False
    migrated = []
    for item in items:
        if not isinstance(item, dict):
            continue
        src = item.get("src")
        item_id = str(item.get("id") or "")
        new_src = materialize_src(item_id, src) if isinstance(src, str) else None
        if new_src and new_src != src:
            item = dict(item)
            item["src"] = new_src
            changed = True
        migrated.append(item)
    if changed:
        write_store(migrated)
    return migrated


def decode_data_url(src):
    match = DATA_URL.match(src.strip())
    if not match:
        return None, None
    mime = match.group(1).lower()
    if mime == "image/jpg":
        mime = "image/jpeg"
    if mime not in ("image/webp", "image/png", "image/jpeg"):
        return None, None
    try:
        raw = base64.b64decode(match.group(2), validate=False)
    except (ValueError, TypeError):
        return None, None
    return mime, raw


def write_webp(item_id, raw, mime):
    if not SAFE_ID.match(item_id) or not raw:
        return None
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception:
        return None
    SIG_DIR.mkdir(parents=True, exist_ok=True)
    dest = SIG_DIR / f"{item_id}.webp"
    rel = SIG_PREFIX + dest.name
    if (
        mime == "image/webp"
        and raw[:4] == b"RIFF"
        and raw[8:12] == b"WEBP"
        and max(image.size) <= MAX_EDGE
        and image.mode in ("RGB", "RGBA")
    ):
        dest.write_bytes(raw)
        return rel
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    if max(image.size) > MAX_EDGE:
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
    image.save(dest, "WEBP", quality=90, method=6)
    return rel


def materialize_src(item_id, src):
    if not SAFE_ID.match(item_id) or not isinstance(src, str):
        return None
    if src.startswith(SIG_PREFIX):
        name = src[len(SIG_PREFIX):]
        if not name or "/" in name or name.startswith("."):
            return None
        path = (SIG_DIR / name).resolve()
        if SIG_DIR.resolve() not in path.parents or not path.is_file():
            return None
        if path.suffix.lower() == ".webp":
            return src
        if path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            return None
        mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
        return write_webp(item_id, path.read_bytes(), mime)
    mime, raw = decode_data_url(src)
    if not raw:
        return None
    return write_webp(item_id, raw, mime)


def clean_item(item):
    if not isinstance(item, dict):
        return None
    kind = item.get("kind")
    src = item.get("src")
    if kind not in ("stamp", "apple") or not isinstance(src, str) or len(src) > MAX_SRC:
        return None
    try:
        cast = int(item.get("castHex") or 0)
    except (TypeError, ValueError):
        cast = 0
    created = item.get("createdAt") or 0
    try:
        created = int(created)
    except (TypeError, ValueError):
        created = 0
    return {
        "id": str(item.get("id") or ""),
        "kind": kind,
        "src": src,
        "castHex": cast,
        "colorName": str(item.get("colorName") or ""),
        "text": str(item.get("text") or "")[:160],
        "createdAt": created,
    }


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/signatures" or path.endswith(".html") or path.endswith("/") or path.endswith("/removed-seals.json"):
            self.send_header("Cache-Control", "no-store")
        elif path.startswith("/" + SIG_PREFIX):
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/api/signatures":
            return super().do_GET()
        body = json.dumps({"items": read_store(), "removed": read_removed()}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/signatures":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_SRC + 4096:
            self.send_error(413)
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            self.send_error(400)
            return
        item = clean_item(payload)
        if not item or not item["id"]:
            self.send_error(400)
            return
        if item["id"] in read_removed():
            body = json.dumps({"id": item["id"], "removed": True}).encode()
            self.send_response(410)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        stored = materialize_src(item["id"], item["src"])
        if stored:
            item["src"] = stored
        items = [row for row in read_store() if row.get("id") != item["id"]]
        items.insert(0, item)
        write_store(items)
        body = json.dumps(item).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_DELETE(self):
        if self.path.split("?", 1)[0] != "/api/signatures":
            self.send_error(404)
            return
        query = parse_qs(urlparse(self.path).query)
        item_id = (query.get("id") or [""])[0]
        if not SAFE_ID.match(item_id):
            self.send_error(400)
            return
        items = read_store()
        kept = [row for row in items if str(row.get("id") or "") != item_id]
        if len(kept) != len(items):
            write_store(kept)
        remember_removed(item_id)
        webp = SIG_DIR / f"{item_id}.webp"
        if webp.is_file():
            try:
                webp.unlink()
            except OSError:
                pass
        body = json.dumps({"id": item_id, "removed": True}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
