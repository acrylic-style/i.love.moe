import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { LocalDateTime } from "@/components/local-date-time";
import { findActiveImageByCode, SHORT_CODE_PATTERN } from "@/service";

export const dynamic = "force-dynamic";

export default async function ViewerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!SHORT_CODE_PATTERN.test(code)) notFound();
  const image = await findActiveImageByCode(getEnv(), code);
  if (!image) notFound();
  const expires = new Date(image.expires_at).toISOString();
  const size = image.byte_size >= 1024 * 1024
    ? `${(image.byte_size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(image.byte_size / 1024)} KB`;
  return (
    <main className="card viewer">
      {/* Uploaded PNG dimensions are validated server-side; Next image optimization is unnecessary here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/raw/${code}`} width={image.width} height={image.height} alt="Minecraft screenshot" />
      <div className="meta"><span>{image.width} × {image.height}</span><span>{size}</span><span><LocalDateTime value={expires} />まで</span></div>
    </main>
  );
}
