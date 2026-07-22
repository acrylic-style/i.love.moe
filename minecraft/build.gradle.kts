import org.gradle.api.tasks.compile.JavaCompile

plugins {
    id("fabric-loom") version "1.17.16"
    `maven-publish`
}

val minecraftVersion = providers.gradleProperty("minecraft_version").get()
val yarnMappings = providers.gradleProperty("yarn_mappings").get()
val loaderVersion = providers.gradleProperty("loader_version").get()
val fabricApiVersion = providers.gradleProperty("fabric_api_version").get()
val modVersion = providers.gradleProperty("mod_version").get()
val mavenGroup = providers.gradleProperty("maven_group").get()
val archivesBaseName = providers.gradleProperty("archives_base_name").get()

version = modVersion
group = mavenGroup

base {
    archivesName.set(archivesBaseName)
}

repositories {
    mavenCentral()
}

dependencies {
    add("minecraft", "com.mojang:minecraft:$minecraftVersion")
    add("mappings", "net.fabricmc:yarn:$yarnMappings:v2")
    add("modImplementation", "net.fabricmc:fabric-loader:$loaderVersion")
    add("modImplementation", "net.fabricmc.fabric-api:fabric-api:$fabricApiVersion")
}

tasks.processResources {
    inputs.property("version", project.version)
    filesMatching("fabric.mod.json") {
        expand("version" to project.version)
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(21)
}

java {
    withSourcesJar()
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

tasks.jar {
    from("LICENSE") {
        rename { "${it}_${base.archivesName.get()}" }
    }
}
