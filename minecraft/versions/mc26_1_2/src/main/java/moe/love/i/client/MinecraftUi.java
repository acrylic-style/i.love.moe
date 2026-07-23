package moe.love.i.client;

import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;

final class MinecraftUi {
    private MinecraftUi() {
    }

    static void sendMessage(Component message) {
        Minecraft client = Minecraft.getInstance();
        if (client.gui != null) client.gui.getChat().addClientSystemMessage(message);
    }
}
