import { getEnv } from "@/cloudflare";
import { acceptServerEditorInvitation } from "@/servers";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return acceptServerEditorInvitation(request, getEnv(), (await context.params).token);
}
