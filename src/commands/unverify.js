import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("unverify")
  .setDescription("Remove the verified role from a user")
  .addUserOption((opt) => opt.setName("user").setDescription("User to unverify").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export const cooldownMs = 3000;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const target = interaction.options.getMember("user");
  if (!target) {
    return interaction.reply({ content: "That user is not in this server.", ephemeral: true });
  }

  const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId);
  if (!verifiedRole) {
    return interaction.reply({ content: "Verified role is not configured in config.json.", ephemeral: true });
  }

  if (!target.roles.cache.has(verifiedRole.id)) {
    return interaction.reply({ content: `**${target.user.tag}** does not have the verified role.`, ephemeral: true });
  }

  await target.roles.remove(verifiedRole, `/unverify by ${interaction.user.tag}`);

  const unverifiedRoleId = config.verification?.unverifiedRoleId;
  if (unverifiedRoleId) {
    const unverifiedRole = interaction.guild.roles.cache.get(unverifiedRoleId);
    if (unverifiedRole) {
      await target.roles.add(unverifiedRole, "verification revoked").catch(() => null);
    }
  }

  await logger.log(interaction.guild, {
    title: "User Unverified (Manual)",
    color: 0xff9900,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "User", value: `${target.user.tag} (${target.id})` },
    ],
  });

  return interaction.reply({ content: `Unverified **${target.user.tag}**.`, ephemeral: true });
}
