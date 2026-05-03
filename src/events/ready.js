export async function onReady(client) {
  const { logger, verifier, antiRaid, tempbanManager } = client.security;

  for (const guild of client.guilds.cache.values()) {
    await logger.ensureLogChannel(guild);
    await verifier.ensureSetup(guild);
    await antiRaid.restoreLockdowns(guild);
    await tempbanManager.restoreGuild(guild);
  }

  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s) | ${client.commands.size} command(s) loaded`);
}
