import org.gradle.api.tasks.compile.JavaCompile

plugins {
    `java-library`
}

dependencies {
    compileOnly("com.google.code.gson:gson:2.13.2")
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(17)
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(17))
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
