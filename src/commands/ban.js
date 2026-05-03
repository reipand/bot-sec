import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin, canModerate } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user from the server")
  .addUserOption((opt) => opt.setName("user").setDescription("User to ban").setRequired(true))
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason"))
  .addIntegerOption((opt) =>
    opt
      .setName("delete_days")
      .setDescription("Delete message history (0–7 days, default 0)")
      .setMinValue(0)
      .setMaxValue(7)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export const cooldownMs = 3000;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const targetUser = interaction.options.getUser("user");
  const targetMember = interaction.options.getMember("user"); // null if not in guild
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

  const bot = interaction.guild.members.me;

  if (targetMember) {
    if (!canModerate(bot, interaction.member, targetMember)) {
      return interaction.reply({
        content: "I cannot moderate that user — check role hierarchy.",
        ephemeral: true,
      });
    }
    if (!targetMember.bannable) {
      return interaction.reply({ content: "I do not have permission to ban that user.", ephemeral: true });
    }
  }

  await interaction.guild.members.ban(targetUser.id, {
    reason,
    deleteMessageSeconds: deleteDays * 86400,
  });

  await logger.log(interaction.guild, {
    title: "Member Banned",
    color: 0xff0000,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "User", value: `${targetUser.tag} (${targetUser.id})` },
      { name: "Reason", value: reason },
      { name: "Msg Delete", value: `${deleteDays} day(s)`, inline: true },
    ],
  });

  return interaction.reply({
    content: `Banned **${targetUser.tag}**. Reason: ${reason}`,
    ephemeral: true,
  });
}
