package moe.love.i.client;

import net.minecraft.client.network.ServerInfo;

final class MinecraftServerMetadata {
    private MinecraftServerMetadata() {
    }

    static ServerMetadata from(ServerInfo server) {
        return server == null
                ? ServerMetadata.empty()
                : ServerMetadata.of(server.address, server.name);
    }
}
