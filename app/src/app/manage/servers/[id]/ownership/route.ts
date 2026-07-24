import { getEnv } from "@/cloudflare";
import { requestServerOwnershipTransfer } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return requestServerOwnershipTransfer(request, getEnv(), (await context.params).id);
}
