import { PermissionFlagsBits } from "discord.js";

// Single-char leet substitutions that scammers rely on
const LEET_MAP = new Map([
  ["0", "o"],
  ["1", "i"],
  ["3", "e"],
  ["4", "a"],
  ["5", "s"],
  ["6", "g"],
  ["7", "t"],
  ["8", "b"],
  ["9", "g"],
  ["@", "a"],
  ["$", "s"],
  ["|", "i"],
  ["!", "i"],
  ["+", "t"],
  ["(", "c"],
  ["[", "c"],
]);

function normalizeLeet(text) {
  return text
    .normalize("NFKC")
    .replace(/[​-‏⁠﻿]/g, "")
    .toLowerCase()
    .split("")
    .map((char) => LEET_MAP.get(char) ?? char)
    .join("");
}

function buildShortenerPattern(shorteners) {
  const escaped = shorteners.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`https?://(${escaped.join("|")})/\\S+`, "gi");
}

export function createAntiPhishing({ config, logger, cache }) {
  let shortenerPattern = null;

  function getShortenerPattern() {
    if (!shortenerPattern && config.antiPhishing?.suspiciousShorteners?.length) {
      shortenerPattern = buildShortenerPattern(
        config.antiPhishing.suspiciousShorteners
      );
    }
    return shortenerPattern;
  }

  function hasBypass(member) {
    if (!member) return false;

    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    return member.roles.cache.some(
      (role) =>
        config.whitelistRoleIds.includes(role.id) ||
        config.adminRoleIds.includes(role.id)
    );
  }

  function detectPhishing(content) {
    const normalized = normalizeLeet(content);
    const detected = [];

    for (const keyword of config.antiPhishing.keywords ?? []) {
      if (normalized.includes(keyword.toLowerCase())) {
        detected.push({ type: "keyword", match: keyword });
      }
    }

    const pattern = getShortenerPattern();

    if (pattern) {
      // Reset lastIndex since the pattern is shared and has the g flag
      pattern.lastIndex = 0;
      const shortLinks = content.match(pattern);

      if (shortLinks) {
        for (const link of shortLinks) {
          detected.push({ type: "shortened_url", match: link });
        }
      }
    }

    return detected;
  }

  async function handleMessage(message) {
    if (!config.antiPhishing?.enabled) return false;

    if (!message.guild || !message.member || message.author.bot) return false;

    if (hasBypass(message.member)) return false;

    const detected = detectPhishing(message.content);

    if (!detected.length) return false;

    await message.delete().catch(() => null);

    const userId = message.author.id;
    const guildId = message.guild.id;

    // Track offenses per user with a 1-hour rolling window
    const offenseKey = `phishing:offense:${guildId}:${userId}`;
    const offenses = await cache.increment(offenseKey, 3_600_000);

    if (config.antiPhishing.warnOnDetection !== false) {
      const warning = await message.channel
        .send({
          content: `<@${userId}> Your message was flagged as a potential phishing or scam attempt and has been removed.`,
          allowedMentions: { users: [userId] },
        })
        .catch(() => null);

      if (warning) {
        setTimeout(() => warning.delete().catch(() => null), 8_000);
      }
    }

    let action = "Message deleted";

    if (
      config.antiPhishing.escalateOnRepeat !== false &&
      offenses >= 3 &&
      message.member.moderatable
    ) {
      await message.member
        .timeout(
          30 * 60_000,
          `Security bot: repeated phishing attempts (offense #${offenses})`
        )
        .catch(() => null);

      action = "Message deleted + 30 minute timeout";
    }

    await logger.log(message.guild, {
      title: "Phishing / Scam Detected",
      color: 0x8b0000,
      fields: [
        { name: "User", value: `${message.author.tag} (${userId})` },
        { name: "Channel", value: `<#${message.channel.id}>` },
        {
          name: "Match",
          value: `${detected[0].type}: \`${detected[0].match.slice(0, 200)}\``,
        },
        { name: "Offense #", value: String(offenses), inline: true },
        { name: "Action", value: action, inline: true },
      ],
    });

    return true;
  }

  return { handleMessage };
}
