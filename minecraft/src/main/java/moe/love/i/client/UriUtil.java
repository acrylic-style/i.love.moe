package moe.love.i.client;

import java.net.IDN;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;

final class UriUtil {
    private UriUtil() {
    }

    static URI toHttpUri(String value) {
        try {
            URL url = URI.create(value).toURL();
            String scheme = url.getProtocol();
            if (!scheme.equals("http") && !scheme.equals("https")) {
                throw new IllegalArgumentException("HTTPまたはHTTPSのURLが必要です");
            }
            if (url.getHost().isBlank()) {
                throw new IllegalArgumentException("ホスト名がありません");
            }

            String asciiHost = IDN.toASCII(url.getHost(), IDN.USE_STD3_ASCII_RULES);
            return new URI(
                    scheme,
                    url.getUserInfo(),
                    asciiHost,
                    url.getPort(),
                    url.getPath(),
                    url.getQuery(),
                    url.getRef()
            );
        } catch (MalformedURLException | URISyntaxException exception) {
            throw new IllegalArgumentException("不正なURLです: " + value, exception);
        }
    }
}

