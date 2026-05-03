import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

const DEFAULT_CONFIG = {
  prefix: "!",
  logChannelId: "",
  verifiedRoleId: "",
  whitelistRoleIds: [],
  adminRoleIds: [],
  antiLink: {
    enabled: true,
    // Set to true to block every http/https URL. false = only suspicious TLDs + Discord invites.
    blockAllLinks: false,
    blockDiscordInvites: true,
    // Suspicious TLDs to block even when blockAllLinks is false
    suspiciousTlds: [
      ".xyz", ".tk", ".ml", ".cf", ".ga", ".gq",
      ".click", ".link", ".pw", ".su", ".ws", ".top",
      ".work", ".club", ".fun", ".win", ".trade", ".science"
    ],
    // Domains always permitted regardless of other rules
    allowedDomains: [
      "discord.com", "discord.gg", "discordapp.com",
      "tenor.com", "giphy.com",
      "youtube.com", "youtu.be",
      "twitch.tv",
      "twitter.com", "x.com",
      "github.com",
      "imgur.com"
    ],
    warningDeleteMs: 5000,
    extraAllowedDomains: []
  },
  antiSpam: {
    enabled: true,
    threshold: 5,
    windowMs: 5000,
    warningDeleteMs: 5000,
    baseTimeoutMinutes: 5,
    secondTimeoutMinutes: 10,
    offenseResetMs: 86400000,
    thirdOffenseAction: "kick"
  },
  antiRaid: {
    enabled: true,
    joinThreshold: 10,
    windowMs: 30000,
    lockdownMinutes: 10,
    restrictEveryoneSendMessages: true,
    ignoreBots: true
  },
  antiPhishing: {
    enabled: true,
    warnOnDetection: true,
    escalateOnRepeat: true,
    keywords: [
      "free nitro",
      "discord nitro free",
      "nitro giveaway",
      "click here to claim",
      "claim your nitro",
      "claim reward",
      "you won",
      "you have won",
      "giveaway fake",
      "steam gift",
      "steam gift card",
      "gift card free",
      "verify account",
      "verify your account",
      "free gift",
      "limited time offer",
      "act now",
      "claim now",
      "airdrop",
      "crypto giveaway",
      "nft giveaway"
    ],
    suspiciousShorteners: [
      "bit.ly", "tinyurl.com", "t.co", "ow.ly", "goo.gl",
      "buff.ly", "is.gd", "rb.gy", "cutt.ly", "shorturl.at",
      "tiny.cc", "soo.gd", "bc.vc", "su.pr", "snipurl.com",
      "short.to", "doiop.com", "short.ie", "kl.am",
      "rubyurl.com", "om.ly", "to.ly", "bit.do", "lnkd.in",
      "db.tt", "qr.ae", "adf.ly", "bitly.com", "tr.im",
      "cli.gs", "migre.me", "ff.im", "murl.com",
      "viralurl.com", "eklly.com"
    ]
  },
  verification: {
    enabled: true,
    channelId: "",
    channelName: "verify-here",
    verifiedRoleName: "Verified",
    unverifiedRoleId: "",
    unverifiedRoleName: "Unverified",
    autoCreateChannel: true,
    restrictViewUntilVerified: false
  }
};

function mergeObjects(base, override) {
  const output = { ...base };

  for (const [key, value] of Object.entries(override ?? {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof base[key] === "object" &&
      base[key] !== null
    ) {
      output[key] = mergeObjects(base[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing config.json at ${CONFIG_PATH}`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const config = mergeObjects(DEFAULT_CONFIG, parsed);

  if (!Array.isArray(config.whitelistRoleIds) || !Array.isArray(config.adminRoleIds)) {
    throw new Error("whitelistRoleIds and adminRoleIds must be arrays.");
  }

  return config;
}
