package moe.love.i.verification;

import com.google.inject.Inject;
import com.velocitypowered.api.event.EventTask;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.LoginEvent;
import com.velocitypowered.api.plugin.Plugin;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.slf4j.Logger;

@Plugin(
        id = "i-love-moe-verification",
        name = "i.らぶ.moe Verification",
        version = "1.0.0",
        description = "Issues short-lived web registration codes to online-mode players"
)
public final class VerificationPlugin {
    private static final int MAX_CODE_ATTEMPTS = 3;
    private final Logger logger;
    private final HttpClient httpClient;
    private final URI endpoint;
    private final String token;

    @Inject
    public VerificationPlugin(Logger logger) {
        this.logger = logger;
        var apiBaseUrl = requiredEnvironment("I_LOVE_MOE_API_BASE_URL").replaceAll("/+$", "");
        this.endpoint = URI.create(apiBaseUrl + "/api/internal/minecraft-verification-codes");
        if (!"https".equalsIgnoreCase(this.endpoint.getScheme())) {
            throw new IllegalStateException("I_LOVE_MOE_API_BASE_URL must use HTTPS");
        }
        this.token = requiredEnvironment("I_LOVE_MOE_VERIFICATION_TOKEN");
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    @Subscribe
    public EventTask onLogin(LoginEvent event) {
        return EventTask.withContinuation(continuation ->
                registerCode(event, 1).whenComplete((code, error) -> {
                    if (error != null || code == null) {
                        logger.warn(
                                "Could not issue a verification code for {}: {}",
                                event.getPlayer().getUsername(),
                                error == null ? "request_failed" : error.getClass().getSimpleName()
                        );
                        event.setResult(LoginEvent.ComponentResult.denied(failureMessage()));
                    } else {
                        event.setResult(LoginEvent.ComponentResult.denied(successMessage(code)));
                    }
                    continuation.resume();
                }));
    }

    private CompletableFuture<String> registerCode(LoginEvent event, int attempt) {
        var code = VerificationCode.generate();
        var body = """
                {"code":"%s","minecraftUuid":"%s","minecraftName":"%s"}
                """.formatted(
                code,
                event.getPlayer().getUniqueId(),
                event.getPlayer().getUsername()
        ).trim();
        var request = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(8))
                .header("authorization", "Bearer " + token)
                .header("content-type", "application/json")
                .header("user-agent", "i-love-moe-verification/1.0")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                .thenCompose(response -> {
                    if (response.statusCode() == 200 || response.statusCode() == 201) {
                        return CompletableFuture.completedFuture(code);
                    }
                    if (response.statusCode() == 409 && attempt < MAX_CODE_ATTEMPTS) {
                        return registerCode(event, attempt + 1);
                    }
                    return CompletableFuture.failedFuture(
                            new IllegalStateException("verification_api_" + response.statusCode())
                    );
                });
    }

    private static Component successMessage(String code) {
        return Component.text()
                .append(Component.text("i.らぶ.moe 認証コード\n", NamedTextColor.AQUA))
                .append(Component.text(VerificationCode.display(code), NamedTextColor.GREEN))
                .append(Component.text(
                        "\n\nこのコードをWebの登録画面に入力してください。\n"
                                + "Enter this code on the web registration page.",
                        NamedTextColor.WHITE
                ))
                .build();
    }

    private static Component failureMessage() {
        return Component.text(
                "認証コードを発行できませんでした。しばらくしてから再接続してください。\n"
                        + "Could not issue a verification code. Please reconnect later.",
                NamedTextColor.RED
        );
    }

    private static String requiredEnvironment(String name) {
        var value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value.trim();
    }
}
