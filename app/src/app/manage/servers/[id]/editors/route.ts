import { getEnv } from "@/cloudflare";
import { inviteServerEditor } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return inviteServerEditor(request, getEnv(), (await context.params).id);
}
