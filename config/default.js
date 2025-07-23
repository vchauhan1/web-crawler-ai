// config/default.js - Default Configuration
module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development'
  },

  // Crawler Configuration
  crawler: {
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY) || 5,
    maxDepth: parseInt(process.env.MAX_DEPTH) || 3,
    delay: parseInt(process.env.CRAWL_DELAY) || 1000,
    respectRobots: process.env.RESPECT_ROBOTS !== 'false',
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
    
    // Content filtering
    maxContentSize: 10 * 1024 * 1024, // 10MB
    minWordCount: 50,
    
    // URL patterns to exclude
    excludePatterns: [
      '/login',
      '/register',
      '/admin',
      '/api/',
      '.pdf',
      '.doc',
      '.docx',
      '.zip',
      '.exe',
      '/wp-admin',
      '/wp-content/uploads'
    ],
    
    // Domains to prioritize
    priorityDomains: [],
    
    // Maximum pages per domain
    maxPagesPerDomain: 1000
  },

  // Puppeteer Configuration
  puppeteer: {
    headless: true,
    timeout: 60000, // Increased from 30000 to 60000 ms (60s)
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
      '--max_old_space_size=2048',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ],
    
    // Browser pool settings
    maxBrowsers: 2,
    maxPagesPerBrowser: 10,
    
    // Page configuration
    viewport: {
      width: 1920,
      height: 1080
    },
    
    // Resource optimization
    blockResources: [
      'stylesheet',
      'font',
      'image',
      'media'
    ]
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    
    // Different limits for different endpoints
    endpoints: {
      '/crawl': { max: 10, windowMs: 900000 }, // 10 crawls per 15min
      '/search': { max: 200, windowMs: 900000 }, // 200 searches per 15min
      '/export': { max: 5, windowMs: 3600000 } // 5 exports per hour
    }
  },

  // Storage Configuration
  storage: {
    dataDir: process.env.DATA_DIR || './data',
    exportDir: process.env.EXPORT_DIR || './exports',
    logDir: process.env.LOG_DIR || './logs',
    
    // File storage settings
    maxFileSize: 100 * 1024 * 1024, // 100MB
    
    // Cleanup settings
    cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    
    // Backup settings
    backup: {
      enabled: true,
      interval: 6 * 60 * 60 * 1000, // 6 hours
      maxBackups: 10
    }
  },

  // Security
  security: {
    apiKey: process.env.API_KEY,
    allowedOrigins: process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://localhost:3001'],
    
    // JWT settings (if using authentication)
    jwt: {
      secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
      expiresIn: '24h'
    },
    
    // HTTPS settings
    https: {
      enabled: process.env.HTTPS_ENABLED === 'true',
      keyPath: process.env.HTTPS_KEY_PATH,
      certPath: process.env.HTTPS_CERT_PATH
    }
  },

  // Content Processing
  content: {
    minWordCount: 50,
    maxContentSize: 10 * 1024 * 1024, // 10MB
    
    // Language settings
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'],
    defaultLanguage: 'en',
    
    // Quality scoring weights
    qualityWeights: {
      wordCount: 0.2,
      headingCount: 0.15,
      linkCount: 0.1,
      imageCount: 0.05,
      metaDescription: 0.1,
      structuredData: 0.1,
      freshness: 0.1,
      readability: 0.2
    },
    
    // Content extraction settings
    extraction: {
      removeNoise: true,
      extractImages: true,
      extractLinks: true,
      extractStructuredData: true,
      minParagraphLength: 30
    }
  },

  // Search Configuration
  search: {
    defaultLimit: 10,
    maxLimit: 100,
    minQueryLength: 2,
    enableFuzzySearch: true,
    
    // Scoring boost factors
    boostFactors: {
      title: 10,
      description: 5,
      headings: 3,
      content: 2,
      keywords: 4,
      quality: 0.1,
      freshness: 0.2,
      exactMatch: 5
    },
    
    // Search features
    features: {
      suggestions: true,
      highlighting: true,
      facets: true,
      clustering: false
    },
    
    // Index settings
    index: {
      minTermLength: 2,
      maxTermLength: 50,
      stopWords: true,
      stemming: false, // Disabled by default for simplicity
      maxTermsPerDoc: 10000
    }
  },

  // Monitoring and Analytics
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    
    // Metrics collection
    metrics: {
      enabled: true,
      endpoint: '/metrics',
      interval: 30000 // 30 seconds
    },
    
    // Performance monitoring
    performance: {
      enabled: true,
      sampleRate: 1.0, // 100% sampling in development
      slowRequestThreshold: 5000 // 5 seconds
    },
    
    // Error tracking
    errorTracking: {
      enabled: true,
      captureUnhandled: true,
      captureRejections: true
    }
  },

  // Caching
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    
    // Memory cache settings
    memory: {
      maxSize: 100 * 1024 * 1024, // 100MB
      ttl: 60 * 60 * 1000 // 1 hour
    },
    
    // Redis cache settings (if available)
    redis: {
      enabled: false,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0
    },
    
    // Cache strategies
    strategies: {
      robots: { ttl: 24 * 60 * 60 * 1000 }, // 24 hours
      content: { ttl: 60 * 60 * 1000 }, // 1 hour
      search: { ttl: 30 * 60 * 1000 } // 30 minutes
    }
  },

  // Notifications
  notifications: {
    enabled: process.env.NOTIFICATIONS_ENABLED === 'true',
    
    // Email notifications
    email: {
      enabled: false,
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.SMTP_FROM || 'noreply@webcrawlerai.com',
      templates: {
        crawlComplete: 'crawl-complete',
        crawlError: 'crawl-error'
      }
    },
    
    // Webhook notifications
    webhook: {
      enabled: false,
      url: process.env.WEBHOOK_URL,
      events: ['crawl.complete', 'crawl.error', 'system.error']
    }
  },

  // Development settings
  development: {
    // Hot reload for development
    hotReload: process.env.NODE_ENV === 'development',
    
    // Debug settings
    debug: {
      enabled: process.env.DEBUG === 'true',
      logLevel: 'debug',
      showQueries: false,
      saveDebugLogs: true
    },
    
    // Mock settings for testing
    mock: {
      browser: process.env.MOCK_BROWSER === 'true',
      network: process.env.MOCK_NETWORK === 'true',
      responses: process.env.MOCK_RESPONSES === 'true'
    }
  }
};