package moe.love.i.client;

import com.google.gson.Gson;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
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

    CompletableFuture<UploadResult> upload(Path image, ServerMetadata serverMetadata, boolean automatic) {
        try {
            long size = Files.size(image);
            if (size == 0 || size > MAX_IMAGE_BYTES) {
                return CompletableFuture.failedFuture(new ApiException("image_too_large"));
            }
        } catch (IOException exception) {
            return CompletableFuture.failedFuture(exception);
        }

        return deviceToken().thenCompose(token -> sendUpload(image, serverMetadata, automatic, token, true));
    }

    CompletableFuture<AccountResult> account() {
        return deviceToken().thenCompose(token -> sendAccount(token, true));
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

    CompletableFuture<Void> publish(String imageId) {
        return deviceToken().thenCompose(token -> {
            HttpRequest request = authenticatedRequest("/api/v1/images/" + imageId + "/publish", token)
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();
            return send(request).thenApply(response -> {
                requireStatus(response, 200);
                return null;
            });
        });
    }

    CompletableFuture<Void> rename(String imageId, String title) {
        return deviceToken().thenCompose(token -> {
            String body = "title=" + URLEncoder.encode(title, StandardCharsets.UTF_8);
            HttpRequest request = authenticatedRequest("/api/v1/images/" + imageId + "/rename", token)
                    .header("content-type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            return send(request).thenApply(response -> {
                requireStatus(response, 200);
                return null;
            });
        });
    }

    CompletableFuture<LoginResult> createBrowserLogin() {
        return deviceToken().thenCompose(token -> sendBrowserLogin(token, true));
    }

    private CompletableFuture<UploadResult> sendUpload(Path image, ServerMetadata serverMetadata, boolean automatic, String token, boolean retryAuthentication) {
        HttpRequest request;
        try {
            HttpRequest.Builder builder = serverMetadata.addHeaders(authenticatedRequest("/api/v1/images", token)
                    .header("content-type", "image/png"));
            if (automatic) builder.header("x-i-love-moe-auto-upload", "true");
            request = builder
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
                return deviceToken().thenCompose(newToken -> sendUpload(image, serverMetadata, automatic, newToken, false));
            }
            requireStatus(response, 201);
            UploadResult result = GSON.fromJson(response.body(), UploadResult.class);
            if (result == null || result.id == null || result.url == null) {
                throw new CompletionException(new ApiException("invalid_response"));
            }
            return CompletableFuture.completedFuture(result);
        });
    }

    private CompletableFuture<AccountResult> sendAccount(String token, boolean retryAuthentication) {
        HttpRequest request = authenticatedRequest("/api/v1/account", token).GET().build();
        return send(request).thenCompose(response -> {
            if (response.statusCode() == 401 && retryAuthentication) {
                config.clearDeviceToken();
                synchronized (this) {
                    registration = null;
                }
                return deviceToken().thenCompose(newToken -> sendAccount(newToken, false));
            }
            requireStatus(response, 200);
            AccountResult result = GSON.fromJson(response.body(), AccountResult.class);
            if (result == null || result.plan == null) throw new CompletionException(new ApiException("invalid_response"));
            return CompletableFuture.completedFuture(result);
        });
    }

    private CompletableFuture<LoginResult> sendBrowserLogin(String token, boolean retryAuthentication) {
        HttpRequest request = authenticatedRequest("/api/v1/auth/browser-login", token)
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        return send(request).thenCompose(response -> {
            if (response.statusCode() == 401 && retryAuthentication) {
                config.clearDeviceToken();
                synchronized (this) {
                    registration = null;
                }
                return deviceToken().thenCompose(newToken -> sendBrowserLogin(newToken, false));
            }
            requireStatus(response, 201);
            LoginResult result = GSON.fromJson(response.body(), LoginResult.class);
            if (result == null || result.url == null || result.url.isBlank()) {
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

    static String errorCode(Throwable error) {
        Throwable current = error;
        while (current instanceof CompletionException && current.getCause() != null) current = current.getCause();
        return current instanceof ApiException api ? api.code : null;
    }

    static final class UploadResult {
        String id;
        String url;
        String minecraftUrl;
        String expiresAt;

        String displayUrl() {
            return minecraftUrl == null || minecraftUrl.isBlank() ? url : minecraftUrl;
        }
    }

    static final class AccountResult {
        String plan;
        boolean autoUploadAllowed;
    }

    static final class LoginResult {
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
