import { getEnv } from "@/cloudflare";
import { enableServerDiscordWebhook, removeServerDiscordWebhook } from "@/servers";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; webhookId: string }> },
) {
  const { id, webhookId } = await context.params;
  return enableServerDiscordWebhook(request, getEnv(), id, webhookId);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; webhookId: string }> },
) {
  const { id, webhookId } = await context.params;
  return removeServerDiscordWebhook(request, getEnv(), id, webhookId);
}
