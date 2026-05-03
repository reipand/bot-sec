# Discord Security Bot

Production-ready Discord security bot built with `discord.js v14` for VPS deployment.

## Features

- Anti-link protection for `http`, `https`, Discord invites, and common bare domains.
- Anti-spam detection with escalating enforcement.
- Anti-raid detection with automatic lockdown and cooldown release.
- Button-based member verification with verified/unverified role flow.
- Security logging to `#security-log`.
- Whitelist and admin bypass support.
- Redis-backed cache support when `REDIS_URL` is configured, with automatic in-memory fallback.

## Project Structure

```text
src/
  events/
    guildMemberAdd.js
    interactionCreate.js
    messageCreate.js
    ready.js
  modules/
    antiLink.js
    antiRaid.js
    antiSpam.js
    logger.js
    verifier.js
  utils/
    cache.js
    config.js
  index.js
```

## Install

```bash
npm install
```

Dependencies:

- `discord.js`
- `dotenv`
- `ioredis`

## Configure

1. Copy `.env.example` to `.env`.
2. Put your bot token in `DISCORD_TOKEN`.
3. Edit `config.json`.
4. Create the bot in the Discord Developer Portal and enable:
   - `Server Members Intent`
   - `Message Content Intent`

## Recommended Discord Permissions

- Manage Roles
- Manage Channels
- Manage Messages
- Moderate Members
- Kick Members
- View Channels
- Send Messages

## Verification Notes

This bot supports an `Unverified` role and a `Verified` role:

- New members get `Unverified`.
- Verified users get `Verified`.
- The bot can auto-create a `verify-here` channel and keep that channel accessible.
- If `restrictViewUntilVerified` is `true`, new users will not see non-verification channels.

For best results, place the bot role above the `Verified` and `Unverified` roles in the role hierarchy.

## VPS Setup (Ubuntu)

```bash
sudo apt update
sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Optional Redis:

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping
```

## Start

Direct:

```bash
npm start
```

PM2:

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Immediate Deployment Checklist

1. `npm install`
2. Set `.env`
3. Edit `config.json`
4. Invite the bot with required permissions
5. Start with `npm start` or `pm2 start ecosystem.config.cjs`
