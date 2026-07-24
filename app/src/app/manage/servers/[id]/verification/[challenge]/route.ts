import { getEnv } from "@/cloudflare";
import { verifyServerChallenge } from "@/servers";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; challenge: string }> },
) {
  const { id, challenge } = await context.params;
  return verifyServerChallenge(request, getEnv(), id, challenge);
}
