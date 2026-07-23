import org.gradle.api.tasks.compile.JavaCompile

plugins {
    `java-library`
}

dependencies {
    compileOnly("com.google.code.gson:gson:2.13.2")
}

tasks.withType<JavaCompile>().configureEach {
    options.release.set(21)
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(21))
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
