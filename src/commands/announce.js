import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Send a rich embed announcement to a channel")
  .addStringOption((opt) => opt.setName("title").setDescription("Embed title").setRequired(true))
  .addStringOption((opt) => opt.setName("description").setDescription("Embed body text").setRequired(true))
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Target channel (defaults to current channel)")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  )
  .addStringOption((opt) =>
    opt.setName("color").setDescription("Hex color code e.g. #ff0000 (default: #5865F2)")
  )
  .addStringOption((opt) => opt.setName("footer").setDescription("Footer text"))
  .addStringOption((opt) => opt.setName("image").setDescription("Image URL (https only)"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const cooldownMs = 10_000;

export async function execute(interaction) {
  const { config, logger } = interaction.client.security;

  if (!isAdmin(interaction.member, config)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const channelOpt = interaction.options.getChannel("channel");
  const colorInput = interaction.options.getString("color");
  const footer = interaction.options.getString("footer");
  const imageInput = interaction.options.getString("image");

  const channel = channelOpt ?? interaction.channel;

  if (!channel.isTextBased()) {
    return interaction.reply({ content: "That channel is not a text channel.", ephemeral: true });
  }

  let color = 0x5865f2;
  if (colorInput) {
    const hex = colorInput.replace(/^#/, "");
    const parsed = parseInt(hex, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xffffff) color = parsed;
  }

  let imageUrl = null;
  if (imageInput) {
    try {
      const u = new URL(imageInput);
      if (u.protocol === "https:") imageUrl = imageInput;
    } catch {
      // invalid URL — skip image silently
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(title.slice(0, 256))
    .setDescription(description.slice(0, 4096))
    .setColor(color)
    .setTimestamp();

  if (footer) embed.setFooter({ text: footer.slice(0, 2048) });
  if (imageUrl) embed.setImage(imageUrl);

  await channel.send({ embeds: [embed] });

  await logger.log(interaction.guild, {
    title: "Announcement Sent",
    color: 0x5865f2,
    fields: [
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "Channel", value: `<#${channel.id}>` },
      { name: "Embed Title", value: title },
    ],
  });

  return interaction.reply({ content: `Announcement sent to <#${channel.id}>.`, ephemeral: true });
}
