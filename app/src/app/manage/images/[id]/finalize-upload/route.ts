import { getEnv } from "@/cloudflare";
import { finalizeManagedImageUpload, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => finalizeManagedImageUpload(request, getEnv(), id));
}
