import { getEnv } from "@/cloudflare";
import { createTag } from "@/library";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiErrors(() => createTag(request, getEnv()));
}
