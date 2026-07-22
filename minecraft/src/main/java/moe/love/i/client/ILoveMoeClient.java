package moe.love.i.client;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
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
    private static final Map<String, Path> PENDING_UPLOADS = new ConcurrentHashMap<>();
    private static ModConfig config;
    private static ApiClient api;

    @Override
    public void onInitializeClient() {
        config = ModConfig.load();
        api = new ApiClient(config);
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> dispatcher.register(
                ClientCommandManager.literal("ilovemoe")
                        .then(ClientCommandManager.literal("upload")
                                .then(ClientCommandManager.argument("id", StringArgumentType.word())
                                        .executes(context -> upload(StringArgumentType.getString(context, "id")))))
                        .then(ClientCommandManager.literal("delete")
                                .then(ClientCommandManager.argument("id", StringArgumentType.word())
                                        .executes(context -> delete(StringArgumentType.getString(context, "id")))))
                        .then(ClientCommandManager.literal("login")
                                .then(ClientCommandManager.argument("email", StringArgumentType.greedyString())
                                        .executes(context -> login(StringArgumentType.getString(context, "email")))))
                        .then(ClientCommandManager.literal("manage").executes(context -> showManageLink()))
        ));
    }

    public static void onScreenshotSaved(Path screenshot) {
        Path normalized = screenshot.toAbsolutePath().normalize();
        MinecraftClient.getInstance().execute(() -> offerUpload(normalized));
    }

    static void offerUpload(Path screenshot) {
        String id = UUID.randomUUID().toString();
        PENDING_UPLOADS.put(id, screenshot);
        MutableText action = Text.literal("[アップロード]")
                .styled(style -> style.withColor(Formatting.AQUA)
                        .withUnderline(true)
                        .withClickEvent(new ClickEvent.RunCommand("/ilovemoe upload " + id)));
        sendMessage(Text.literal("スクリーンショットを保存しました ").append(action));
    }

    private static int upload(String pendingId) {
        Path screenshot = PENDING_UPLOADS.remove(pendingId);
        if (screenshot == null || !Files.isRegularFile(screenshot)) {
            sendError("スクリーンショットが見つかりません");
            return 0;
        }
        sendMessage(Text.literal("アップロードしています…").formatted(Formatting.GRAY));
        api.upload(screenshot).whenComplete((result, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) {
                sendError(ApiClient.humanReadableError(error));
                return;
            }
            MinecraftClient client = MinecraftClient.getInstance();
            client.keyboard.setClipboard(result.url);

            MutableText open = Text.literal("[開く]").styled(style -> style.withColor(Formatting.AQUA)
                    .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(result.url))));
            MutableText insert = Text.literal("[チャットに入力]").styled(style -> style.withColor(Formatting.GREEN)
                    .withClickEvent(new ClickEvent.SuggestCommand(result.url)));
            MutableText copy = Text.literal("[コピー]").styled(style -> style.withColor(Formatting.YELLOW)
                    .withClickEvent(new ClickEvent.CopyToClipboard(result.url)));
            MutableText delete = Text.literal("[削除]").styled(style -> style.withColor(Formatting.RED)
                    .withClickEvent(new ClickEvent.RunCommand("/ilovemoe delete " + result.id)));
            sendMessage(Text.literal("アップロードしました（URLをコピー済み） ")
                    .append(open).append(" ").append(insert).append(" ").append(copy).append(" ").append(delete));
        }));
        return 1;
    }

    private static int delete(String imageId) {
        api.delete(imageId).whenComplete((ignored, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) sendError(ApiClient.humanReadableError(error));
            else sendMessage(Text.literal("画像を削除しました").formatted(Formatting.GRAY));
        }));
        return 1;
    }

    private static int login(String email) {
        api.sendMagicLink(email.trim()).whenComplete((ignored, error) -> MinecraftClient.getInstance().execute(() -> {
            if (error != null) sendError(ApiClient.humanReadableError(error));
            else sendMessage(Text.literal("ログインリンクをメールで送信しました").formatted(Formatting.GREEN));
        }));
        return 1;
    }

    private static int showManageLink() {
        String url = config.baseUrl() + "/manage";
        MutableText link = Text.literal("[画像管理を開く]").styled(style -> style.withColor(Formatting.AQUA)
                .withUnderline(true)
                .withClickEvent(new ClickEvent.OpenUrl(UriUtil.toHttpUri(url))));
        sendMessage(link);
        return 1;
    }

    private static void sendError(String message) {
        sendMessage(Text.literal("i.らぶ.moe: " + message).formatted(Formatting.RED));
    }

    private static void sendMessage(Text message) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.inGameHud != null) client.inGameHud.getChatHud().addMessage(message);
    }
}
