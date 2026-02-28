module.exports = {
    apps: [{
        name: 'IPE-Liturgia',
        script: 'server.js',
        watch: false,
        instances: 1,
        autorestart: true,
        max_memory_restart: '200M'
    }]
};
