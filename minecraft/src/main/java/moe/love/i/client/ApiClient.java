package moe.love.i.client;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

final class ApiClient {
    private static final Gson GSON = new Gson();
    private static final long MAX_IMAGE_BYTES = 10L * 1024L * 1024L;

    private final ModConfig config;
    private final URI baseUri;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private CompletableFuture<String> registration;

    ApiClient(ModConfig config) {
        this.config = config;
        this.baseUri = UriUtil.toHttpUri(config.baseUrl());
    }

    CompletableFuture<UploadResult> upload(Path image) {
        try {
            long size = Files.size(image);
            if (size == 0 || size > MAX_IMAGE_BYTES) {
                return CompletableFuture.failedFuture(new ApiException("image_too_large"));
            }
        } catch (IOException exception) {
            return CompletableFuture.failedFuture(exception);
        }

        return deviceToken().thenCompose(token -> sendUpload(image, token, true));
    }

    CompletableFuture<Void> delete(String imageId) {
        return deviceToken().thenCompose(token -> {
            HttpRequest request = authenticatedRequest("/api/v1/images/" + imageId, token)
                    .DELETE()
                    .build();
            return send(request).thenApply(response -> {
                requireStatus(response, 204);
                return null;
            });
        });
    }

    CompletableFuture<Void> sendMagicLink(String email) {
        return deviceToken().thenCompose(token -> {
            JsonObject body = new JsonObject();
            body.addProperty("email", email);
            HttpRequest request = authenticatedRequest("/api/v1/auth/magic-links", token)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body)))
                    .build();
            return send(request).thenApply(response -> {
                requireStatus(response, 202);
                return null;
            });
        });
    }

    private CompletableFuture<UploadResult> sendUpload(Path image, String token, boolean retryAuthentication) {
        HttpRequest request;
        try {
            request = authenticatedRequest("/api/v1/images", token)
                    .header("content-type", "image/png")
                    .POST(HttpRequest.BodyPublishers.ofFile(image))
                    .build();
        } catch (IOException exception) {
            return CompletableFuture.failedFuture(exception);
        }
        return send(request).thenCompose(response -> {
            if (response.statusCode() == 401 && retryAuthentication) {
                config.clearDeviceToken();
                synchronized (this) {
                    registration = null;
                }
                return deviceToken().thenCompose(newToken -> sendUpload(image, newToken, false));
            }
            requireStatus(response, 201);
            UploadResult result = GSON.fromJson(response.body(), UploadResult.class);
            if (result == null || result.id == null || result.url == null) {
                throw new CompletionException(new ApiException("invalid_response"));
            }
            return CompletableFuture.completedFuture(result);
        });
    }

    private synchronized CompletableFuture<String> deviceToken() {
        if (config.deviceToken != null && !config.deviceToken.isBlank()) {
            return CompletableFuture.completedFuture(config.deviceToken);
        }
        if (registration != null) return registration;

        HttpRequest request = HttpRequest.newBuilder(endpoint("/api/v1/devices"))
                .timeout(Duration.ofSeconds(20))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        registration = send(request).thenApply(response -> {
            requireStatus(response, 201);
            DeviceResult result = GSON.fromJson(response.body(), DeviceResult.class);
            if (result == null || result.token == null || result.token.isBlank()) {
                throw new CompletionException(new ApiException("invalid_response"));
            }
            config.setDeviceToken(result.token);
            return result.token;
        });
        registration.whenComplete((ignored, error) -> {
            if (error != null) {
                synchronized (ApiClient.this) {
                    registration = null;
                }
            }
        });
        return registration;
    }

    private HttpRequest.Builder authenticatedRequest(String path, String token) {
        return HttpRequest.newBuilder(endpoint(path))
                .timeout(Duration.ofSeconds(30))
                .header("authorization", "Bearer " + token);
    }

    private URI endpoint(String path) {
        return baseUri.resolve(path);
    }

    private CompletableFuture<HttpResponse<String>> send(HttpRequest request) {
        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(error -> {
                    Throwable cause = error instanceof CompletionException && error.getCause() != null ? error.getCause() : error;
                    throw new CompletionException(cause);
                });
    }

    private static void requireStatus(HttpResponse<String> response, int expected) {
        if (response.statusCode() == expected) return;
        String code = "http_" + response.statusCode();
        try {
            ErrorResult error = GSON.fromJson(response.body(), ErrorResult.class);
            if (error != null && error.error != null) code = error.error;
        } catch (RuntimeException ignored) {
        }
        throw new CompletionException(new ApiException(code));
    }

    static String humanReadableError(Throwable error) {
        Throwable current = error;
        while (current instanceof CompletionException && current.getCause() != null) current = current.getCause();
        if (current instanceof ApiException api) {
            return switch (api.code) {
                case "image_too_large" -> "画像が10MBを超えています";
                case "invalid_png", "invalid_image_type" -> "PNG画像として認識できません";
                case "upload_limit_reached" -> "直近30日のアップロード上限に達しています";
                case "invalid_email" -> "メールアドレスをご確認ください";
                case "too_many_requests" -> "しばらく待ってからお試しください";
                case "email_unavailable" -> "ログインメールを送信できませんでした";
                case "unauthorized" -> "端末認証に失敗しました";
                case "not_found" -> "画像が見つかりません";
                default -> "サーバーとの通信に失敗しました (" + api.code + ")";
            };
        }
        return "サーバーとの通信に失敗しました";
    }

    static final class UploadResult {
        String id;
        String url;
        String expiresAt;
    }

    private static final class DeviceResult {
        String token;
    }

    private static final class ErrorResult {
        String error;
    }

    private static final class ApiException extends RuntimeException {
        private final String code;

        private ApiException(String code) {
            super(code);
            this.code = code;
        }
    }
}
