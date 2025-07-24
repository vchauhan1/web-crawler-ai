// src/utils/logger.js - Winston Logging Setup
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'web-crawler-ai',
    version: require('../../package.json').version
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Crawl-specific log file
    new winston.transports.File({
      filename: path.join(logsDir, 'crawl.log'),
      level: 'info',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, url, title, wordCount, quality }) => {
          if (url) {
            return `${timestamp} [CRAWL] ${message} | URL: ${url} | Title: ${title || 'N/A'} | Words: ${wordCount || 0} | Quality: ${quality || 0}`;
          }
          return `${timestamp} [CRAWL] ${message}`;
        })
      )
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 2
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 2
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'debug'
  }));
}

// Add performance timing methods
logger.time = (label) => {
  logger.startTime = logger.startTime || {};
  logger.startTime[label] = Date.now();
};

logger.timeEnd = (label) => {
  if (logger.startTime && logger.startTime[label]) {
    const duration = Date.now() - logger.startTime[label];
    logger.info(`${label}: ${duration}ms`);
    delete logger.startTime[label];
  }
};

// Add request logging method
logger.request = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, url, ip } = req;
    const { statusCode } = res;
    
    logger.info('HTTP Request', {
      method,
      url,
      statusCode,
      duration,
      ip: ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  });
  
  if (next) next();
};

// Add crawl-specific logging methods
logger.crawl = {
  start: (url, depth = 0) => {
    logger.info('Starting crawl', { 
      url, 
      depth,
      event: 'crawl_start' 
    });
  },
  
  success: (url, data) => {
    logger.info('Page crawled successfully', {
      url,
      title: data.title,
      wordCount: data.wordCount,
      quality: data.qualityScore,
      depth: data.crawlDepth,
      event: 'crawl_success'
    });
  },
  
  error: (url, error, depth = 0) => {
    logger.error('Crawl failed', {
      url,
      error: error.message,
      depth,
      event: 'crawl_error'
    });
  },
  
  blocked: (url, reason) => {
    logger.warn('Crawl blocked', {
      url,
      reason,
      event: 'crawl_blocked'
    });
  },
  
  stats: (stats) => {
    logger.info('Crawl statistics', {
      ...stats,
      event: 'crawl_stats'
    });
  }
};

// Add search-specific logging methods
logger.search = {
  query: (query, results, duration) => {
    logger.info('Search performed', {
      query,
      resultCount: results.length,
      duration,
      event: 'search_query'
    });
  },
  
  index: (contentId, terms) => {
    logger.debug('Content indexed', {
      contentId,
      termCount: terms,
      event: 'search_index'
    });
  }
};

// Add API-specific logging methods
logger.api = {
  request: (method, endpoint, params) => {
    logger.info('API request', {
      method,
      endpoint,
      params,
      event: 'api_request'
    });
  },
  
  response: (method, endpoint, statusCode, duration) => {
    logger.info('API response', {
      method,
      endpoint,
      statusCode,
      duration,
      event: 'api_response'
    });
  },
  
  error: (method, endpoint, error) => {
    logger.error('API error', {
      method,
      endpoint,
      error: error.message,
      stack: error.stack,
      event: 'api_error'
    });
  }
};

// Add stream for real-time log monitoring
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Export logger with additional utilities
module.exports = logger;