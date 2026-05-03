import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin, canModerate } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("tempban")
  .setDescription("Temporarily ban a user — auto-unbans after the duration")
  .addUserOption((opt) => opt.setName("user").setDescription("User to ban").setRequired(true))
  .addIntegerOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Ban duration in minutes (max 10080 = 7 days)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(10080)
  )
  .addStringOption((opt) => opt.setName("reason").setDescription("Reason"))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export const cooldownMs = 5000;

export async function execute(interaction) {
  const { config, logger, tempbanManager } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const targetUser = interaction.options.getUser("user");
  const targetMember = interaction.options.getMember("user");
  const durationMin = interaction.options.getInteger("duration");
  const reason = interaction.options.getString("reason") ?? "No reason provided";

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

  const durationMs = durationMin * 60 * 1000;

  await interaction.guild.members.ban(targetUser.id, {
    reason: `[TEMPBAN ${durationMin}m] ${reason}`,
  });

  await tempbanManager.scheduleTempban(interaction.guild, targetUser.id, durationMs);

  await logger.log(interaction.guild, {
    title: "Member Tempbanned",
    color: 0xff0000,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "User", value: `${targetUser.tag} (${targetUser.id})` },
      { name: "Duration", value: `${durationMin} minute(s)`, inline: true },
      { name: "Reason", value: reason, inline: true },
    ],
  });

  return interaction.reply({
    content: `Tempbanned **${targetUser.tag}** for **${durationMin}** minute(s). They will be automatically unbanned.`,
    ephemeral: true,
  });
}
