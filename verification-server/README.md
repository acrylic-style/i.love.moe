# Minecraft ID verification server

This directory runs an online-mode Velocity proxy that always rejects login after issuing a
short-lived i.らぶ.moe verification code.

The pinned Velocity 4.1 build requires Java 25; the Docker image includes that runtime.

1. Point the DNS-only `verify.moe.pictures` A/AAAA record to the VPS.
2. Allow inbound TCP port 25565 and outbound HTTPS.
3. Copy `.env.example` to `.env` and set the same secret as the Worker's
   `MINECRAFT_VERIFICATION_TOKEN`.
4. Build and start with `docker compose up -d --build`.

Do not commit `.env`. The proxy intentionally has no backend server and must remain in
`online-mode`.
