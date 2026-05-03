/**
 * Register slash commands with Discord.
 *
 * Usage:
 *   # Guild-only (instant, for development):
 *   GUILD_ID=your_guild_id node scripts/deploy-commands.js
 *
 *   # Global (can take up to 1 hour to propagate):
 *   node scripts/deploy-commands.js
 */
import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, "../src/commands");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // optional

if (!token) throw new Error("DISCORD_TOKEN is missing from .env");
if (!clientId) throw new Error("CLIENT_ID is missing from .env");

const commands = [];

for (const file of readdirSync(commandsDir).filter((f) => f.endsWith(".js"))) {
  const mod = await import(pathToFileURL(join(commandsDir, file)).href);
  if (mod.data?.toJSON) {
    commands.push(mod.data.toJSON());
    console.log(`  ✓ Loaded  /${mod.data.name}`);
  }
}

const rest = new REST({ version: "10" }).setToken(token);

if (guildId) {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log(`\n✅ Registered ${commands.length} guild command(s) → guild ${guildId} (instant)`);
} else {
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`\n✅ Registered ${commands.length} global command(s) (up to 1 hour to propagate)`);
}
