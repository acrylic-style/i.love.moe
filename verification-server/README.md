# Minecraft ID verification server

This directory runs an online-mode Velocity proxy that always rejects login after issuing a
short-lived i.らぶ.moe verification code.

The pinned Velocity 4.1 build requires Java 25; the Docker image includes that runtime.

1. Point the DNS-only `verify.moe.pictures` A/AAAA record to the VPS.
2. Allow inbound TCP port 25565 and outbound HTTPS.
3. Copy `.env.example` to `.env` and set the same secret as the Worker's
   `MINECRAFT_VERIFICATION_TOKEN`.
4. Pull the GitHub Actions image and start it with
   `docker compose pull && docker compose up -d --no-build`.

Do not commit `.env`. The proxy intentionally has no backend server and must remain in
`online-mode`.

The `Build Verification Server Image` workflow builds pull requests without publishing.
Pushes to `main`, `v*` tags, and manual runs publish
`ghcr.io/acrylic-style/i.love.moe-verification`. The package may initially be private; make
it public in the GitHub package settings or authenticate the VPS with a read-only package
token before pulling it.

To build directly from this checkout instead, run `docker compose up -d --build`.
