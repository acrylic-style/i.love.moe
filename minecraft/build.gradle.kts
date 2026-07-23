import com.modrinth.minotaur.ModrinthExtension

plugins {
    id("net.fabricmc.fabric-loom-remap") version "1.17.16" apply false
    id("net.fabricmc.fabric-loom") version "1.17.16" apply false
    id("com.modrinth.minotaur") version "2.9.0" apply false
}

allprojects {
    group = providers.gradleProperty("maven_group").get()
    version = providers.gradleProperty("mod_version").get()

    repositories {
        mavenCentral()
    }
}

subprojects {
    if (!name.startsWith("mc")) return@subprojects

    apply(plugin = "com.modrinth.minotaur")

    extensions.configure<ModrinthExtension>("modrinth") {
        projectId.set(
            providers.environmentVariable("MODRINTH_PROJECT_ID")
                .orElse(providers.gradleProperty("modrinth_project_id"))
                .orElse("i-love-moe"),
        )
        versionType.set(
            when {
                project.version.toString().contains("alpha", ignoreCase = true) -> "alpha"
                project.version.toString().contains("beta", ignoreCase = true) -> "beta"
                else -> "release"
            },
        )
        providers.environmentVariable("CHANGELOG").orNull?.let { changelog.set(it) }
    }
}
