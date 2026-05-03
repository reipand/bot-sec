export async function onInteractionCreate(interaction) {
  if (!interaction.inCachedGuild()) {
    return;
  }

  const { verifier } = interaction.client.security;

  if (interaction.isButton()) {
    await verifier.handleButton(interaction);
  }
}
