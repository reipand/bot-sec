import { PermissionFlagsBits } from "discord.js";

export function createAntiSpam({ config, logger, cache }) {
  const violationCooldown = new Map();

  function hasBypass(member) {
    if (!member) {
      return false;
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    return member.roles.cache.some(
      (role) =>
        ["Admin", "Moderator"].includes(role.name) ||
        config.whitelistRoleIds.includes(role.id) ||
        config.adminRoleIds.includes(role.id)
    );
  }

  async function warn(channel, userId, text, deleteMs) {
    if (!channel?.isTextBased?.()) {
      return;
    }

    const warning = await channel
      .send({
        content: `<@${userId}> ${text}`,
        allowedMentions: { users: [userId] }
      })
      .catch(() => null);

    if (warning) {
      setTimeout(() => {
        warning.delete().catch(() => null);
      }, deleteMs);
    }
  }

  async function escalate(member, messageCount) {
    const offenseKey = `spam:offense:${member.guild.id}:${member.id}`;
    const offenses = (await cache.increment(offenseKey, config.antiSpam.offenseResetMs)) || 1;
    const offenseLevel = Math.min(offenses, 3);
    const fallbackChannel =
      member.guild.systemChannel ||
      member.guild.channels.cache.get(member.guild.rulesChannelId) ||
      member.guild.channels.cache.find((channel) => channel.isTextBased());

    // Offense #1 — warning only (no timeout)
    if (offenseLevel === 1) {
      await warn(
        fallbackChannel,
        member.id,
        `please stop spamming (${messageCount} messages too fast). Further violations will result in a timeout.`,
        config.antiSpam.warningDeleteMs
      );
      await logger.log(member.guild, {
        title: "Anti-Spam Warning",
        color: 0xffcc00,
        fields: [
          { name: "User", value: `${member.user.tag} (${member.id})` },
          { name: "Offense", value: "1", inline: true },
          { name: "Action", value: "Warning issued", inline: true },
        ],
      });
      return;
    }

    // Offense #2 — first timeout
    if (offenseLevel === 2) {
      if (member.moderatable) {
        await member.timeout(
          config.antiSpam.baseTimeoutMinutes * 60 * 1000,
          "Security bot: spam offense #2"
        );
      }

      await warn(
        fallbackChannel,
        member.id,
        member.moderatable
          ? `you have been timed out for ${config.antiSpam.baseTimeoutMinutes} minute(s) for spamming.`
          : `you triggered anti-spam, but this bot lacks permission to timeout you.`,
        config.antiSpam.warningDeleteMs
      );
      await logger.log(member.guild, {
        title: "Anti-Spam Timeout",
        color: 0xff9900,
        fields: [
          { name: "User", value: `${member.user.tag} (${member.id})` },
          { name: "Offense", value: "2", inline: true },
          {
            name: "Action",
            value: member.moderatable
              ? `${config.antiSpam.baseTimeoutMinutes} minute timeout`
              : "warning only (missing permissions)",
            inline: true,
          },
        ],
      });
      return;
    }

    const action = config.antiSpam.thirdOffenseAction === "ban" ? "ban" : "kick";
    let resolvedAction = action;

    if (action === "ban" && member.bannable) {
      await member.ban({ reason: "Security bot: repeated spam offenses" });
    } else if (member.kickable) {
      await member.kick("Security bot: repeated spam offenses");
      resolvedAction = "kick";
    } else if (member.moderatable) {
      await member.timeout(
        config.antiSpam.secondTimeoutMinutes * 60 * 1000,
        "Security bot: repeated spam offenses - fallback timeout"
      );
      resolvedAction = `${config.antiSpam.secondTimeoutMinutes} minute fallback timeout`;
    } else {
      resolvedAction = "unable to punish: missing permissions";
    }

    await logger.log(member.guild, {
      title: "Anti-Spam Final Escalation",
      color: 0xff0000,
      fields: [
        { name: "User", value: `${member.user.tag} (${member.id})` },
        { name: "Offense", value: String(offenses), inline: true },
        { name: "Action", value: resolvedAction, inline: true },
      ],
    });
  }

  async function handleMessage(message) {
    if (!config.antiSpam.enabled) {
      return false;
    }

    if (!message.guild || !message.member || message.author.bot) {
      return false;
    }

    if (hasBypass(message.member)) {
      return false;
    }

    const bucketKey = `spam:bucket:${message.guild.id}:${message.author.id}`;
    const count = await cache.pushTimestamp(
      bucketKey,
      Date.now(),
      config.antiSpam.windowMs
    );

    if (count <= config.antiSpam.threshold) {
      return false;
    }

    const cooldownKey = `${message.guild.id}:${message.author.id}`;

    if (violationCooldown.has(cooldownKey)) {
      await message.delete().catch(() => null);
      return true;
    }

    violationCooldown.set(cooldownKey, Date.now());
    setTimeout(() => violationCooldown.delete(cooldownKey), config.antiSpam.windowMs);

    await message.delete().catch(() => null);
    await escalate(message.member, count);
    await logger.log(message.guild, {
      title: "Spam Message Deleted",
      color: 0xffcc00,
      fields: [
        { name: "User", value: `${message.author.tag} (${message.author.id})` },
        { name: "Channel", value: `<#${message.channel.id}>` },
        { name: "Count", value: String(count) }
      ]
    });

    return true;
  }

  return {
    handleMessage
  };
}
