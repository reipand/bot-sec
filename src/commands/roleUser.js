import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("role-user")
  .setDescription("Give or remove a role from a specific user")
  .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
  .addRoleOption((opt) => opt.setName("role").setDescription("Role").setRequired(true))
  .addStringOption((opt) =>
    opt
      .setName("action")
      .setDescription("Give or remove the role (default: give)")
      .addChoices({ name: "Give", value: "give" }, { name: "Remove", value: "remove" })
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export const cooldownMs = 3000;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const target = interaction.options.getMember("user");
  const role = interaction.options.getRole("role");
  const action = interaction.options.getString("action") ?? "give";

  if (!target) {
    return interaction.reply({ content: "That user is not in this server.", ephemeral: true });
  }

  if (role.managed || role.id === interaction.guild.roles.everyone.id) {
    return interaction.reply({ content: "That role cannot be assigned.", ephemeral: true });
  }

  if (role.position >= interaction.guild.members.me.roles.highest.position) {
    return interaction.reply({ content: "That role is above my permission level.", ephemeral: true });
  }

  if (action === "give") {
    await target.roles.add(role, `/role-user by ${interaction.user.tag}`);
  } else {
    await target.roles.remove(role, `/role-user remove by ${interaction.user.tag}`);
  }

  await logger.log(interaction.guild, {
    title: action === "give" ? "Role Assigned" : "Role Removed",
    color: action === "give" ? 0x5865f2 : 0xff9900,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "Target", value: `${target.user.tag} (${target.id})` },
      { name: "Role", value: role.name },
      { name: "Action", value: action },
    ],
  });

  return interaction.reply({
    content: `Successfully ${action === "give" ? "gave" : "removed"} **${role.name}** ${action === "give" ? "to" : "from"} **${target.user.tag}**.`,
    ephemeral: true,
  });
}
