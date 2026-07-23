package moe.love.i.client;

import net.minecraft.client.multiplayer.ServerData;

final class MinecraftServerMetadata {
    private MinecraftServerMetadata() {
    }

    static ServerMetadata from(ServerData server) {
        return server == null
                ? ServerMetadata.empty()
                : ServerMetadata.of(server.ip, server.name);
    }
}
