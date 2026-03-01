module.exports = {
    apps: [
        {
            name: "IPE-Liturgia",
            script: "server.js",
            watch: true,
            ignore_watch: ["database", "cultos", "node_modules", "public/img"],
            instances: 1,
            autorestart: true,
            max_memory_restart: "200M",
        },
    ],
};
