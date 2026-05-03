import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

const DEFAULT_CHANNEL_NAME = "security-log";

export function createLogger({ client, config }) {
  const channelCache = new Map();

  async function ensureLogChannel(guild) {
    const configured = config.logChannelId
      ? guild.channels.cache.get(config.logChannelId)
      : null;

    if (configured?.isTextBased()) {
      channelCache.set(guild.id, configured.id);
      return configured;
    }

    const existing = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.name === DEFAULT_CHANNEL_NAME
    );

    if (existing) {
      channelCache.set(guild.id, existing.id);
      return existing;
    }

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return null;
    }

    const created = await guild.channels.create({
      name: DEFAULT_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: "Security and moderation events."
    });

    channelCache.set(guild.id, created.id);
    return created;
  }

  async function send(guild, payload) {
    const cachedChannelId = channelCache.get(guild.id);
    const channel =
      guild.channels.cache.get(cachedChannelId) || (await ensureLogChannel(guild));

    if (!channel?.isTextBased()) {
      return;
    }

    await channel.send(payload).catch(() => null);
  }

  async function log(guild, { title, color, fields = [], description }) {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp();

    if (description) {
      embed.setDescription(description.slice(0, 4096));
    }

    if (fields.length > 0) {
      embed.addFields(
        fields.map((field) => ({
          name: field.name,
          value: String(field.value ?? "N/A").slice(0, 1024),
          inline: Boolean(field.inline)
        }))
      );
    }

    await send(guild, { embeds: [embed] });
  }

  return {
    ensureLogChannel,
    log
  };
}
