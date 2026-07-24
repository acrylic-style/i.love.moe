import { getEnv } from "@/cloudflare";
import { removeServerAddress } from "@/servers";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; addressId: string }> },
) {
  const { id, addressId } = await context.params;
  return removeServerAddress(request, getEnv(), id, addressId);
}
