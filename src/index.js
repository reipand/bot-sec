import "dotenv/config";
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials
} from "discord.js";
import { loadConfig } from "./utils/config.js";
import { createCache } from "./utils/cache.js";
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

if (!token) {
  throw new Error("Missing DISCORD_TOKEN in environment.");
}

const config = loadConfig();
const cache = await createCache({
  redisUrl: process.env.REDIS_URL,
  keyPrefix: "security-bot"
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const logger = createLogger({ client, config });
const verifier = createVerifier({ client, config, logger });
const antiRaid = createAntiRaid({ client, config, logger, cache, verifier });
const antiLink = createAntiLink({ client, config, logger });
const antiSpam = createAntiSpam({ client, config, logger, cache });
const antiPhishing = createAntiPhishing({ config, logger, cache });

client.security = {
  cache,
  config,
  logger,
  antiLink,
  antiSpam,
  antiRaid,
  antiPhishing,
  verifier,
};

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

process.on("SIGINT", async () => {
  await cache.disconnect();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cache.disconnect();
  client.destroy();
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandled-rejection]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaught-exception]", error);
});

await client.login(token);
