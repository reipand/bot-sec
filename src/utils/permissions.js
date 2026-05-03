import { PermissionFlagsBits } from "discord.js";

export function isAdmin(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(
    (role) =>
      config.adminRoleIds.includes(role.id) ||
      role.name === "Admin" ||
      role.name === "Moderator"
  );
}

/**
 * Returns true if `bot` and `moderator` can act on `target` (role hierarchy
 * check). All three are GuildMember instances.
 */
export function canModerate(bot, moderator, target) {
  if (!bot || !moderator || !target) return false;
  if (target.id === target.guild.ownerId) return false;
  if (target.id === moderator.id) return false;

  const botHighest = bot.roles.highest.position;
  const modHighest = moderator.roles.highest.position;
  const targetHighest = target.roles.highest.position;

  if (targetHighest >= botHighest) return false;
  if (targetHighest >= modHighest) return false;

  return true;
}
