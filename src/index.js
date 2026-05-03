import "dotenv/config";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  Collection,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { loadConfig } from "./utils/config.js";
import { createCache } from "./utils/cache.js";
import { createTempbanManager } from "./utils/tempban.js";
import { createLogger } from "./modules/logger.js";
import { createAntiLink } from "./modules/antiLink.js";
import { createAntiSpam } from "./modules/antiSpam.js";
import { createAntiRaid } from "./modules/antiRaid.js";
import { createAntiPhishing } from "./modules/antiPhishing.js";
import { createVerifier } from "./modules/verifier.js";
import { onMessageCreate } from "./events/messageCreate.js";
import { onGuildMemberAdd } from "./events/guildMemberAdd.js";
import { onInteractionCreate } from "./events/interactionCreate.js";
import { onReady } from "./events/ready.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("Missing DISCORD_TOKEN in environment.");

// ── Config & cache ─────────────────────────────────────────────────────────
const config = loadConfig();
const cache = await createCache({
  redisUrl: process.env.REDIS_URL,
  keyPrefix: "security-bot",
});

// ── Discord client ─────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ── Security modules ───────────────────────────────────────────────────────
const logger = createLogger({ client, config });
const verifier = createVerifier({ client, config, logger });
const antiRaid = createAntiRaid({ client, config, logger, cache, verifier });
const antiLink = createAntiLink({ client, config, logger });
const antiSpam = createAntiSpam({ client, config, logger, cache });
const antiPhishing = createAntiPhishing({ config, logger, cache });
const tempbanManager = createTempbanManager({ cache, logger });

client.security = {
  cache,
  config,
  logger,
  antiLink,
  antiSpam,
  antiRaid,
  antiPhishing,
  verifier,
  tempbanManager,
};

// ── Slash command loader ───────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, "commands");

client.commands = new Collection();
client.commandCooldowns = new Map();

for (const file of readdirSync(commandsDir).filter((f) => f.endsWith(".js"))) {
  const mod = await import(pathToFileURL(join(commandsDir, file)).href);
  if (mod.data && mod.execute) {
    client.commands.set(mod.data.name, mod);
  }
}

// ── Events ─────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async (readyClient) => {
  await onReady(readyClient);
});

client.on(Events.MessageCreate, async (message) => {
  await onMessageCreate(message);
});

client.on(Events.GuildMemberAdd, async (member) => {
  await onGuildMemberAdd(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
  await onInteractionCreate(interaction);
});

client.on(Events.Error, (error) => {
  console.error("[discord-client-error]", error);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown() {
  await cache.disconnect();
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  console.error("[unhandled-rejection]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaught-exception]", error);
});

await client.login(token);
