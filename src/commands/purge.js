import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Bulk-delete messages from this channel")
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Number of messages to delete (1–100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const cooldownMs = 5000;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const amount = interaction.options.getInteger("amount");

  await interaction.deferReply({ ephemeral: true });

  // Second arg `true` filters messages older than 14 days (Discord API limit)
  const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
  const count = deleted?.size ?? 0;

  await logger.log(interaction.guild, {
    title: "Purge Executed",
    color: 0xff9900,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "Channel", value: `<#${interaction.channelId}>` },
      { name: "Requested", value: String(amount), inline: true },
      { name: "Deleted", value: String(count), inline: true },
    ],
  });

  await interaction.editReply({ content: `Deleted **${count}** message(s).` });
}
