import { getEnv } from "@/cloudflare";
import { registerDevice, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export function POST(request: Request) { return withApiErrors(() => registerDevice(request, getEnv())); }
