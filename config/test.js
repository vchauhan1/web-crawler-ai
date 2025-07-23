module.exports = {
  server: {
    port: 0,
    environment: 'test'
  },
  crawler: {
    maxConcurrency: 2,
    maxDepth: 1,
    delay: 100,
    timeout: 5000
  },
  puppeteer: {
    headless: true,
    timeout: 10000
  },
  storage: {
    dataDir: './test-data',
    cleanupInterval: 1000
  },
  rateLimit: {
    max: 1000,
    windowMs: 1000
  },
  search: {
    maxLimit: 50
  },
  monitoring: {
    enabled: false
  },
  cache: {
    enabled: false
  },
  notifications: {
    enabled: false
  },
  development: {
    debug: {
      enabled: true,
      logLevel: 'error'
    },
    mock: {
      browser: true,
      network: false
    }
  }
}; 