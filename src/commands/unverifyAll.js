import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("unverify-all")
  .setDescription("Remove the verified role from all members who have it (batch processed)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export const cooldownMs = 60_000;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1200;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId);
  if (!verifiedRole) {
    return interaction.reply({ content: "Verified role is not configured in config.json.", ephemeral: true });
  }

  if (verifiedRole.position >= interaction.guild.members.me.roles.highest.position) {
    return interaction.reply({ content: "Verified role is above my permission level.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const members = await interaction.guild.members.fetch();
  const targets = [...members.filter((m) => m.roles.cache.has(verifiedRole.id)).values()];

  let success = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    await Promise.all(
      targets.slice(i, i + BATCH_SIZE).map(async (m) => {
        try {
          await m.roles.remove(verifiedRole, `/unverify-all by ${interaction.user.tag}`);
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
    title: "Unverify-All Executed",
    color: 0xff9900,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "Removed", value: String(success), inline: true },
      { name: "Failed", value: String(failed), inline: true },
    ],
  });

  await interaction.editReply({
    content: `Done. Removed verified role from **${success}** member(s).${failed ? ` (${failed} failed)` : ""}`,
  });
}
