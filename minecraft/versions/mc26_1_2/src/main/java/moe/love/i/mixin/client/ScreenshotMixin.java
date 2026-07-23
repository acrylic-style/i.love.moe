package moe.love.i.mixin.client;

import com.mojang.blaze3d.platform.NativeImage;
import moe.love.i.client.ILoveMoeClient;
import net.minecraft.client.Screenshot;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.io.File;
import java.util.function.Consumer;

@Mixin(Screenshot.class)
abstract class ScreenshotMixin {
    @Inject(
            method = "lambda$grab$1",
            at = @At(
                    value = "INVOKE",
                    target = "Lcom/mojang/blaze3d/platform/NativeImage;writeToFile(Ljava/io/File;)V",
                    shift = At.Shift.AFTER
            )
    )
    private static void iLoveMoe$afterScreenshotWritten(
            NativeImage image,
            File file,
            Consumer<Component> messageReceiver,
            CallbackInfo callbackInfo
    ) {
        ILoveMoeClient.onScreenshotSaved(file.toPath());
    }
}
