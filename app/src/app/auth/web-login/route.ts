import { getEnv } from "@/cloudflare";
import { withApiErrors } from "@/service";
import { requestWebLogin } from "@/web-auth";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(() => requestWebLogin(request, getEnv()));
}
