import com.modrinth.minotaur.ModrinthExtension
import net.darkhax.curseforgegradle.TaskPublishCurseForge
import org.gradle.language.jvm.tasks.ProcessResources

plugins {
    id("net.fabricmc.fabric-loom-remap") version "1.17.16" apply false
    id("net.fabricmc.fabric-loom") version "1.17.16" apply false
    id("com.modrinth.minotaur") version "2.9.0" apply false
    id("net.darkhax.curseforgegradle") version "1.1.28" apply false
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
    apply(plugin = "net.darkhax.curseforgegradle")

    tasks.withType<ProcessResources>()
        .matching { it.name == "processResources" }
        .configureEach {
            from(rootProject.file("src/main/resources"))
        }

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

    val minecraftVersion = mapOf(
        "mc1_20_1" to "1.20.1",
        "mc1_20_4" to "1.20.4",
        "mc1_21_11" to "1.21.11",
        "mc26_1_2" to "26.1.2",
        "mc26_2" to "26.2",
    ).getValue(name)
    val javaVersion = if (name.startsWith("mc26_")) 25 else if (name == "mc1_21_11") 21 else 17
    val uploadTaskName = if (name.startsWith("mc26_")) "jar" else "remapJar"
    val releaseType = when {
        project.version.toString().contains("alpha", ignoreCase = true) -> "alpha"
        project.version.toString().contains("beta", ignoreCase = true) -> "beta"
        else -> "release"
    }

    tasks.register<TaskPublishCurseForge>("curseforge") {
        group = "publishing"
        description = "Publishes the Fabric $minecraftVersion artifact to CurseForge."
        apiToken = providers.environmentVariable("CURSEFORGE_TOKEN").orNull
            ?: providers.gradleProperty("curseforge_token").orNull
            ?: ""
        debugMode = providers.environmentVariable("CURSEFORGE_DEBUG")
            .map(String::toBoolean)
            .getOrElse(false)

        val mainFile = upload(
            providers.environmentVariable("CURSEFORGE_PROJECT_ID")
                .orElse(providers.gradleProperty("curseforge_project_id"))
                .getOrElse("1624436"),
            tasks.named(uploadTaskName),
        )
        mainFile.displayName = "i.らぶ.moe ${project.version} for Fabric $minecraftVersion"
        mainFile.releaseType = releaseType
        mainFile.changelog = providers.environmentVariable("CHANGELOG")
            .getOrElse("Release ${project.version}")
        mainFile.changelogType = "markdown"
        mainFile.addGameVersion(minecraftVersion)
        mainFile.addModLoader("Fabric")
        mainFile.addEnvironment("Client")
        mainFile.addJavaVersion("Java $javaVersion")
        mainFile.addRequirement("fabric-api")
    }
}
