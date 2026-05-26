/**
 * Register slash commands with Discord.
 *
 * Usage:
 *   # Guild (instant, for development):
 *   GUILD_ID=your_guild_id node scripts/deploy-commands.js
 *
 *   # Global (up to 1 hour to propagate):
 *   node scripts/deploy-commands.js
 *
 *   # Wipe ALL commands (both guild and global):
 *   node scripts/deploy-commands.js --clear
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
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error("❌ DISCORD_TOKEN is missing. Add it to .env");
  process.exit(1);
}
if (!clientId) {
  console.error("❌ CLIENT_ID is missing. Add your application ID to .env");
  process.exit(1);
}

const args = process.argv.slice(2);
const shouldClear = args.includes("--clear");
const guildOnly = args.includes("--guild-only");

if (guildOnly && !guildId) {
  console.error("❌ GUILD_ID is missing. Add it to .env to use guild-scoped deployment.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

try {
  // ── Clear mode ──────────────────────────────────────────────────────────────
  if (shouldClear) {
    console.log("Wiping all registered commands...\n");

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      console.log(`  ✓ Cleared guild commands (guild ${guildId})`);
    }

    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("  ✓ Cleared global commands");
    console.log("\n✅ All commands removed. Run deploy again to re-register.");
    process.exit(0);
  }

  // ── Load commands from disk ─────────────────────────────────────────────────
  console.log("Loading commands...\n");
  const commands = [];

  for (const file of readdirSync(commandsDir).filter((f) => f.endsWith(".js"))) {
    const mod = await import(pathToFileURL(join(commandsDir, file)).href);
    if (mod.data?.toJSON) {
      commands.push(mod.data.toJSON());
      console.log(`  ✓ ${file.padEnd(20)} → /${mod.data.name}`);
    } else {
      console.warn(`  ⚠ ${file} — skipped (missing data export)`);
    }
  }

  if (commands.length === 0) {
    console.error("\n❌ No commands found to register. Check src/commands/.");
    process.exit(1);
  }

  console.log(`\nRegistering ${commands.length} command(s)...\n`);

  // ── Register ────────────────────────────────────────────────────────────────
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`✅ Registered ${commands.length} guild command(s) → guild ${guildId}`);
    console.log("   Commands are available instantly.\n");

    // Warn if global commands also exist — users would see doubles
    const globalCmds = await rest.get(Routes.applicationCommands(clientId)).catch(() => []);
    if (globalCmds.length > 0) {
      console.warn(`⚠  ${globalCmds.length} global command(s) still exist — users may see duplicates.`);
      console.warn("   Run  npm run deploy:clear  to remove them.\n");
    }
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`✅ Registered ${commands.length} global command(s)`);
    console.log("   ⏱  Global commands can take up to 1 hour to appear in Discord.\n");
    console.log("Tip: set GUILD_ID in .env for instant updates during development.");
  }
} catch (error) {
  console.error("\n❌ Registration failed:");

  if (error.status === 401) {
    console.error("   DISCORD_TOKEN is invalid or expired.");
  } else if (error.status === 403) {
    console.error("   Missing 'applications.commands' OAuth2 scope. Re-invite the bot.");
  } else if (error.status === 404) {
    console.error("   CLIENT_ID or GUILD_ID not found — double-check your IDs.");
  } else {
    console.error("  ", error.message ?? error);
    if (error.rawError?.errors) {
      console.error(JSON.stringify(error.rawError.errors, null, 2));
    }
  }

  process.exit(1);
}
