module.exports = {
  apps: [
    {
      name: "IPE-Live",
      script: "server.js",
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
