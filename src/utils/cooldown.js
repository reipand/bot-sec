const cooldowns = new Map();

/**
 * Returns 0 if the user is NOT on cooldown (and sets the cooldown).
 * Returns remaining seconds if the user IS on cooldown.
 */
export function checkCooldown(userId, commandName, durationMs) {
  const key = `${commandName}:${userId}`;
  const now = Date.now();
  const expires = cooldowns.get(key);

  if (expires && now < expires) {
    return Math.ceil((expires - now) / 1000);
  }

  cooldowns.set(key, now + durationMs);
  setTimeout(() => cooldowns.delete(key), durationMs);

  return 0;
}
