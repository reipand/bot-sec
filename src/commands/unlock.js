import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("Restore messaging permissions after a lockdown")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export const cooldownMs = 10_000;

export async function execute(interaction) {
  const { config, antiRaid } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  await antiRaid.disableLockdown(
    interaction.guild,
    `Server unlocked by ${interaction.user.tag}`
  );

  await interaction.editReply({ content: "Lockdown lifted. Messaging permissions restored." });
}
