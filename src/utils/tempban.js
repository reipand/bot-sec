const INDEX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createTempbanManager({ cache, logger }) {
  // ── index helpers ──────────────────────────────────────────────────────────

  async function readIndex(guildId) {
    const raw = await cache.get(`tempban:index:${guildId}`);
    return raw ? JSON.parse(raw) : [];
  }

  async function writeIndex(guildId, entries) {
    const key = `tempban:index:${guildId}`;
    if (entries.length === 0) {
      await cache.delete(key);
    } else {
      await cache.set(key, JSON.stringify(entries), INDEX_TTL_MS);
    }
  }

  async function addEntry(guildId, userId, expiresAt) {
    const index = await readIndex(guildId);
    const without = index.filter((e) => e.userId !== userId);
    without.push({ userId, expiresAt });
    await writeIndex(guildId, without);
  }

  async function removeEntry(guildId, userId) {
    const index = await readIndex(guildId);
    await writeIndex(guildId, index.filter((e) => e.userId !== userId));
  }

  // ── timer ──────────────────────────────────────────────────────────────────

  function arm(guild, userId, remainingMs) {
    setTimeout(async () => {
      try {
        await guild.members.unban(userId, "Tempban expired");
        await logger.log(guild, {
          title: "Tempban Expired — Auto Unban",
          color: 0x00cc66,
          fields: [{ name: "User ID", value: userId }],
        });
      } catch {
        // Already unbanned or unknown user — harmless
      }
      await cache.delete(`tempban:${guild.id}:${userId}`);
      await removeEntry(guild.id, userId);
    }, remainingMs);
  }

  // ── public API ─────────────────────────────────────────────────────────────

  async function scheduleTempban(guild, userId, durationMs) {
    const expiresAt = Date.now() + durationMs;
    // Store expiry with a small buffer so it outlives the timer
    await cache.set(`tempban:${guild.id}:${userId}`, String(expiresAt), durationMs + 60_000);
    await addEntry(guild.id, userId, expiresAt);
    arm(guild, userId, durationMs);
  }

  async function restoreGuild(guild) {
    const index = await readIndex(guild.id);
    if (!index.length) return;

    const now = Date.now();
    const stale = [];

    for (const { userId, expiresAt } of index) {
      const remaining = expiresAt - now;
      if (remaining <= 0) {
        stale.push(userId);
        try {
          await guild.members.unban(userId, "Tempban expired (post-restart cleanup)");
        } catch {
          // Already unbanned
        }
        await cache.delete(`tempban:${guild.id}:${userId}`);
      } else {
        arm(guild, userId, remaining);
      }
    }

    if (stale.length) {
      await writeIndex(guild.id, index.filter((e) => !stale.includes(e.userId)));
    }
  }

  return { scheduleTempban, restoreGuild };
}
