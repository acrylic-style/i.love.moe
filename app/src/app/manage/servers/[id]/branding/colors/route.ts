import { getEnv } from "@/cloudflare";
import { updateServerBrandingColors } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateServerBrandingColors(request, getEnv(), (await context.params).id);
}
