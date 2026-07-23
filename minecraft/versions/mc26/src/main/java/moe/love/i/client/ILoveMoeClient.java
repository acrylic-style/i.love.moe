package moe.love.i.client;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.ClientCommands;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
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
                ClientCommands.literal("ilovemoe")
                        .then(ClientCommands.literal("upload")
                                .then(ClientCommands.argument("id", StringArgumentType.word())
                                        .executes(context -> upload(StringArgumentType.getString(context, "id")))))
                        .then(ClientCommands.literal("delete")
                                .then(ClientCommands.argument("id", StringArgumentType.word())
                                        .executes(context -> delete(StringArgumentType.getString(context, "id")))))
                        .then(ClientCommands.literal("login")
                                .then(ClientCommands.argument("email", StringArgumentType.greedyString())
                                        .executes(context -> login(StringArgumentType.getString(context, "email")))))
                        .then(ClientCommands.literal("auto-upload")
                                .executes(context -> showAutoUploadStatus())
                                .then(ClientCommands.literal("on").executes(context -> setAutoUpload(true)))
                                .then(ClientCommands.literal("off").executes(context -> setAutoUpload(false))))
                        .then(ClientCommands.literal("manage").executes(context -> showManageLink()))
        ));
    }

    public static void onScreenshotSaved(Path screenshot) {
        Path normalized = screenshot.toAbsolutePath().normalize();
        Minecraft.getInstance().execute(() -> handleScreenshot(normalized));
    }

    private static void handleScreenshot(Path screenshot) {
        Minecraft client = Minecraft.getInstance();
        ServerMetadata metadata = MinecraftServerMetadata.from(client.getCurrentServer());
        if (config.autoUploadEnabled()) {
            beginUpload(screenshot, metadata, true);
        } else {
            offerUpload(screenshot, metadata);
        }
    }

    static void offerUpload(Path screenshot, ServerMetadata serverMetadata) {
        String id = UUID.randomUUID().toString();
        PENDING_UPLOADS.put(id, new PendingUpload(screenshot, serverMetadata));
        MutableComponent action = Component.translatable("message.i_love_moe.action.upload")
                .withStyle(style -> style.withColor(ChatFormatting.AQUA)
                        .withUnderlined(true)
                        .withClickEvent(new ClickEvent.RunCommand("/ilovemoe upload " + id)));
        sendMessage(Component.translatable("message.i_love_moe.screenshot.saved", action));
    }

    private static int upload(String pendingId) {
        PendingUpload pending = PENDING_UPLOADS.remove(pendingId);
        if (pending == null || !Files.isRegularFile(pending.screenshot())) {
            sendError(Component.translatable("message.i_love_moe.error.screenshot_missing"));
            return 0;
        }
        beginUpload(pending.screenshot(), pending.serverMetadata(), false);
        return 1;
    }

    private static void beginUpload(Path screenshot, ServerMetadata serverMetadata, boolean automatic) {
        sendMessage(Component.translatable(automatic
                ? "message.i_love_moe.upload.automatic"
                : "message.i_love_moe.upload.manual").withStyle(ChatFormatting.GRAY));
        api.upload(screenshot, serverMetadata, automatic).whenComplete((result, error) -> Minecraft.getInstance().execute(() -> {
            if (error != null) {
                if (automatic && "plus_required".equals(ApiClient.errorCode(error))) {
                    config.setAutoUpload(false);
                    sendError(Component.translatable("message.i_love_moe.error.auto_upload_plus_lost"));
                    return;
                }
                sendError(apiError(error));
                return;
            }
            Minecraft client = Minecraft.getInstance();
            client.keyboardHandler.setClipboard(result.url);

            MutableComponent open = Component.translatable("message.i_love_moe.action.open").withStyle(style -> style.withColor(ChatFormatting.AQUA)
                    .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(result.url))));
            MutableComponent insert = Component.translatable("message.i_love_moe.action.insert").withStyle(style -> style.withColor(ChatFormatting.GREEN)
                    .withClickEvent(new ClickEvent.SuggestCommand(result.url)));
            MutableComponent copy = Component.translatable("message.i_love_moe.action.copy").withStyle(style -> style.withColor(ChatFormatting.YELLOW)
                    .withClickEvent(new ClickEvent.CopyToClipboard(result.url)));
            MutableComponent delete = Component.translatable("message.i_love_moe.action.delete").withStyle(style -> style.withColor(ChatFormatting.RED)
                    .withClickEvent(new ClickEvent.RunCommand("/ilovemoe delete " + result.id)));
            sendMessage(Component.translatable("message.i_love_moe.upload.success", open, insert, copy, delete));
        }));
    }

    private static int showAutoUploadStatus() {
        Component state = Component.translatable(config.autoUploadEnabled()
                ? "message.i_love_moe.state.on"
                : "message.i_love_moe.state.off");
        sendMessage(Component.translatable("message.i_love_moe.auto_upload.status", state).withStyle(ChatFormatting.GRAY));
        return 1;
    }

    private static int setAutoUpload(boolean enabled) {
        if (!enabled) {
            config.setAutoUpload(false);
            sendMessage(Component.translatable("message.i_love_moe.auto_upload.disabled").withStyle(ChatFormatting.GRAY));
            return 1;
        }
        sendMessage(Component.translatable("message.i_love_moe.auto_upload.checking_plus").withStyle(ChatFormatting.GRAY));
        api.account().whenComplete((account, error) -> Minecraft.getInstance().execute(() -> {
            if (error != null) {
                sendError(apiError(error));
                return;
            }
            if (!account.autoUploadAllowed) {
                config.setAutoUpload(false);
                MutableComponent plus = Component.translatable("message.i_love_moe.action.view_plus").withStyle(style -> style.withColor(ChatFormatting.AQUA)
                        .withUnderlined(true)
                        .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(config.baseUrl() + "/plus"))));
                sendMessage(Component.translatable("message.i_love_moe.auto_upload.plus_required", plus).withStyle(ChatFormatting.RED));
                return;
            }
            config.setAutoUpload(true);
            sendMessage(Component.translatable("message.i_love_moe.auto_upload.enabled").withStyle(ChatFormatting.GREEN));
        }));
        return 1;
    }

    private static int delete(String imageId) {
        api.delete(imageId).whenComplete((ignored, error) -> Minecraft.getInstance().execute(() -> {
            if (error != null) sendError(apiError(error));
            else sendMessage(Component.translatable("message.i_love_moe.image.deleted").withStyle(ChatFormatting.GRAY));
        }));
        return 1;
    }

    private static int login(String email) {
        api.sendMagicLink(email.trim()).whenComplete((ignored, error) -> Minecraft.getInstance().execute(() -> {
            if (error != null) sendError(apiError(error));
            else sendMessage(Component.translatable("message.i_love_moe.login.email_sent").withStyle(ChatFormatting.GREEN));
        }));
        return 1;
    }

    private static int showManageLink() {
        String url = config.baseUrl() + "/manage";
        MutableComponent link = Component.translatable("message.i_love_moe.action.open_manage").withStyle(style -> style.withColor(ChatFormatting.AQUA)
                .withUnderlined(true)
                .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(url))));
        sendMessage(link);
        return 1;
    }

    private static void sendError(Component message) {
        sendMessage(Component.translatable("message.i_love_moe.error.prefixed", message).withStyle(ChatFormatting.RED));
    }

    private static Component apiError(Throwable error) {
        String code = ApiClient.errorCode(error);
        if (code == null) return Component.translatable("message.i_love_moe.error.api");
        String key = switch (code) {
            case "image_too_large" -> "message.i_love_moe.error.image_too_large";
            case "invalid_png", "invalid_image_type" -> "message.i_love_moe.error.invalid_png";
            case "invalid_server_metadata" -> "message.i_love_moe.error.invalid_server_metadata";
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
                ? Component.translatable("message.i_love_moe.error.api_with_code", code)
                : Component.translatable(key);
    }

    private static void sendMessage(Component message) {
        MinecraftUi.sendMessage(message);
    }

    private record PendingUpload(Path screenshot, ServerMetadata serverMetadata) {
    }
}
