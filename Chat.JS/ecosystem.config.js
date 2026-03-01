module.exports = {
    apps: [{
        name: 'IPE-Chat',
        script: 'index.js',
        watch: true,
        instances: 1,
        autorestart: true,
        max_memory_restart: '200M'
    }]
};
