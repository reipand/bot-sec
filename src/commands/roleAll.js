import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("role-all")
  .setDescription("Add a role to every non-bot member (batch processed)")
  .addRoleOption((opt) =>
    opt.setName("role").setDescription("Role to assign").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export const cooldownMs = 60_000;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1200;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const role = interaction.options.getRole("role");

  if (role.managed || role.id === interaction.guild.roles.everyone.id) {
    return interaction.reply({ content: "That role cannot be assigned.", ephemeral: true });
  }

  if (role.position >= interaction.guild.members.me.roles.highest.position) {
    return interaction.reply({ content: "That role is above my highest role — I cannot assign it.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const members = await interaction.guild.members.fetch();
  const targets = [...members.filter((m) => !m.roles.cache.has(role.id) && !m.user.bot).values()];

  let success = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    await Promise.all(
      targets.slice(i, i + BATCH_SIZE).map(async (m) => {
        try {
          await m.roles.add(role, `/role-all by ${interaction.user.tag}`);
          success++;
        } catch {
          failed++;
        }
      })
    );
    if (i + BATCH_SIZE < targets.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  await logger.log(interaction.guild, {
    title: "Role-All Executed",
    color: 0x5865f2,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "Role", value: role.name, inline: true },
      { name: "Assigned", value: String(success), inline: true },
      { name: "Failed", value: String(failed), inline: true },
    ],
  });

  await interaction.editReply({
    content: `Done. Assigned **${role.name}** to **${success}** member(s).${failed ? ` (${failed} failed)` : ""}`,
  });
}
