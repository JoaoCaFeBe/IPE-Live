module.exports = {
    apps: [{
        name: 'IPE-SocketIO',
        script: 'index.js',
        watch: false,
        instances: 1,
        autorestart: true,
        max_memory_restart: '200M'
    }]
};
