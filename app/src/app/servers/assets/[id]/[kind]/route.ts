import { getEnv } from "@/cloudflare";
import { serveServerBranding } from "@/servers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await context.params;
  return serveServerBranding(getEnv(), id, kind);
}
