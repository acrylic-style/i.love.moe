import { getEnv } from "@/cloudflare";
import { removeServerEditor } from "@/servers";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await context.params;
  return removeServerEditor(request, getEnv(), id, userId);
}

export const POST = DELETE;
