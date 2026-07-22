import { getEnv } from "@/cloudflare";
import { listImages, uploadImage, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export function GET(request: Request) { return withApiErrors(() => listImages(request, getEnv())); }
export function POST(request: Request) { return withApiErrors(() => uploadImage(request, getEnv())); }
