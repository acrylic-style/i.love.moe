import org.gradle.api.tasks.compile.JavaCompile

plugins {
    id("net.fabricmc.fabric-loom-remap")
    `maven-publish`
}

base {
    archivesName.set("i-love-moe-mc1.20.4")
}

dependencies {
    minecraft("com.mojang:minecraft:1.20.4")
    mappings("net.fabricmc:yarn:1.20.4+build.3:v2")
    modImplementation("net.fabricmc:fabric-loader:0.19.3")
    modImplementation("net.fabricmc.fabric-api:fabric-api:0.97.3+1.20.4")
    implementation(project(":common"))
    include(project(":common"))
}

sourceSets {
    main {
        java.srcDir("../mc1_yarn/src/main/java")
        java.srcDir("../mc1_20/src/main/java")
    }
}

tasks.processResources {
    inputs.property("version", project.version)
    filesMatching("fabric.mod.json") {
        expand("version" to project.version)
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(17)
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(17))
    withSourcesJar()
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.jar {
    from(rootProject.file("LICENSE")) {
        rename { "${it}_${base.archivesName.get()}" }
    }
}

modrinth {
    versionName.set("i.らぶ.moe ${project.version} for Fabric 1.20.4")
    versionNumber.set("${project.version}+1.20.4-fabric")
    uploadFile.set(tasks.remapJar)
    gameVersions.add("1.20.4")
    loaders.add("fabric")
    dependencies {
        required.project("fabric-api")
    }
}
