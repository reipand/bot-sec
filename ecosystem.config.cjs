module.exports = {
  apps: [
    {
      name: "discord-security-bot",
      script: "src/index.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_memory_restart: "300M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
