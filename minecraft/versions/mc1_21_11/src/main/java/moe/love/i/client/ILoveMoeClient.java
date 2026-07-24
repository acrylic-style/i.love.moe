package moe.love.i.client;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class ILoveMoeClient implements ClientModInitializer {
    public static final Logger LOGGER = LoggerFactory.getLogger("i-love-moe");
    private static final Map<String, PendingUpload> PENDING_UPLOADS = new ConcurrentHashMap<>();
    private static ModConfig config;
    private static ApiClient api;

    @Override
    public void onInitializeClient() {
        config = ModConfig.load(FabricLoader.getInstance().getConfigDir().resolve("i-love-moe.json"));
        api = new ApiClient(config);
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> dispatcher.register(
                ClientCommandManager.literal("ilovemoe")
                        .then(ClientCommandManager.literal("upload")
                                .then(ClientCommandManager.argument("id", StringArgumentType.word())
                                        .executes(context -> upload(StringArgumentType.getString(context, "id")))))
                        .then(ClientCommandManager.literal("delete")
                                .then(ClientCommandManager.argument("id", StringArgumentType.word())
                                        .executes(context -> delete(StringArgumentType.getString(context, "id")))))
                        .then(ClientCommandManager.literal("publish")
                                .then(ClientCommandManager.argument("id", StringArgumentType.word())
                                        .executes(context -> publish(StringArgumentType.getString(context, "id")))))
                        .then(ClientCommandManager.literal("rename")
                                .then(ClientCommandManager.argument("id", StringArgumentType.word())
                                        .then(ClientCommandManager.argument("title", StringArgumentType.greedyString())
                                                .executes(context -> rename(
                                                        StringArgumentType.getString(context, "id"),
                                                        StringArgumentType.getString(context, "title"))))))
                        .then(ClientCommandManager.literal("login").executes(context -> login()))
                        .then(ClientCommandManager.literal("auto-upload")
                                .executes(context -> showAutoUploadStatus())
                                .then(ClientCommandManager.literal("on").executes(context -> setAutoUpload(true)))
                                .then(ClientCommandManager.literal("off").executes(context -> setAutoUpload(false))))
                        .then(ClientCommandManager.literal("manage").executes(context -> showManageLink()))
        ));
    }

    public static void onScreenshotSaved(Path screenshot) {
        Path normalized = screenshot.toAbsolutePath().normalize();
        MinecraftClient.getInstance().execute(() -> handleScreenshot(normalized));
    }

    private static void handleScreenshot(Path screenshot) {
        MinecraftClient client = MinecraftClient.getInstance();
        ServerMetadata metadata = MinecraftServerMetadata.from(client.getCurrentServerEntry());
        if (config.autoUploadEnabled()) {
            beginUpload(screenshot, metadata, true);
        } else {
            offerUpload(screenshot, metadata);
        }
    }

    static void offerUpload(Path screenshot, ServerMetadata serverMetadata) {
        String id = UUID.randomUUID().toString();
        PENDING_UPLOADS.put(id, new PendingUpload(screenshot, serverMetadata));
        MutableText action = Text.translatable("message.i_love_moe.action.upload")
                .styled(style -> style.withColor(Formatting.AQUA)
                        .withUnderline(true)
                        .withClickEvent(new ClickEvent.RunCommand("/ilovemoe upload " + id)));
        sendMessage(Text.translatable("message.i_love_moe.screenshot.saved", action));
    }

    private static int upload(String pendingId) {
        PendingUpload pending = PENDING_UPLOADS.remove(pendingId);
        if (pending == null || !Files.isRegularFile(pending.screenshot())) {
            sendError(Text.translatable("message.i_love_moe.error.screenshot_missing"));
            return 0;
        }
        beginUpload(pending.screenshot(), pending.serverMetadata(), false);
        return 1;
    }

    private static void beginUpload(Path screenshot, ServerMetadata serverMetadata, boolean automatic) {
        sendMessage(Text.translatable(automatic
                ? "message.i_love_moe.upload.automatic"
                : "message.i_love_moe.upload.manual").formatted(Formatting.GRAY));
        api.upload(screenshot, serverMetadata, automatic).whenComplete((result, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) {
                if (automatic && "plus_required".equals(ApiClient.errorCode(error))) {
                    config.setAutoUpload(false);
                    sendError(Text.translatable("message.i_love_moe.error.auto_upload_plus_lost"));
                    return;
                }
                sendError(apiError(error));
                return;
            }
            MinecraftClient client = MinecraftClient.getInstance();
            String displayUrl = result.displayUrl();
            client.keyboard.setClipboard(displayUrl);

            MutableText open = Text.translatable("message.i_love_moe.action.open").styled(style -> style.withColor(Formatting.AQUA)
                    .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(displayUrl))));
            MutableText insert = Text.translatable("message.i_love_moe.action.insert").styled(style -> style.withColor(Formatting.GREEN)
                    .withClickEvent(new ClickEvent.SuggestCommand(displayUrl)));
            MutableText copy = Text.translatable("message.i_love_moe.action.copy").styled(style -> style.withColor(Formatting.YELLOW)
                    .withClickEvent(new ClickEvent.CopyToClipboard(displayUrl)));
            MutableText rename = Text.translatable("message.i_love_moe.action.rename").styled(style -> style.withColor(Formatting.GOLD)
                    .withClickEvent(new ClickEvent.SuggestCommand("/ilovemoe rename " + result.id + " ")));
            MutableText publish = Text.translatable("message.i_love_moe.action.publish").styled(style -> style.withColor(Formatting.LIGHT_PURPLE)
                    .withClickEvent(new ClickEvent.RunCommand("/ilovemoe publish " + result.id)));
            MutableText delete = Text.translatable("message.i_love_moe.action.delete").styled(style -> style.withColor(Formatting.RED)
                    .withClickEvent(new ClickEvent.RunCommand("/ilovemoe delete " + result.id)));
            sendMessage(Text.translatable("message.i_love_moe.upload.success", open, insert, copy, rename, publish, delete));
        }));
    }

    private static int rename(String imageId, String title) {
        sendMessage(Text.translatable("message.i_love_moe.image.renaming").formatted(Formatting.GRAY));
        api.rename(imageId, title).whenComplete((ignored, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) {
                sendError(apiError(error));
                return;
            }
            sendMessage(Text.translatable("message.i_love_moe.image.renamed").formatted(Formatting.GREEN));
        }));
        return 1;
    }

    private static int publish(String imageId) {
        sendMessage(Text.translatable("message.i_love_moe.image.publishing").formatted(Formatting.GRAY));
        api.publish(imageId).whenComplete((ignored, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) {
                sendError(apiError(error));
                return;
            }
            sendMessage(Text.translatable("message.i_love_moe.image.published").formatted(Formatting.GREEN));
        }));
        return 1;
    }

    private static int showAutoUploadStatus() {
        Text state = Text.translatable(config.autoUploadEnabled()
                ? "message.i_love_moe.state.on"
                : "message.i_love_moe.state.off");
        sendMessage(Text.translatable("message.i_love_moe.auto_upload.status", state).formatted(Formatting.GRAY));
        return 1;
    }

    private static int setAutoUpload(boolean enabled) {
        if (!enabled) {
            config.setAutoUpload(false);
            sendMessage(Text.translatable("message.i_love_moe.auto_upload.disabled").formatted(Formatting.GRAY));
            return 1;
        }
        sendMessage(Text.translatable("message.i_love_moe.auto_upload.checking_plus").formatted(Formatting.GRAY));
        api.account().whenComplete((account, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) {
                sendError(apiError(error));
                return;
            }
            if (!account.autoUploadAllowed) {
                config.setAutoUpload(false);
                MutableText plus = Text.translatable("message.i_love_moe.action.view_plus").styled(style -> style.withColor(Formatting.AQUA)
                        .withUnderline(true)
                        .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(config.baseUrl() + "/plus"))));
                sendMessage(Text.translatable("message.i_love_moe.auto_upload.plus_required", plus).formatted(Formatting.RED));
                return;
            }
            config.setAutoUpload(true);
            sendMessage(Text.translatable("message.i_love_moe.auto_upload.enabled").formatted(Formatting.GREEN));
        }));
        return 1;
    }

    private static int delete(String imageId) {
        api.delete(imageId).whenComplete((ignored, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) sendError(apiError(error));
            else sendMessage(Text.translatable("message.i_love_moe.image.deleted").formatted(Formatting.GRAY));
        }));
        return 1;
    }

    private static int login() {
        api.createBrowserLogin().whenComplete((result, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) {
                sendError(apiError(error));
                return;
            }
            MinecraftClient.getInstance().keyboard.setClipboard(result.url);
            MutableText open = Text.translatable("message.i_love_moe.action.open").styled(style -> style
                    .withColor(Formatting.AQUA)
                    .withUnderline(true)
                    .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(result.url))));
            sendMessage(Text.translatable("message.i_love_moe.login.form_ready", open).formatted(Formatting.GREEN));
        }));
        return 1;
    }

    private static int showManageLink() {
        String url = config.baseUrl() + "/manage";
        MutableText link = Text.translatable("message.i_love_moe.action.open_manage").styled(style -> style.withColor(Formatting.AQUA)
                .withUnderline(true)
                .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(url))));
        sendMessage(link);
        return 1;
    }

    private static void sendError(Text message) {
        sendMessage(Text.translatable("message.i_love_moe.error.prefixed", message).formatted(Formatting.RED));
    }

    private static Text apiError(Throwable error) {
        String code = ApiClient.errorCode(error);
        if (code == null) return Text.translatable("message.i_love_moe.error.api");
        String key = switch (code) {
            case "image_too_large" -> "message.i_love_moe.error.image_too_large";
            case "invalid_png", "invalid_image_type" -> "message.i_love_moe.error.invalid_png";
            case "invalid_server_metadata" -> "message.i_love_moe.error.invalid_server_metadata";
            case "invalid_image_title" -> "message.i_love_moe.error.invalid_image_title";
            case "upload_limit_reached" -> "message.i_love_moe.error.upload_limit_reached";
            case "plus_required" -> "message.i_love_moe.error.plus_required";
            case "invalid_email" -> "message.i_love_moe.error.invalid_email";
            case "too_many_requests" -> "message.i_love_moe.error.too_many_requests";
            case "email_unavailable" -> "message.i_love_moe.error.email_unavailable";
            case "unauthorized" -> "message.i_love_moe.error.unauthorized";
            case "not_found" -> "message.i_love_moe.error.not_found";
            default -> null;
        };
        return key == null
                ? Text.translatable("message.i_love_moe.error.api_with_code", code)
                : Text.translatable(key);
    }

    private static void sendMessage(Text message) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.inGameHud != null) client.inGameHud.getChatHud().addMessage(message);
    }

    private record PendingUpload(Path screenshot, ServerMetadata serverMetadata) {
    }
}
