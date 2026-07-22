import { getEnv } from "@/cloudflare";
import { updateManagedImageVisibility, withApiErrors } from "@/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => updateManagedImageVisibility(request, getEnv(), id));
}
