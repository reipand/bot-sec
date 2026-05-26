import { PermissionFlagsBits } from "discord.js";

// Discord invite in all common formats
const DISCORD_INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?discord(?:\.gg|(?:app)?\.com\/invite)\/[a-zA-Z0-9\-_]+/gi;

// Any http/https URL
const HTTP_URL_REGEX = /https?:\/\/[^\s<>()[\]"']+/gi;

// Unicode lookalike normalisation — catches zero-width chars and homoglyphs
function normalizeContent(content) {
  return content.normalize("NFKC").replace(/[​-‏⁠﻿]/g, "").trim();
}

function extractHostname(raw) {
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function buildBareDomainRegex(tlds) {
  // Matches bare domains like "claimfree.xyz/path" that lack a protocol
  const tidyTlds = tlds.map((t) => t.replace(/^\./, "")).join("|");
  return new RegExp(
    `(?:^|[\\s(])([a-z0-9][a-z0-9\\-]{0,61}[a-z0-9]\\.(?:${tidyTlds})(?:/[^\\s]*)?)`,
    "gi"
  );
}

export function createAntiLink({ config, logger }) {
  let bareDomainRegex = null;

  function getBareDomainRegex() {
    if (!bareDomainRegex && config.antiLink.suspiciousTlds?.length) {
      bareDomainRegex = buildBareDomainRegex(config.antiLink.suspiciousTlds);
    }
    return bareDomainRegex;
  }

  function getAllowedDomains() {
    return [
      ...(config.antiLink.allowedDomains ?? []),
      ...(config.antiLink.extraAllowedDomains ?? []),
    ].map((d) => d.toLowerCase().replace(/^www\./, ""));
  }

  function isAllowed(hostname) {
    if (!hostname) return false;
    const allowed = getAllowedDomains();
    return allowed.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  }

  function hasSuspiciousTld(hostname) {
    const tlds = config.antiLink.suspiciousTlds ?? [];
    return tlds.some((tld) => hostname.endsWith(tld.startsWith(".") ? tld : `.${tld}`));
  }

  function hasBypass(member) {
    if (!member) return false;

    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    return member.roles.cache.some(
      (role) =>
        ["Admin", "Moderator"].includes(role.name) ||
        config.whitelistRoleIds.includes(role.id) ||
        config.adminRoleIds.includes(role.id)
    );
  }

  function detectLinks(content) {
    const detected = [];

    // Always check for Discord invites if that flag is on
    if (config.antiLink.blockDiscordInvites) {
      DISCORD_INVITE_REGEX.lastIndex = 0;
      const invites = content.match(DISCORD_INVITE_REGEX);

      if (invites) {
        for (const invite of invites) {
          detected.push({ type: "discord_invite", match: invite });
        }
      }
    }

    // Scan http/https URLs
    HTTP_URL_REGEX.lastIndex = 0;
    const urls = content.match(HTTP_URL_REGEX) ?? [];

    for (const url of urls) {
      const hostname = extractHostname(url);
      if (!hostname || isAllowed(hostname)) continue;

      if (config.antiLink.blockAllLinks || hasSuspiciousTld(hostname)) {
        detected.push({ type: "url", match: url });
      }
    }

    // Scan for bare suspicious domains (no protocol prefix)
    const barePattern = getBareDomainRegex();

    if (barePattern) {
      barePattern.lastIndex = 0;
      let m;

      while ((m = barePattern.exec(content)) !== null) {
        const domain = m[1];
        const hostname = extractHostname(domain);

        if (hostname && !isAllowed(hostname)) {
          detected.push({ type: "bare_domain", match: domain });
        }
      }
    }

    return detected;
  }

  async function sendWarning(message, text) {
    const warning = await message.channel
      .send({
        content: `<@${message.author.id}> ${text}`,
        allowedMentions: { users: [message.author.id] },
      })
      .catch(() => null);

    if (warning) {
      setTimeout(
        () => warning.delete().catch(() => null),
        config.antiLink.warningDeleteMs
      );
    }
  }

  async function handleMessage(message) {
    if (!config.antiLink.enabled) return false;

    if (!message.guild || !message.member || message.author.bot) return false;

    if (hasBypass(message.member)) return false;

    const content = normalizeContent(message.content);

    if (!content) return false;

    const detected = detectLinks(content);

    if (!detected.length) return false;

    await message.delete().catch(() => null);
    await sendWarning(message, "links are not allowed here.");

    await logger.log(message.guild, {
      title: "Anti-Link Triggered",
      color: 0xff9900,
      fields: [
        { name: "User", value: `${message.author.tag} (${message.author.id})` },
        { name: "Channel", value: `<#${message.channel.id}>` },
        { name: "Type", value: detected[0].type, inline: true },
        {
          name: "Detected",
          value: `\`${detected[0].match.slice(0, 200)}\``,
          inline: true,
        },
      ],
    });

    return true;
  }

  return {
    handleMessage,
    hasBypass,
  };
}
