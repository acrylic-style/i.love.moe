package moe.love.i.client;

import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

record MinecraftProfileMetadata(String uuid, String name) {
    private static final String UUID_HEADER = "x-minecraft-player-uuid";
    private static final String NAME_HEADER = "x-minecraft-player-name";

    static MinecraftProfileMetadata of(UUID uuid, String name) {
        if (uuid == null || name == null || !name.matches("[0-9A-Za-z_]{1,16}")) {
            return null;
        }
        return new MinecraftProfileMetadata(uuid.toString(), name);
    }

    HttpRequest.Builder addHeaders(HttpRequest.Builder builder) {
        return builder
                .header(UUID_HEADER, uuid)
                .header(NAME_HEADER, Base64.getUrlEncoder().withoutPadding()
                        .encodeToString(name.getBytes(StandardCharsets.UTF_8)));
    }
}
