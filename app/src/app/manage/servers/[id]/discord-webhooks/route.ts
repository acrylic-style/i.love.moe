import { getEnv } from "@/cloudflare";
import { addServerDiscordWebhook } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return addServerDiscordWebhook(request, getEnv(), (await context.params).id);
}
