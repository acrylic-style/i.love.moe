package moe.love.i.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.Text;

import java.net.URI;

final class MinecraftUi {
    private MinecraftUi() {
    }

    static MinecraftProfileMetadata profile(MinecraftClient client) {
        return MinecraftProfileMetadata.of(
                client.getGameProfile().id(),
                client.getGameProfile().name());
    }

    static ClickEvent runCommand(String command) {
        return new ClickEvent.RunCommand(command);
    }

    static ClickEvent suggestCommand(String command) {
        return new ClickEvent.SuggestCommand(command);
    }

    static ClickEvent copyToClipboard(String value) {
        return new ClickEvent.CopyToClipboard(value);
    }

    static ClickEvent openUrl(URI uri) {
        return new ClickEvent.OpenUrl(uri);
    }

    static void sendMessage(Text message) {
        if (MinecraftClient.getInstance().inGameHud != null) {
            MinecraftClient.getInstance().inGameHud.getChatHud().addMessage(message);
        }
    }
}
