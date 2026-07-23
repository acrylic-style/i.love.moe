plugins {
    id("net.fabricmc.fabric-loom-remap") version "1.17.16" apply false
    id("net.fabricmc.fabric-loom") version "1.17.16" apply false
}

allprojects {
    group = providers.gradleProperty("maven_group").get()
    version = providers.gradleProperty("mod_version").get()

    repositories {
        mavenCentral()
    }
}
