package moe.love.i.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

final class ModConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("i-love-moe.json");

    String apiBaseUrl = "https://i.らぶ.moe";
    String deviceToken;

    static ModConfig load() {
        if (!Files.exists(PATH)) {
            ModConfig config = new ModConfig();
            config.save();
            return config;
        }

        try (Reader reader = Files.newBufferedReader(PATH)) {
            ModConfig config = GSON.fromJson(reader, ModConfig.class);
            if (config == null) config = new ModConfig();
            config.apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl);
            return config;
        } catch (IOException | RuntimeException exception) {
            ILoveMoeClient.LOGGER.warn("設定ファイルを読み込めませんでした。既定値を使用します。", exception);
            return new ModConfig();
        }
    }

    synchronized void setDeviceToken(String token) {
        deviceToken = token;
        save();
    }

    synchronized void clearDeviceToken() {
        deviceToken = null;
        save();
    }

    synchronized void save() {
        try {
            Files.createDirectories(PATH.getParent());
            try (Writer writer = Files.newBufferedWriter(PATH)) {
                GSON.toJson(this, writer);
            }
        } catch (IOException exception) {
            ILoveMoeClient.LOGGER.error("設定ファイルを保存できませんでした。", exception);
        }
    }

    String baseUrl() {
        return normalizeBaseUrl(apiBaseUrl);
    }

    private static String normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) return "https://i.らぶ.moe";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}

