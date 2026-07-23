pluginManagement {
    repositories {
        maven("https://maven.fabricmc.net/")
        gradlePluginPortal()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "i-love-moe-minecraft"

include(":common")
include(":versions:mc1_21_11")
include(":versions:mc26_1_2")
include(":versions:mc26_2")
