export async function onInteractionCreate(interaction) {
  if (!interaction.inCachedGuild()) return;

  const { verifier } = interaction.client.security;

  // ── Button interactions (verification panel) ───────────────────────────────
  if (interaction.isButton()) {
    await verifier.handleButton(interaction);
    return;
  }

  // ── Slash commands ─────────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands?.get(interaction.commandName);
  if (!command) return;

  // Per-command, per-user cooldown tracked in client.commandCooldowns
  const cooldownMs = command.cooldownMs ?? 3000;
  const cooldownKey = `${interaction.commandName}:${interaction.user.id}`;
  const cooldowns = interaction.client.commandCooldowns;
  const now = Date.now();
  const expires = cooldowns.get(cooldownKey);

  if (expires && now < expires) {
    const remaining = Math.ceil((expires - now) / 1000);
    return interaction.reply({
      content: `Please wait **${remaining}s** before using \`/${interaction.commandName}\` again.`,
      ephemeral: true,
    });
  }

  cooldowns.set(cooldownKey, now + cooldownMs);
  setTimeout(() => cooldowns.delete(cooldownKey), cooldownMs);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[command:${interaction.commandName}]`, error);
    const payload = {
      content: "An error occurred while executing this command.",
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}
