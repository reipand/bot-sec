import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin, canModerate } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a member from the server")
  .addUserOption((opt) => opt.setName("user").setDescription("User to kick").setRequired(true))
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason"))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export const cooldownMs = 3000;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const target = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!target) {
    return interaction.reply({ content: "That user is not in this server.", ephemeral: true });
  }

  const bot = interaction.guild.members.me;

  if (!canModerate(bot, interaction.member, target)) {
    return interaction.reply({
      content: "I cannot moderate that user — check role hierarchy.",
      ephemeral: true,
    });
  }

  if (!target.kickable) {
    return interaction.reply({ content: "I do not have permission to kick that user.", ephemeral: true });
  }

  const tag = target.user.tag;
  const id = target.id;

  await target.kick(reason);

  await logger.log(interaction.guild, {
    title: "Member Kicked",
    color: 0xff6600,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "User", value: `${tag} (${id})` },
      { name: "Reason", value: reason },
    ],
  });

  return interaction.reply({
    content: `Kicked **${tag}**. Reason: ${reason}`,
    ephemeral: true,
  });
}
