export async function onReady(client) {
  const { logger, verifier, antiRaid } = client.security;

  for (const guild of client.guilds.cache.values()) {
    await logger.ensureLogChannel(guild);
    await verifier.ensureSetup(guild);
    await antiRaid.restoreLockdowns(guild);
  }

  console.log(`Logged in as ${client.user.tag}`);
}
