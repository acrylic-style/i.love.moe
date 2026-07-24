import { getEnv } from "@/cloudflare";
import { createVerificationChallenge } from "@/servers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return createVerificationChallenge(
    request,
    getEnv(),
    (await context.params).id,
    new URL(request.url).searchParams.get("addressId") ?? undefined,
  );
}
