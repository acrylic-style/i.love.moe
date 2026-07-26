import { getEnv } from "@/cloudflare";
import { revokeServerApiToken } from "@/server-api";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; tokenId: string }> },
) {
  const { id, tokenId } = await params;
  return withApiErrors(() => revokeServerApiToken(request, getEnv(), id, tokenId));
}
