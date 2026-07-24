import { getEnv } from "@/cloudflare";
import { updateServerProfile } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateServerProfile(request, getEnv(), (await context.params).id);
}
