import { getEnv } from "@/cloudflare";
import { serveUserAvatar } from "@/users";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ identifier: string }> }) {
  return serveUserAvatar(getEnv(), (await context.params).identifier);
}
