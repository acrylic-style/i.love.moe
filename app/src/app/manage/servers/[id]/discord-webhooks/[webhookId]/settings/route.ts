import { getEnv } from "@/cloudflare";
import { updateServerDiscordWebhookEmbedCopy } from "@/servers";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; webhookId: string }> },
) {
  const { id, webhookId } = await context.params;
  return updateServerDiscordWebhookEmbedCopy(request, getEnv(), id, webhookId);
}
