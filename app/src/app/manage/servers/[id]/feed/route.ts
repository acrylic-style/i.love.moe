import { getEnv } from "@/cloudflare";
import { updateServerFeed } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateServerFeed(request, getEnv(), (await context.params).id);
}
