import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

const VERIFY_BUTTON_ID = "security:verify";

export function createVerifier({ config, logger }) {
  const verificationChannels = new Map();

  async function ensureRole(guild, roleId, fallbackName) {
    if (roleId) {
      const existing = guild.roles.cache.get(roleId);

      if (existing) {
        return existing;
      }
    }

    const named = guild.roles.cache.find((role) => role.name === fallbackName);

    if (named) {
      return named;
    }

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return null;
    }

    return guild.roles.create({
      name: fallbackName,
      mentionable: false,
      reason: "Security bot verification setup"
    });
  }

  async function ensureVerificationChannel(guild, unverifiedRole) {
    const configured = config.verification.channelId
      ? guild.channels.cache.get(config.verification.channelId)
      : null;

    if (configured?.isTextBased()) {
      verificationChannels.set(guild.id, configured.id);
      return configured;
    }

    const existing = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.name === config.verification.channelName
    );

    if (existing) {
      verificationChannels.set(guild.id, existing.id);
      return existing;
    }

    if (!config.verification.autoCreateChannel) {
      return null;
    }

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return null;
    }

    const overwrites = [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ];

    if (unverifiedRole) {
      overwrites.push({
        id: unverifiedRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }

    const channel = await guild.channels.create({
      name: config.verification.channelName,
      type: ChannelType.GuildText,
      topic: "Verify here to unlock the server.",
      permissionOverwrites: overwrites
    });

    verificationChannels.set(guild.id, channel.id);
    return channel;
  }

  async function syncChannelPermissions(guild, unverifiedRole, verifyChannelId) {
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return;
    }

    for (const channel of guild.channels.cache.values()) {
      if (!("permissionOverwrites" in channel)) {
        continue;
      }

      if (channel.id === verifyChannelId) {
        continue;
      }

      if (unverifiedRole) {
        await channel.permissionOverwrites.edit(unverifiedRole.id, {
          ViewChannel: config.verification.restrictViewUntilVerified ? false : null,
          SendMessages: false,
          AddReactions: false,
          Connect: false,
          Speak: false
        }).catch(() => null);
      }
    }
  }

  async function sendVerificationPanel(channel) {
    const recentMessages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const exists = recentMessages?.some(
      (message) => message.author.id === channel.client.user.id && message.components.length > 0
    );

    if (exists) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Server Verification")
      .setDescription("Press the button below to verify and unlock the server.")
      .setColor(0x00bcd4);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(VERIFY_BUTTON_ID)
        .setLabel("Verify")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
  }

  async function ensureSetup(guild) {
    if (!config.verification.enabled) {
      return;
    }

    const verifiedRole = await ensureRole(
      guild,
      config.verifiedRoleId,
      config.verification.verifiedRoleName
    );
    const unverifiedRole = await ensureRole(
      guild,
      config.verification.unverifiedRoleId,
      config.verification.unverifiedRoleName
    );
    const channel = await ensureVerificationChannel(guild, unverifiedRole);

    if (channel) {
      await syncChannelPermissions(guild, unverifiedRole, channel.id);
      await sendVerificationPanel(channel);
      verificationChannels.set(guild.id, channel.id);
    }
  }

  async function handleMemberJoin(member) {
    if (!config.verification.enabled || member.user.bot) {
      return;
    }

    const unverifiedRole = await ensureRole(
      member.guild,
      config.verification.unverifiedRoleId,
      config.verification.unverifiedRoleName
    );

    if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
      await member.roles.add(unverifiedRole, "Security bot: new member verification gate").catch(() => null);
    }
  }

  async function handleButton(interaction) {
    if (interaction.customId !== VERIFY_BUTTON_ID) {
      return;
    }

    const verifiedRole = await ensureRole(
      interaction.guild,
      config.verifiedRoleId,
      config.verification.verifiedRoleName
    );
    const unverifiedRole = await ensureRole(
      interaction.guild,
      config.verification.unverifiedRoleId,
      config.verification.unverifiedRoleName
    );

    if (!verifiedRole) {
      await interaction.reply({
        content: "Verification is not configured correctly.",
        ephemeral: true
      });
      await logger.log(interaction.guild, {
        title: "Verification Failed",
        color: 0xff0000,
        fields: [{ name: "User", value: `${interaction.user.tag} (${interaction.user.id})` }]
      });
      return;
    }

    const member = interaction.member;

    if (!member.roles.cache.has(verifiedRole.id)) {
      await member.roles.add(verifiedRole, "Security bot: member verified").catch(() => null);
    }

    if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
      await member.roles.remove(unverifiedRole, "Security bot: member verified").catch(() => null);
    }

    await interaction.reply({
      content: "Verification successful. Access granted.",
      ephemeral: true
    });

    await logger.log(interaction.guild, {
      title: "Verification Success",
      color: 0x00cc66,
      fields: [{ name: "User", value: `${interaction.user.tag} (${interaction.user.id})` }]
    });
  }

  function getVerificationChannelId(guildId) {
    return verificationChannels.get(guildId) ?? null;
  }

  return {
    ensureSetup,
    handleMemberJoin,
    handleButton,
    getVerificationChannelId
  };
}
