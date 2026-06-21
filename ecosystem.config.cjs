module.exports = {
  apps: [
    {
      name: 'fritzie-dashboard',
      script: './server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '750M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
}
