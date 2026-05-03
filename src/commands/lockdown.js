import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("lockdown")
  .setDescription("Disable @everyone messaging in all channels")
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for lockdown (shown in logs)")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export const cooldownMs = 30_000;

export async function execute(interaction) {
  const { config, antiRaid } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const reason =
    interaction.options.getString("reason") ??
    `Manual lockdown by ${interaction.user.tag}`;

  await interaction.deferReply({ ephemeral: true });

  await antiRaid.enableLockdown(interaction.guild, reason);

  await interaction.editReply({
    content: "Server is now in **lockdown**. @everyone cannot send messages.",
  });
}
