package moe.love.i.mixin.client;

import moe.love.i.client.ILoveMoeClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.util.ScreenshotRecorder;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.io.File;
import java.util.function.Consumer;

@Mixin(ScreenshotRecorder.class)
abstract class ScreenshotRecorderMixin {
    @Inject(
            method = "method_22691",
            at = @At(
                    value = "INVOKE",
                    target = "Lnet/minecraft/client/texture/NativeImage;writeTo(Ljava/io/File;)V",
                    shift = At.Shift.AFTER
            )
    )
    private static void iLoveMoe$afterScreenshotWritten(
            NativeImage image,
            File file,
            Consumer<Text> messageReceiver,
            CallbackInfo callbackInfo
    ) {
        ILoveMoeClient.onScreenshotSaved(file.toPath());
    }
}

