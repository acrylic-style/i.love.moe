package moe.love.i.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

final class ModConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final System.Logger LOGGER = System.getLogger("i-love-moe");

    private transient Path path;
    String apiBaseUrl = "https://i.らぶ.moe";
    String deviceToken;
    boolean autoUpload;

    private ModConfig(Path path) {
        this.path = path.toAbsolutePath().normalize();
    }

    static ModConfig load(Path path) {
        Path normalizedPath = path.toAbsolutePath().normalize();
        if (!Files.exists(normalizedPath)) {
            ModConfig config = new ModConfig(normalizedPath);
            config.save();
            return config;
        }

        try (Reader reader = Files.newBufferedReader(normalizedPath)) {
            ModConfig config = GSON.fromJson(reader, ModConfig.class);
            if (config == null) config = new ModConfig(normalizedPath);
            config.path = normalizedPath;
            config.apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl);
            return config;
        } catch (IOException | RuntimeException exception) {
            LOGGER.log(System.Logger.Level.WARNING, "Could not load the config file. Using defaults.", exception);
            return new ModConfig(normalizedPath);
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

    synchronized void setAutoUpload(boolean enabled) {
        autoUpload = enabled;
        save();
    }

    boolean autoUploadEnabled() {
        return autoUpload;
    }

    synchronized void save() {
        try {
            Files.createDirectories(path.getParent());
            try (Writer writer = Files.newBufferedWriter(path)) {
                GSON.toJson(this, writer);
            }
        } catch (IOException exception) {
            LOGGER.log(System.Logger.Level.ERROR, "Could not save the config file.", exception);
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
