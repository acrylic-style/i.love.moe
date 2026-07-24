const AWS_SERVICE = "rekognition";
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const MODERATION_TIMEOUT_MS = 10_000;
const MAX_REKOGNITION_BYTES = 5 * 1024 * 1024;
const EXPLICIT_CONFIDENCE = 70;
const EXPOSED_INTIMATE_CONFIDENCE = 85;

interface ModerationLabel {
  Confidence?: number;
  Name?: string;
  ParentName?: string;
  TaxonomyLevel?: number;
}

interface RekognitionResponse {
  ModerationLabels?: ModerationLabel[];
  ModerationModelVersion?: string;
}

export interface ImageModerationResult {
  approved: boolean;
  modelVersion: string;
}

export type ModerationUnavailableReason =
  | "configuration_missing"
  | "image_transform_failed"
  | "preview_empty"
  | "preview_too_large"
  | "rekognition_timeout"
  | "rekognition_network_error"
  | "rekognition_http_error"
  | "invalid_rekognition_response";

export class ModerationUnavailableError extends Error {
  constructor(
    readonly reason: ModerationUnavailableReason,
    readonly diagnostic?: string,
  ) {
    super(`moderation_unavailable:${reason}${diagnostic ? ` (${diagnostic})` : ""}`);
    this.name = "ModerationUnavailableError";
  }
}

export async function moderateImage(
  image: Uint8Array,
  env: CloudflareEnv,
): Promise<ImageModerationResult> {
  let preview: Uint8Array;
  try {
    const source = new Uint8Array(image.byteLength);
    source.set(image);
    const transformed = await env.IMAGE_TRANSFORM.input(new Response(source.buffer).body!)
      .transform({ width: 1280, height: 1280, fit: "scale-down" })
      .output({ format: "image/jpeg", quality: 80 });
    preview = new Uint8Array(await transformed.response().arrayBuffer());
  } catch (error) {
    if (error instanceof ModerationUnavailableError) throw error;
    throw new ModerationUnavailableError("image_transform_failed", errorSummary(error));
  }
  if (preview.byteLength === 0) throw new ModerationUnavailableError("preview_empty");
  if (preview.byteLength > MAX_REKOGNITION_BYTES) {
    throw new ModerationUnavailableError("preview_too_large", `bytes=${preview.byteLength}`);
  }

  const payload = JSON.stringify({
    Image: { Bytes: encodeBase64(preview) },
    MinConfidence: EXPLICIT_CONFIDENCE,
  });
  const request = await signedRekognitionRequest(payload, {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
  });

  let response: Response;
  try {
    response = await fetch(request, { signal: AbortSignal.timeout(MODERATION_TIMEOUT_MS) });
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "rekognition_timeout"
        : "rekognition_network_error";
    throw new ModerationUnavailableError(reason, errorSummary(error));
  }
  if (!response.ok) {
    const responseBody = await response.text();
    const awsError = parseAwsError(responseBody);
    const awsErrorType =
      response.headers.get("x-amzn-errortype")?.split(":", 1)[0] ?? awsError.type;
    const requestId =
      response.headers.get("x-amzn-requestid") ??
      response.headers.get("x-amz-request-id") ??
      awsError.requestId;
    throw new ModerationUnavailableError(
      "rekognition_http_error",
      [
        `status=${response.status}`,
        awsErrorType ? `aws_error=${awsErrorType}` : null,
        requestId ? `request_id=${requestId}` : null,
        awsError.message ? `message=${awsError.message}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  let result: RekognitionResponse;
  try {
    result = (await response.json()) as RekognitionResponse;
  } catch (error) {
    throw new ModerationUnavailableError("invalid_rekognition_response", errorSummary(error));
  }
  if (
    !Array.isArray(result.ModerationLabels) ||
    typeof result.ModerationModelVersion !== "string"
  ) {
    throw new ModerationUnavailableError("invalid_rekognition_response");
  }
  return {
    approved: !hasBlockedModerationLabel(result.ModerationLabels),
    modelVersion: result.ModerationModelVersion,
  };
}

export function hasBlockedModerationLabel(labels: ModerationLabel[]): boolean {
  return labels.some((label) => {
    const confidence = label.Confidence ?? 0;
    if (label.TaxonomyLevel === 1 && label.Name === "Explicit" && confidence >= EXPLICIT_CONFIDENCE)
      return true;
    const name = label.Name ?? "";
    return (
      confidence >= EXPOSED_INTIMATE_CONFIDENCE &&
      /^Exposed\b/i.test(name) &&
      /(genitalia|nipple|buttocks|anus)/i.test(name)
    );
  });
}

export async function signedRekognitionRequest(
  payload: string,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  },
  now = new Date(),
): Promise<Request> {
  const missing = [
    !credentials.accessKeyId ? "AWS_ACCESS_KEY_ID" : null,
    !credentials.secretAccessKey ? "AWS_SECRET_ACCESS_KEY" : null,
    !credentials.region ? "AWS_REGION" : null,
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new ModerationUnavailableError("configuration_missing", `missing=${missing.join(",")}`);
  }
  const host = `rekognition.${credentials.region}.amazonaws.com`;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(new TextEncoder().encode(payload));
  const canonicalHeaders =
    `content-type:application/x-amz-json-1.1\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:RekognitionService.DetectModerationLabels\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date;x-amz-target";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join(
    "\n",
  );
  const scope = `${shortDate}/${credentials.region}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    scope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");
  const dateKey = await hmac(
    new TextEncoder().encode(`AWS4${credentials.secretAccessKey}`),
    shortDate,
  );
  const regionKey = await hmac(dateKey, credentials.region);
  const serviceKey = await hmac(regionKey, AWS_SERVICE);
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = bytesToHex(await hmac(signingKey, stringToSign));

  return new Request(`https://${host}/`, {
    method: "POST",
    headers: {
      authorization:
        `${AWS_ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": "application/x-amz-json-1.1",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "x-amz-target": "RekognitionService.DetectModerationLabels",
    },
    body: payload,
  });
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", value as BufferSource)));
}

async function hmac(keyBytes: Uint8Array, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value) as BufferSource),
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function errorSummary(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 500);
  return String(error).slice(0, 500);
}

function parseAwsError(body: string): {
  type: string | null;
  message: string | null;
  requestId: string | null;
} {
  try {
    const value = JSON.parse(body) as Record<string, unknown>;
    const rawType = value.__type ?? value.code ?? value.Code;
    const rawMessage = value.message ?? value.Message;
    const rawRequestId = value.requestId ?? value.RequestId;
    return {
      type:
        typeof rawType === "string" ? (rawType.split("#").at(-1)?.split(":", 1)[0] ?? null) : null,
      message:
        typeof rawMessage === "string"
          ? rawMessage.replace(/\s+/g, " ").trim().slice(0, 500)
          : null,
      requestId: typeof rawRequestId === "string" ? rawRequestId.slice(0, 200) : null,
    };
  } catch {
    return {
      type: null,
      message: body.replace(/\s+/g, " ").trim().slice(0, 500) || null,
      requestId: null,
    };
  }
}
