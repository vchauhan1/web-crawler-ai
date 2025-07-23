module.exports = {
  server: {
    environment: 'production'
  },
  crawler: {
    maxConcurrency: 10,
    delay: 500
  },
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1920,1080',
      '--memory-pressure-off',
      '--max_old_space_size=4096'
    ],
    maxBrowsers: 5,
    maxPagesPerBrowser: 15
  },
  rateLimit: {
    max: 200,
    endpoints: {
      '/crawl': { max: 20, windowMs: 900000 },
      '/search': { max: 500, windowMs: 900000 },
      '/export': { max: 10, windowMs: 3600000 }
    }
  },
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourcrawler.com'],
    https: { enabled: true }
  },
  monitoring: {
    enabled: true,
    performance: { sampleRate: 0.1 }
  },
  cache: { redis: { enabled: true } },
  notifications: {
    enabled: true,
    email: { enabled: true },
    webhook: { enabled: true }
  },
  development: {
    debug: { enabled: false, logLevel: 'info' }
  }
}; 