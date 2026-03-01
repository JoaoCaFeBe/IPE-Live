module.exports = {
    apps: [
        {
            name: "IPE-Live",
            script: "server.js",
            watch: true,
            ignore_watch: ["database", "node_modules", "public/img"],
            instances: 1,
            autorestart: true,
            max_memory_restart: "300M",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
