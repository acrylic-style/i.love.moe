import { getEnv } from "@/cloudflare";
import { addServerAddress } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return addServerAddress(request, getEnv(), (await context.params).id);
}
