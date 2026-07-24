import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasBlockedModerationLabel,
  moderateImage,
  signedRekognitionRequest,
} from "../src/moderation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("image moderation policy", () => {
  it("rejects the Explicit top-level category at 70 percent", () => {
    expect(
      hasBlockedModerationLabel([
        { Name: "Explicit", Confidence: 70, ParentName: "", TaxonomyLevel: 1 },
      ]),
    ).toBe(true);
  });

  it("rejects exposed intimate anatomy at 85 percent", () => {
    expect(
      hasBlockedModerationLabel([
        {
          Name: "Exposed Female Genitalia",
          Confidence: 85,
          ParentName: "Explicit Nudity",
          TaxonomyLevel: 3,
        },
      ]),
    ).toBe(true);
  });

  it("does not reject violence, weapons, or lower-confidence labels", () => {
    expect(
      hasBlockedModerationLabel([
        { Name: "Violence", Confidence: 99, ParentName: "", TaxonomyLevel: 1 },
        { Name: "Weapons", Confidence: 99, ParentName: "", TaxonomyLevel: 1 },
        { Name: "Explicit", Confidence: 69.99, ParentName: "", TaxonomyLevel: 1 },
        {
          Name: "Exposed Male Genitalia",
          Confidence: 84.99,
          ParentName: "Explicit Nudity",
          TaxonomyLevel: 3,
        },
      ]),
    ).toBe(false);
  });
});

describe("Rekognition request signing", () => {
  it("creates a deterministic Tokyo-region SigV4 request", async () => {
    const credentials = {
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "example-secret",
      region: "ap-northeast-1",
    };
    const now = new Date("2026-07-24T01:02:03.000Z");
    const first = await signedRekognitionRequest("{}", credentials, now);
    const second = await signedRekognitionRequest("{}", credentials, now);

    expect(first.url).toBe("https://rekognition.ap-northeast-1.amazonaws.com/");
    expect(first.method).toBe("POST");
    expect(first.headers.get("content-type")).toBe("application/x-amz-json-1.1");
    expect(first.headers.get("x-amz-date")).toBe("20260724T010203Z");
    expect(first.headers.get("x-amz-target")).toBe("RekognitionService.DetectModerationLabels");
    expect(first.headers.get("authorization")).toBe(second.headers.get("authorization"));
    expect(first.headers.get("authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260724\/ap-northeast-1\/rekognition\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/,
    );
  });
});

describe("moderateImage", () => {
  function moderationEnv() {
    const output = vi.fn(async () => ({
      response: () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])),
    }));
    const transform = vi.fn(() => ({ output }));
    const input = vi.fn(() => ({ transform }));
    return {
      env: {
        IMAGE_TRANSFORM: { input },
        AWS_ACCESS_KEY_ID: "AKIDEXAMPLE",
        AWS_SECRET_ACCESS_KEY: "example-secret",
        AWS_REGION: "ap-northeast-1",
      } as unknown as CloudflareEnv,
      input,
      transform,
      output,
    };
  }

  it("uses a bounded JPEG preview and returns the Rekognition decision", async () => {
    const { env, input, transform, output } = moderationEnv();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ModerationLabels: [{ Name: "Explicit", Confidence: 99, ParentName: "", TaxonomyLevel: 1 }],
        ModerationModelVersion: "7.0",
      }),
    );

    await expect(moderateImage(new Uint8Array([1, 2, 3]), env)).resolves.toEqual({
      approved: false,
      modelVersion: "7.0",
    });
    expect(input).toHaveBeenCalledOnce();
    expect(transform).toHaveBeenCalledWith({
      width: 1280,
      height: 1280,
      fit: "scale-down",
    });
    expect(output).toHaveBeenCalledWith({ format: "image/jpeg", quality: 80 });
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    await expect(request.clone().json()).resolves.toMatchObject({ MinConfidence: 70 });
  });

  it("fails closed when Rekognition is unavailable", async () => {
    const { env } = moderationEnv();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          __type: "com.amazon.coral.service#AccessDeniedException",
          Message: "Not authorized to perform rekognition:DetectModerationLabels",
        }),
        {
          status: 503,
          headers: {
            "x-amzn-requestid": "request-123",
          },
        },
      ),
    );

    await expect(moderateImage(new Uint8Array([1, 2, 3]), env)).rejects.toMatchObject({
      reason: "rekognition_http_error",
      diagnostic:
        "status=503 aws_error=AccessDeniedException request_id=request-123 message=Not authorized to perform rekognition:DetectModerationLabels",
    });
  });

  it("identifies missing Rekognition configuration", async () => {
    const { env } = moderationEnv();
    Object.assign(env, { AWS_SECRET_ACCESS_KEY: "" });

    await expect(moderateImage(new Uint8Array([1, 2, 3]), env)).rejects.toMatchObject({
      reason: "configuration_missing",
      diagnostic: "missing=AWS_SECRET_ACCESS_KEY",
    });
  });

  it("identifies an image transform failure", async () => {
    const { env } = moderationEnv();
    env.IMAGE_TRANSFORM.input = vi.fn(() => {
      throw new Error("binding unavailable");
    }) as typeof env.IMAGE_TRANSFORM.input;

    await expect(moderateImage(new Uint8Array([1, 2, 3]), env)).rejects.toMatchObject({
      reason: "image_transform_failed",
      diagnostic: "Error: binding unavailable",
    });
  });
});
