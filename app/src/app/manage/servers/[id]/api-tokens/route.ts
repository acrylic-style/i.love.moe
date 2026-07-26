import { getEnv } from "@/cloudflare";
import { createServerApiToken } from "@/server-api";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => createServerApiToken(request, getEnv(), id));
}
