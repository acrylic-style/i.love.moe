import { getEnv } from "@/cloudflare";
import { authenticateSession, withApiErrors } from "@/service";
import {
  canManageServer,
  ensureServerForAddress,
  parseServerAddress,
  unclaimedServerById,
} from "@/servers";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withApiErrors(async () => {
    const env = getEnv();
    const session = await authenticateSession(request, env);
    if (!session) return new Response(null, { status: 404 });
    const form = await request.formData();
    const rawAddress = form.get("address");
    const address = typeof rawAddress === "string" ? rawAddress.trim() : "";
    const parsed = parseServerAddress(address);
    if (!parsed) return backToEntry(request, address, "invalid_address");

    const existing = await env.DB.prepare(
      `SELECT a.server_id, s.owner_user_id FROM server_addresses a
        JOIN servers s ON s.id = a.server_id
        WHERE a.host_ascii = ? AND a.port = ?`,
    )
      .bind(parsed.hostAscii, parsed.port)
      .first<{ server_id: string; owner_user_id: string | null }>();
    if (existing) {
      if (await canManageServer(env, existing.server_id, session.user_id))
        return redirectTo(request, `/manage/servers/${existing.server_id}`);
      if (existing.owner_user_id) return backToEntry(request, address, "already_claimed");
      return redirectTo(request, `/manage/servers/${existing.server_id}/claim`);
    }

    const serverId = await ensureServerForAddress(env, parsed.displayAddress);
    if (!serverId) return backToEntry(request, address, "already_claimed");
    if (await canManageServer(env, serverId, session.user_id))
      return redirectTo(request, `/manage/servers/${serverId}`);
    if (!(await unclaimedServerById(env, serverId)))
      return backToEntry(request, address, "already_claimed");
    return redirectTo(request, `/manage/servers/${serverId}/claim`);
  });
}

function backToEntry(request: Request, address: string, error: string): Response {
  const url = new URL("/manage/servers/claim", request.url);
  url.searchParams.set("address", address);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}

function redirectTo(request: Request, pathname: string): Response {
  return Response.redirect(new URL(pathname, request.url), 303);
}
