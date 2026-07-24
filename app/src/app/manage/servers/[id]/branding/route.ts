import { getEnv } from "@/cloudflare";
import { uploadServerBranding } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return uploadServerBranding(request, getEnv(), (await context.params).id);
}
