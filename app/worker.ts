// OpenNext generates this module before Wrangler bundles this entrypoint.
// @ts-expect-error generated module
import openNextWorker from "./.open-next/worker.js";

interface CustomDomain {
  server_id: string;
  status: "active" | "grace";
  server_code: string;
  server_slug: string | null;
}

const CODE_PATH = /^\/(?:raw\/)?([0-9A-Za-z]{8})$/;

export default {
  async fetch(request: Request, env: CloudflareEnv, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const officialHosts = new Set([
      new URL(env.PUBLIC_BASE_URL).hostname.toLowerCase(),
      new URL(env.MINECRAFT_PUBLIC_BASE_URL).hostname.toLowerCase(),
    ]);
    if (officialHosts.has(hostname)) return openNextWorker.fetch(request, env, context);

    const domain = await env.DB.prepare(
      `SELECT d.server_id, d.status, s.code AS server_code, s.slug AS server_slug
        FROM server_custom_domains d JOIN servers s ON s.id = d.server_id
        WHERE d.hostname_ascii = ? AND d.status IN ('active', 'grace')`,
    )
      .bind(hostname)
      .first<CustomDomain>();
    if (!domain) return notFound();
    const identifier = domain.server_slug ?? domain.server_code;
    if (domain.status === "grace")
      return Response.redirect(
        new URL(`/servers/${identifier}`, env.PUBLIC_BASE_URL).toString(),
        308,
      );

    if (url.pathname === "/") {
      url.pathname = `/servers/domain/${encodeURIComponent(hostname)}`;
      return openNextWorker.fetch(copyRequest(request, url), env, context);
    }
    if (/^\/servers\/favorites\/(?:server\/)?[0-9a-f-]{36}$/.test(url.pathname)) {
      const headers = new Headers(request.headers);
      headers.set("x-i-love-moe-custom-domain", hostname);
      headers.set("x-i-love-moe-server-id", domain.server_id);
      return openNextWorker.fetch(new Request(request, { headers }), env, context);
    }
    if (
      url.pathname.startsWith("/_next/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/terms" ||
      url.pathname === "/privacy" ||
      url.pathname === `/servers/assets/${domain.server_id}/icon` ||
      url.pathname === `/servers/assets/${domain.server_id}/banner`
    )
      return openNextWorker.fetch(request, env, context);

    const codeMatch = url.pathname.match(CODE_PATH);
    if (!codeMatch) return notFound();
    const target = await env.DB.prepare(
      `SELECT sl.target_type, sl.target_id,
        CASE WHEN sl.target_type = 'image' THEN i.server_id ELSE a.server_id END AS server_id,
        CASE WHEN sl.target_type = 'image' THEN i.discoverability ELSE a.discoverability END AS discoverability,
        CASE WHEN sl.target_type = 'image' THEN i.visibility ELSE a.visibility END AS visibility
      FROM short_links sl
      LEFT JOIN images i ON sl.target_type = 'image' AND i.id = sl.target_id
      LEFT JOIN albums a ON sl.target_type = 'album' AND a.id = sl.target_id
      WHERE sl.code = ? AND sl.retired_at IS NULL`,
    )
      .bind(codeMatch[1])
      .first<{
        target_type: "image" | "album";
        target_id: string;
        server_id: string | null;
        discoverability: string;
        visibility: string;
      }>();
    const albumCode = url.searchParams.get("album");
    const albumGrant =
      target?.target_type === "image" && albumCode
        ? await env.DB.prepare(
            `SELECT 1 AS allowed FROM short_links sl
              JOIN albums a ON a.id = sl.target_id AND sl.target_type = 'album'
              JOIN album_images ai ON ai.album_id = a.id
              WHERE sl.code = ? AND sl.retired_at IS NULL AND ai.image_id = ?
                AND a.server_id = ? AND a.discoverability = 'public'
                AND a.visibility = 'unlisted' AND a.deleted_at IS NULL`,
          )
            .bind(albumCode, target.target_id, domain.server_id)
            .first()
        : null;
    const directlyAllowed =
      target?.server_id === domain.server_id &&
      target.discoverability === "public" &&
      target.visibility === "unlisted";
    if (
      !(directlyAllowed || albumGrant) ||
      (url.pathname.startsWith("/raw/") && target?.target_type !== "image")
    )
      return notFound();
    const headers = new Headers(request.headers);
    headers.set("x-i-love-moe-custom-domain", hostname);
    headers.set("x-i-love-moe-server-id", domain.server_id);
    return openNextWorker.fetch(new Request(request, { headers }), env, context);
  },
};

function copyRequest(request: Request, url: URL): Request {
  return new Request(url, request);
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
