import org.gradle.api.tasks.compile.JavaCompile

plugins {
    id("net.fabricmc.fabric-loom")
    `maven-publish`
}

base {
    archivesName.set("i-love-moe-mc26.1.2")
}

dependencies {
    minecraft("com.mojang:minecraft:26.1.2")
    implementation("net.fabricmc:fabric-loader:0.19.3")
    implementation("net.fabricmc.fabric-api:fabric-api:0.155.2+26.1.2")
    implementation(project(":common"))
    include(project(":common"))
}

sourceSets {
    main {
        java.srcDir("../mc26/src/main/java")
    }
}

tasks.processResources {
    inputs.property("version", project.version)
    filesMatching("fabric.mod.json") {
        expand("version" to project.version)
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(25)
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(25))
    withSourcesJar()
    sourceCompatibility = JavaVersion.VERSION_25
    targetCompatibility = JavaVersion.VERSION_25
}

tasks.jar {
    from(rootProject.file("LICENSE")) {
        rename { "${it}_${base.archivesName.get()}" }
    }
}

modrinth {
    versionName.set("i.らぶ.moe ${project.version} for Fabric 26.1.2")
    versionNumber.set("${project.version}+26.1.2-fabric")
    uploadFile.set(tasks.jar)
    gameVersions.add("26.1.2")
    loaders.add("fabric")
    dependencies {
        required.project("fabric-api")
    }
}
