# Ubuntu VPS Deployment Guide

## Prerequisites

- Ubuntu 22.04 LTS or 24.04 LTS
- Root or sudo access
- A Discord bot token from the [Developer Portal](https://discord.com/developers/applications)
- At least **512 MB RAM** (1 GB recommended for Redis)

---

## 1. System Setup

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install curl and build tools
sudo apt install -y curl git build-essential
```

---

## 2. Install Node.js 22 (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # should print v22.x.x
npm -v
```

---

## 3. Install PM2

```bash
sudo npm install -g pm2

# Make PM2 start on system boot
pm2 startup systemd
# Run the printed command with sudo, then:
pm2 save
```

---

## 4. (Optional) Install Redis

Redis is used for distributed spam / raid tracking and survives bot restarts.

```bash
sudo apt install -y redis-server

# Enable and start
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Test
redis-cli ping   # should return PONG
```

---

## 5. Deploy the Bot

```bash
# Clone or upload your code
git clone <your-repo-url> /opt/discord-security-bot
cd /opt/discord-security-bot

# Install production dependencies
npm ci --omit=dev
```

---

## 6. Configure Environment

```bash
cp .env.example .env
nano .env
```

Paste your values:

```env
DISCORD_TOKEN=your_bot_token_here

# Remove this line if you are not using Redis
REDIS_URL=redis://127.0.0.1:6379
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

---

## 7. Configure the Bot

```bash
cp config.example.json config.json
nano config.json
```

Fill in your server-specific IDs:

| Key | Description |
|---|---|
| `logChannelId` | Channel ID for security event logs |
| `verifiedRoleId` | Role assigned after verification |
| `whitelistRoleIds` | Array of role IDs immune to all filters |
| `adminRoleIds` | Array of admin role IDs |
| `verification.channelId` | ID of your `#verify-here` channel (leave blank to auto-create) |

---

## 8. Start the Bot

```bash
# Using the npm convenience script
npm run pm2:start

# Or directly
pm2 start ecosystem.config.cjs
```

### Useful PM2 Commands

```bash
npm run pm2:status    # Show running processes
npm run pm2:logs      # Live log tail
npm run pm2:restart   # Restart the bot
npm run pm2:reload    # Zero-downtime reload
npm run pm2:stop      # Stop the bot
```

---

## 9. Discord Bot Permissions

When adding the bot to your server, it needs these permissions:

**Required intents** (enable in Developer Portal → Bot):
- `Server Members Intent`
- `Message Content Intent`

**Required OAuth2 scopes:** `bot`, `applications.commands`

**Required bot permissions:**
| Permission | Purpose |
|---|---|
| Manage Roles | Assign Verified / Unverified roles |
| Manage Channels | Create verify channel, lock channels during raid |
| Kick Members | Anti-spam 3rd offense |
| Moderate Members | Timeout (anti-spam, anti-phishing) |
| Read Messages / View Channels | Read messages for filtering |
| Send Messages | Send warnings and verification embed |
| Manage Messages | Delete flagged messages |
| Read Message History | Fetch recent messages for verification panel |

> **Role Hierarchy:** The bot's role must be **above** any role it needs to manage or moderate.

---

## 10. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

The bot makes outbound HTTPS connections to Discord only — no inbound ports are needed.

---

## 11. Updating the Bot

```bash
cd /opt/discord-security-bot
git pull
npm ci --omit=dev
npm run pm2:reload
```

---

## Troubleshooting

**Bot doesn't start:**
```bash
npm run pm2:logs
# or
node src/index.js   # run directly to see startup errors
```

**Verification panel not appearing:**
- Ensure `verifiedRoleId` and `verification.channelId` are set correctly in `config.json`.
- The bot re-checks on every restart; if the panel already exists it won't duplicate it.

**Lockdown not releasing:**
- If the bot restarts during a lockdown, it reads the remaining duration from cache (Redis) and resumes the timer automatically.
- Without Redis, lockdown timers are lost on restart. Permissions must be restored manually in that case.

**Anti-phishing false positives:**
- Remove the triggering keyword from the `antiPhishing.keywords` array in `config.json`.
- Restart is not required — but a reload (`npm run pm2:reload`) applies the new config.

---

## Resource Monitoring

```bash
pm2 monit               # CPU / memory live dashboard
journalctl -u pm2-root  # systemd journal for PM2
```

Typical idle usage: **~60–90 MB RAM**, **<1% CPU** for a 1000-member server.
