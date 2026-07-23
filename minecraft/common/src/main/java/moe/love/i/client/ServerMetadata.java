package moe.love.i.client;

import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

record ServerMetadata(String address, String name) {
    private static final String ADDRESS_HEADER = "x-minecraft-server-address";
    private static final String NAME_HEADER = "x-minecraft-server-name";
    private static final ServerMetadata EMPTY = new ServerMetadata(null, null);

    static ServerMetadata empty() {
        return EMPTY;
    }

    static ServerMetadata of(String address, String name) {
        return new ServerMetadata(sanitize(address, 255), sanitize(name, 100));
    }

    HttpRequest.Builder addHeaders(HttpRequest.Builder builder) {
        if (address != null) builder.header(ADDRESS_HEADER, encode(address));
        if (name != null) builder.header(NAME_HEADER, encode(name));
        return builder;
    }

    private static String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String sanitize(String value, int maxCodePoints) {
        if (value == null) return null;
        StringBuilder result = new StringBuilder();
        value.trim().codePoints()
                .filter(codePoint -> codePoint >= 0x20 && codePoint != 0x7f)
                .limit(maxCodePoints)
                .forEach(result::appendCodePoint);
        return result.isEmpty() ? null : result.toString();
    }
}
