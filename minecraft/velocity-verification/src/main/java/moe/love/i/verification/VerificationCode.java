package moe.love.i.verification;

import java.security.SecureRandom;

final class VerificationCode {
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private VerificationCode() {
    }

    static String generate() {
        var code = new char[8];
        for (var index = 0; index < code.length; index++) {
            code[index] = ALPHABET[RANDOM.nextInt(ALPHABET.length)];
        }
        return new String(code);
    }

    static String display(String code) {
        return code.substring(0, 4) + "-" + code.substring(4);
    }
}
