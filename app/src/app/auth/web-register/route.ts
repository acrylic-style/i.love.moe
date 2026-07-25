import { getEnv } from "@/cloudflare";
import { withApiErrors } from "@/service";
import { requestWebRegistration } from "@/web-auth";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(() => requestWebRegistration(request, getEnv()));
}
