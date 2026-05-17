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
            env: {
                // Defina VAGALUME_API_KEY no shell antes de `pm2 start` (ex.: export VAGALUME_API_KEY=...).
                // PM2 propaga variaveis exportadas para process.env do app.
                // Sem essa chave, /api/vagalume/* responde 503.
                VAGALUME_API_KEY: process.env.VAGALUME_API_KEY,
            },
        },
    ],
};
