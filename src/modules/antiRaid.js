import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits
} from "discord.js";

export function createAntiRaid({ config, logger, cache, verifier }) {
  const activeLockdowns = new Map();
  const snapshotKeysByGuild = new Map();

  function getSnapshotKey(guildId) {
    return `raid:snapshot:${guildId}`;
  }

  function buildSnapshot(channel, everyoneRoleId) {
    const overwrite = channel.permissionOverwrites.cache.get(everyoneRoleId);

    return {
      channelId: channel.id,
      SendMessages: overwrite ? overwrite.allow.has(PermissionFlagsBits.SendMessages) ? true : overwrite.deny.has(PermissionFlagsBits.SendMessages) ? false : null : null,
      CreatePublicThreads: overwrite ? overwrite.allow.has(PermissionFlagsBits.CreatePublicThreads) ? true : overwrite.deny.has(PermissionFlagsBits.CreatePublicThreads) ? false : null : null,
      CreatePrivateThreads: overwrite ? overwrite.allow.has(PermissionFlagsBits.CreatePrivateThreads) ? true : overwrite.deny.has(PermissionFlagsBits.CreatePrivateThreads) ? false : null : null,
      Connect: overwrite ? overwrite.allow.has(PermissionFlagsBits.Connect) ? true : overwrite.deny.has(PermissionFlagsBits.Connect) ? false : null : null,
      Speak: overwrite ? overwrite.allow.has(PermissionFlagsBits.Speak) ? true : overwrite.deny.has(PermissionFlagsBits.Speak) ? false : null : null
    };
  }

  async function setChannelLock(channel, everyoneRoleId, enabled, snapshot = null) {
    if (!channel.permissionsFor(channel.guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) {
      return;
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement &&
      channel.type !== ChannelType.GuildForum &&
      channel.type !== ChannelType.GuildVoice
    ) {
      return;
    }

    const permissionPayload = {};

    if (
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement ||
      channel.type === ChannelType.GuildForum
    ) {
      permissionPayload.SendMessages = enabled
        ? config.antiRaid.restrictEveryoneSendMessages
          ? false
          : null
        : snapshot?.SendMessages ?? null;
      permissionPayload.CreatePublicThreads = enabled ? false : snapshot?.CreatePublicThreads ?? null;
      permissionPayload.CreatePrivateThreads = enabled ? false : snapshot?.CreatePrivateThreads ?? null;
    }

    if (channel.type === ChannelType.GuildVoice) {
      permissionPayload.Connect = enabled ? false : snapshot?.Connect ?? null;
      permissionPayload.Speak = enabled ? false : snapshot?.Speak ?? null;
    }

    await channel.permissionOverwrites.edit(everyoneRoleId, permissionPayload).catch(() => null);
  }

  async function enableLockdown(guild, reason) {
    if (activeLockdowns.has(guild.id)) {
      return;
    }

    activeLockdowns.set(guild.id, true);
    const everyoneRoleId = guild.roles.everyone.id;
    const verificationChannelId = verifier.getVerificationChannelId(guild.id);
    const snapshots = [];

    for (const channel of guild.channels.cache.values()) {
      if (channel.id === verificationChannelId) {
        continue;
      }

      const snapshot = buildSnapshot(channel, everyoneRoleId);
      snapshots.push(snapshot);
      await setChannelLock(channel, everyoneRoleId, true, snapshot);
    }

    snapshotKeysByGuild.set(guild.id, snapshots);
    await cache.set(getSnapshotKey(guild.id), JSON.stringify(snapshots), config.antiRaid.lockdownMinutes * 60 * 1000);
    await logger.log(guild, {
      title: "Raid Detected",
      color: 0xff0000,
      description: reason
    });

    const durationMs = config.antiRaid.lockdownMinutes * 60 * 1000;
    await cache.set(`raid:lockdown:${guild.id}`, String(Date.now() + durationMs), durationMs);

    setTimeout(async () => {
      await disableLockdown(guild, "Automatic lockdown cooldown expired.");
    }, durationMs);
  }

  async function disableLockdown(guild, reason) {
    if (!activeLockdowns.has(guild.id)) {
      return;
    }

    activeLockdowns.delete(guild.id);
    const everyoneRoleId = guild.roles.everyone.id;
    const verificationChannelId = verifier.getVerificationChannelId(guild.id);
    const snapshots =
      snapshotKeysByGuild.get(guild.id) ??
      JSON.parse((await cache.get(getSnapshotKey(guild.id))) || "[]");

    for (const channel of guild.channels.cache.values()) {
      if (channel.id === verificationChannelId) {
        continue;
      }

      const snapshot = snapshots.find((entry) => entry.channelId === channel.id) ?? null;
      await setChannelLock(channel, everyoneRoleId, false, snapshot);
    }

    await cache.delete(`raid:lockdown:${guild.id}`);
    await cache.delete(getSnapshotKey(guild.id));
    snapshotKeysByGuild.delete(guild.id);
    await logger.log(guild, {
      title: "Lockdown Released",
      color: 0x00cc66,
      description: reason
    });
  }

  async function handleJoin(member) {
    if (!config.antiRaid.enabled) {
      return;
    }

    if (config.antiRaid.ignoreBots && member.user.bot) {
      return;
    }

    const bucketKey = `raid:joins:${member.guild.id}`;
    const count = await cache.pushTimestamp(
      bucketKey,
      Date.now(),
      config.antiRaid.windowMs
    );

    if (count >= config.antiRaid.joinThreshold) {
      await enableLockdown(
        member.guild,
        `${count} joins detected within ${config.antiRaid.windowMs / 1000} seconds.`
      );
    }
  }

  async function restoreLockdowns(guild) {
    const lockUntil = await cache.get(`raid:lockdown:${guild.id}`);

    if (!lockUntil) {
      return;
    }

    const remaining = Number(lockUntil) - Date.now();

    if (remaining <= 0) {
      await cache.delete(`raid:lockdown:${guild.id}`);
      return;
    }

    activeLockdowns.set(guild.id, true);
    const snapshots = JSON.parse((await cache.get(getSnapshotKey(guild.id))) || "[]");
    snapshotKeysByGuild.set(guild.id, snapshots);
    setTimeout(async () => {
      await disableLockdown(guild, "Restored lockdown cooldown expired.");
    }, remaining);
  }

  return {
    handleJoin,
    restoreLockdowns
  };
}
