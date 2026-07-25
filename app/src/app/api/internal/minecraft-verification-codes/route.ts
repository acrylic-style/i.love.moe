import { getEnv } from "@/cloudflare";
import { withApiErrors } from "@/service";
import { registerMinecraftVerificationCode } from "@/web-auth";

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(() => registerMinecraftVerificationCode(request, getEnv()));
}
