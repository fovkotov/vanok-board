/**
 * Shared custom-seal catalog for the GitHub Pages teaser.
 *
 * GET    /signatures            -> { items: [...], removed: [ids] }
 * POST   /signatures            -> stores one seal (data: URL image), 410 if the id was deleted
 * DELETE /signatures?id=...     -> deletes a seal and remembers the id (presets included)
 * GET    /signatures/img/:id    -> the seal image
 *
 * One SQLite-backed Durable Object holds everything so every device reads
 * the same list right after a write.
 */
import { DurableObject } from "cloudflare:workers";

const SEED_REMOVED = [
  "sig-mvyexo5j-xmsh",
  "sig-mvyeparj-23ga",
  "sig-mvspqm84-28xa",
  "sig-mvyevic1-q47y",
  "sig-mvyet5rf-cvjd",
  "sig-mvjwhluk-rnq4",
  "sig-mvipeu03-ril8",
  "sig-mvipa8wh-qk2b",
  "sig-mvioj76c-6nf4",
  "sig-mvilqgeo-bzqn",
  "sig-mvil8zgt-atu1",
  "sig-mvijbazk-aqoh",
  "sig-mvie2wct-9m0d",
  "sig-mvsoe8zx-x29k",
  "sig-mvliy3q0-h2te",
  "sig-mvlix8p8-vjgh",
  "sig-mvjwzlh2-7pu1",
  "sig-mvjwevaw-74n1",
  "sig-mvpnipgg-dbsd",
  "preset-classic-tpl-gren-6",
];
const MAX_ITEMS = 500;
const MAX_SRC = 1_500_000;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const IMAGE_TYPES = ["image/webp", "image/png", "image/jpeg", "image/svg+xml"];

function allowedOrigin(origin) {
  if (!origin) return "";
  if (
    origin === "https://fovkotov.github.io" ||
    origin === "https://vanokregular.com" ||
    origin === "https://www.vanokregular.com"
  ) {
    return origin;
  }
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "";
}

function corsHeaders(request) {
  const origin = allowedOrigin(request.headers.get("origin"));
  const headers = { vary: "origin" };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, DELETE, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-max-age"] = "86400";
  }
  return headers;
}

function json(request, data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...corsHeaders(request),
    },
  });
}

function decodeDataUrl(src) {
  const match = /^data:([a-z0-9.+/-]+)(;[^,]*)?,(.*)$/is.exec(src);
  if (!match) return null;
  const type = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  if (!IMAGE_TYPES.includes(type)) return null;
  const params = (match[2] || "").toLowerCase();
  try {
    if (params.includes(";base64")) {
      const binary = atob(match[3].replace(/\s+/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { type, bytes };
    }
    return { type, bytes: new TextEncoder().encode(decodeURIComponent(match[3])) };
  } catch {
    return null;
  }
}

function clean(item) {
  if (!item || (item.kind !== "stamp" && item.kind !== "apple")) return null;
  const id = String(item.id || "");
  if (!SAFE_ID.test(id)) return null;
  if (typeof item.src !== "string" || item.src.length > MAX_SRC) return null;
  const image = decodeDataUrl(item.src);
  if (!image || !image.bytes.length) return null;
  return {
    id,
    kind: item.kind,
    castHex: Number(item.castHex) || 0,
    colorName: String(item.colorName || "").slice(0, 24),
    text: String(item.text || "").slice(0, 160),
    createdAt: Number(item.createdAt) || Date.now(),
    type: image.type,
    bytes: image.bytes,
  };
}

export class SealCatalog extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS seals (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      cast_hex INTEGER NOT NULL,
      color_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      type TEXT NOT NULL,
      data BLOB NOT NULL
    )`);
    this.sql.exec("CREATE TABLE IF NOT EXISTS removed (id TEXT PRIMARY KEY, at INTEGER NOT NULL)");
    // Deletes made before this worker existed. New ones are written by DELETE.
    for (const id of SEED_REMOVED) {
      this.sql.exec("INSERT OR IGNORE INTO removed (id, at) VALUES (?, ?)", id, 0);
    }
  }

  state() {
    const items = this.sql
      .exec("SELECT id, kind, cast_hex, color_name, text, created_at FROM seals ORDER BY created_at DESC")
      .toArray()
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        castHex: row.cast_hex,
        colorName: row.color_name,
        text: row.text,
        createdAt: row.created_at,
      }));
    const removed = this.sql.exec("SELECT id FROM removed").toArray().map((row) => row.id);
    return { items, removed };
  }

  image(id) {
    const rows = this.sql.exec("SELECT type, data FROM seals WHERE id = ?", id).toArray();
    if (!rows.length) return null;
    return { type: rows[0].type, bytes: rows[0].data };
  }

  add(item) {
    if (this.sql.exec("SELECT 1 FROM removed WHERE id = ?", item.id).toArray().length) {
      return { status: 410 };
    }
    const exists = this.sql.exec("SELECT 1 FROM seals WHERE id = ?", item.id).toArray().length > 0;
    if (!exists) {
      const count = this.sql.exec("SELECT COUNT(*) AS n FROM seals").one().n;
      if (count >= MAX_ITEMS) return { status: 507 };
      this.sql.exec(
        "INSERT INTO seals (id, kind, cast_hex, color_name, text, created_at, type, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        item.id, item.kind, item.castHex, item.colorName, item.text, item.createdAt, item.type,
        item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength)
      );
    }
    return { status: 200 };
  }

  remove(id) {
    this.sql.exec("DELETE FROM seals WHERE id = ?", id);
    this.sql.exec("INSERT OR IGNORE INTO removed (id, at) VALUES (?, ?)", id, Date.now());
  }
}

function withSrc(origin, item) {
  return { ...item, src: origin + "/signatures/img/" + encodeURIComponent(item.id) + "?v=" + item.createdAt };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    const path = url.pathname.replace(/^\/api/, "");
    const catalog = env.SEALS.get(env.SEALS.idFromName("catalog"));

    if (path.startsWith("/signatures/img/") && (request.method === "GET" || request.method === "HEAD")) {
      const id = decodeURIComponent(path.slice("/signatures/img/".length));
      if (!SAFE_ID.test(id)) return json(request, { error: "id" }, 400);
      const image = await catalog.image(id);
      if (!image) return json(request, { error: "not found" }, 404);
      return new Response(request.method === "HEAD" ? null : image.bytes, {
        headers: {
          "content-type": image.type,
          "cache-control": "public, max-age=31536000, immutable",
          ...corsHeaders(request),
        },
      });
    }

    if (path !== "/signatures") return json(request, { error: "not found" }, 404);

    if (request.method === "GET") {
      const state = await catalog.state();
      return json(request, { items: state.items.map((item) => withSrc(url.origin, item)), removed: state.removed });
    }

    if (request.method === "DELETE") {
      const id = url.searchParams.get("id") || "";
      if (!SAFE_ID.test(id)) return json(request, { error: "id" }, 400);
      await catalog.remove(id);
      return json(request, { id, removed: true });
    }

    if (request.method !== "POST") return json(request, { error: "method" }, 405);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_SRC + 8192) return json(request, { error: "too large" }, 413);
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(request, { error: "json" }, 400);
    }
    const item = clean(payload);
    if (!item) return json(request, { error: "item" }, 400);
    const result = await catalog.add(item);
    if (result.status === 410) return json(request, { id: item.id, removed: true }, 410);
    if (result.status !== 200) return json(request, { error: "full" }, result.status);
    const { bytes, type, ...meta } = item;
    return json(request, withSrc(url.origin, meta));
  },
};
