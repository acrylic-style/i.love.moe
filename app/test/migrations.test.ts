import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("D1 migrations", () => {
  it("applies every migration and links an uploaded Minecraft profile to a user", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    const directory = new URL("../migrations/", import.meta.url);
    for (const filename of readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      database.exec(readFileSync(new URL(filename, directory), "utf8"));
    }

    database
      .prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)")
      .run("user-1", "player@example.com", 1);
    database
      .prepare(
        "INSERT INTO devices (id, token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, NULL, ?, ?)",
      )
      .run("device-1", "token-hash", 1, 1);
    database
      .prepare(
        "INSERT INTO minecraft_profiles (uuid, current_name, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)",
      )
      .run("123e4567-e89b-12d3-a456-426614174000", "Player_1", 1, 1);
    database
      .prepare(
        `INSERT INTO images
          (id, owner_device_id, r2_key, byte_size, width, height, created_at, expires_at,
            minecraft_uuid, minecraft_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "image-1",
        "device-1",
        "free/image-1.png",
        3,
        1,
        1,
        1,
        2,
        "123e4567-e89b-12d3-a456-426614174000",
        "Player_1",
      );
    database
      .prepare(
        `INSERT INTO servers
          (id, code, display_name, owner_user_id, verified_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("server-1", "SrvCode1", "Verified server", "user-1", 1, 1, 1);
    database
      .prepare(
        `INSERT INTO server_addresses
          (id, server_id, host_ascii, port, display_address, verified_at, is_primary)
        VALUES (?, ?, ?, ?, ?, ?, 1)`,
      )
      .run("address-1", "server-1", "primary.example.com", 25565, "primary.example.com", 1);
    database
      .prepare("UPDATE images SET server_id = ?, server_name = ?, server_address = ? WHERE id = ?")
      .run("server-1", "Captured server name", "play.example.com", "image-1");
    database
      .prepare(
        `INSERT INTO short_links (code, target_type, target_id, created_at)
          VALUES (?, 'image', ?, ?)`,
      )
      .run("Image001", "image-1", 1);

    database
      .prepare(
        `INSERT INTO user_minecraft_profiles
          (user_id, minecraft_uuid, source_device_id, status, linked_at, last_seen_at)
        SELECT ?, minecraft_uuid, ?, 'reported', ?, ?
        FROM images
        WHERE owner_device_id = ? AND minecraft_uuid IS NOT NULL
        GROUP BY minecraft_uuid
        ON CONFLICT(user_id, minecraft_uuid) DO UPDATE SET
          source_device_id = excluded.source_device_id,
          last_seen_at = excluded.last_seen_at`,
      )
      .run("user-1", "device-1", 2, 2, "device-1");

    expect(
      database
        .prepare("SELECT minecraft_uuid, status FROM user_minecraft_profiles WHERE user_id = ?")
        .get("user-1"),
    ).toEqual({
      minecraft_uuid: "123e4567-e89b-12d3-a456-426614174000",
      status: "reported",
    });
    expect(
      database.prepare("SELECT minecraft_id_public FROM images WHERE id = ?").get("image-1"),
    ).toEqual({ minecraft_id_public: 1 });
    expect(
      database
        .prepare(
          `SELECT i.server_name, i.server_address,
            CASE WHEN verified_server.verified_at IS NOT NULL
              THEN COALESCE(verified_server.display_name, (
                SELECT display_address FROM server_addresses
                WHERE server_id = verified_server.id AND is_primary = 1 LIMIT 1
              ))
            END AS verified_server_name,
            verified_server.verified_at AS server_verified_at
          FROM short_links sl JOIN images i ON i.id = sl.target_id
          LEFT JOIN servers verified_server ON verified_server.id = i.server_id
          WHERE sl.code = ? AND sl.target_type = 'image'`,
        )
        .get("Image001"),
    ).toEqual({
      server_name: "Captured server name",
      server_address: "play.example.com",
      verified_server_name: "Verified server",
      server_verified_at: 1,
    });
    database.close();
  });
});
