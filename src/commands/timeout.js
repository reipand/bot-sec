import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin, canModerate } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Timeout a member")
  .addUserOption((opt) => opt.setName("user").setDescription("User to timeout").setRequired(true))
  .addIntegerOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Duration in minutes (max 40320 = 28 days)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(40320)
  )
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const cooldownMs = 3000;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const target = interaction.options.getMember("user");
  const durationMin = interaction.options.getInteger("duration");
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

  if (!target.moderatable) {
    return interaction.reply({ content: "I do not have permission to timeout that user.", ephemeral: true });
  }

  await target.timeout(durationMin * 60 * 1000, reason);

  await logger.log(interaction.guild, {
    title: "Member Timed Out",
    color: 0xff9900,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "User", value: `${target.user.tag} (${target.id})` },
      { name: "Duration", value: `${durationMin} minute(s)`, inline: true },
      { name: "Reason", value: reason, inline: true },
    ],
  });

  return interaction.reply({
    content: `Timed out **${target.user.tag}** for **${durationMin}** minute(s). Reason: ${reason}`,
    ephemeral: true,
  });
}
