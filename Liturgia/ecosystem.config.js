module.exports = {
  apps: [
    {
      name: "IPE-Liturgia",
      script: "server.js",
      watch: true,
      ignore_watch: ["Cultos", "database", "node_modules"],
      instances: 1,
      autorestart: true,
      max_memory_restart: "200M",
    },
  ],
};
