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
                client.getSession().getUuidOrNull(),
                client.getSession().getUsername());
    }

    static ClickEvent runCommand(String command) {
        return new ClickEvent(ClickEvent.Action.RUN_COMMAND, command);
    }

    static ClickEvent suggestCommand(String command) {
        return new ClickEvent(ClickEvent.Action.SUGGEST_COMMAND, command);
    }

    static ClickEvent copyToClipboard(String value) {
        return new ClickEvent(ClickEvent.Action.COPY_TO_CLIPBOARD, value);
    }

    static ClickEvent openUrl(URI uri) {
        return new ClickEvent(ClickEvent.Action.OPEN_URL, uri.toString());
    }

    static void sendMessage(Text message) {
        if (MinecraftClient.getInstance().inGameHud != null) {
            MinecraftClient.getInstance().inGameHud.getChatHud().addMessage(message);
        }
    }
}
