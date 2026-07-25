FROM eclipse-temurin:25-jdk AS plugin-build
WORKDIR /source
COPY minecraft/ /source/minecraft/
WORKDIR /source/minecraft
RUN chmod +x ./gradlew \
    && ./gradlew :velocity-verification:build --no-daemon

FROM eclipse-temurin:25-jre
ARG VELOCITY_URL=https://fill-data.papermc.io/v1/objects/635ffe27b4fe1b97e61479012121d4e7c61a9eec99e6bd5a1f923053c2a259ce/velocity-4.1.0-SNAPSHOT-9.jar
ARG VELOCITY_SHA256=635ffe27b4fe1b97e61479012121d4e7c61a9eec99e6bd5a1f923053c2a259ce

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /velocity/plugins \
    && curl --fail --location --output /velocity/velocity.jar "${VELOCITY_URL}" \
    && echo "${VELOCITY_SHA256}  /velocity/velocity.jar" | sha256sum --check -

COPY --from=plugin-build \
    /source/minecraft/velocity-verification/build/libs/i-love-moe-verification-*.jar \
    /velocity/plugins/i-love-moe-verification.jar
COPY verification-server/velocity.toml /velocity/velocity.toml

WORKDIR /velocity
EXPOSE 25565
ENTRYPOINT ["java", "-Xms128M", "-Xmx384M", "-XX:+UseG1GC", "-jar", "velocity.jar"]
