// src/api/server.js - Express Server Setup
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('../utils/logger');
const config = require('../../config');

// Import routes
const crawlRoutes = require('./routes/crawl');
const searchRoutes = require('./routes/search');
const statsRoutes = require('./routes/stats');
const exportRoutes = require('./routes/export');
const reportsRoutes = require('./routes/reports');

class APIServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"]
        }
      }
    }));

    // Compression
    this.app.use(compression());

    // CORS configuration
    this.app.use(cors({
      origin: config.security.allowedOrigins || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.request(req, res);
      next();
    });

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs || 15 * 60 * 1000, // 15 minutes
      max: config.rateLimit.max || 100, // requests per window
      message: {
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((config.rateLimit.windowMs || 900000) / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    this.app.use('/api/', limiter);

    // Static files for dashboard
    this.app.use(express.static(path.join(__dirname, '../../public')));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = require('crypto').randomBytes(16).toString('hex');
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: require('../../package.json').version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      });
    });

    // API routes with versioning
    this.app.use('/api/v1/crawl', crawlRoutes.router);
    this.app.use('/api/v1/search', searchRoutes);
    this.app.use('/api/v1/stats', statsRoutes);
    this.app.use('/api/v1/export', exportRoutes);
    this.app.use('/api/v1/reports', reportsRoutes);

    // Legacy routes (without versioning for backward compatibility)
    this.app.use('/crawl', crawlRoutes.router);
    this.app.use('/search', searchRoutes);
    this.app.use('/stats', statsRoutes);
    this.app.use('/export', exportRoutes);
    this.app.use('/reports', reportsRoutes);

    // Metrics endpoint for monitoring
    this.app.get('/metrics', (req, res) => {
      const metrics = this.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(this.formatPrometheusMetrics(metrics));
    });

    // API documentation endpoint
    this.app.get('/api/docs', (req, res) => {
      res.json({
        name: 'Web Crawler AI API',
        version: require('../../package.json').version,
        endpoints: {
          crawl: {
            'POST /api/v1/crawl': 'Start crawling a URL',
            'GET /api/v1/crawl/status': 'Get crawl status',
            'DELETE /api/v1/crawl/stop': 'Stop active crawls'
          },
          search: {
            'POST /api/v1/search': 'Search crawled content',
            'GET /api/v1/search/suggestions': 'Get search suggestions'
          },
          stats: {
            'GET /api/v1/stats': 'Get crawling statistics',
            'GET /api/v1/stats/detailed': 'Get detailed statistics'
          },
          export: {
            'GET /api/v1/export': 'Export crawled data',
            'POST /api/v1/export/import': 'Import crawled data'
          },
          reports: {
            'POST /api/v1/reports/generate': 'Generate a report based on query and type',
            'GET /api/v1/reports': 'Get all generated reports'
          }
        },
        rateLimit: {
          window: `${config.rateLimit.windowMs / 1000}s`,
          max: config.rateLimit.max
        }
      });
    });

    // Catch-all for dashboard
    this.app.get('*', (req, res) => {
      // Serve dashboard for non-API routes
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '../../public/index.html'));
      } else {
        res.status(404).json({ error: 'API endpoint not found' });
      }
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler for API routes
    this.app.use('/api/', (req, res) => {
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.api.error(req.method, req.path, error);

      // Don't expose internal errors in production
      const isDev = process.env.NODE_ENV === 'development';
      
      const errorResponse = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: req.id
      };

      if (isDev) {
        errorResponse.message = error.message;
        errorResponse.stack = error.stack;
      }

      // Handle specific error types
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details,
          timestamp: new Date().toISOString()
        });
      }

      if (error.name === 'UnauthorizedError') {
        return res.status(401).json({
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        });
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large',
          timestamp: new Date().toISOString()
        });
      }

      res.status(500).json(errorResponse);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', { reason, promise });
      this.gracefulShutdown();
    });
  }

  /**
   * Get server metrics for monitoring
   */
  getMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      timestamp: Date.now(),
      version: require('../../package.json').version
    };
  }

  /**
   * Format metrics for Prometheus
   */
  formatPrometheusMetrics(metrics) {
    return `
# HELP webcrawler_uptime_seconds Total uptime in seconds
# TYPE webcrawler_uptime_seconds counter
webcrawler_uptime_seconds ${metrics.uptime}

# HELP webcrawler_memory_usage_bytes Memory usage in bytes
# TYPE webcrawler_memory_usage_bytes gauge
webcrawler_memory_usage_bytes{type="rss"} ${metrics.memory.rss}
webcrawler_memory_usage_bytes{type="heap_used"} ${metrics.memory.heapUsed}
webcrawler_memory_usage_bytes{type="heap_total"} ${metrics.memory.heapTotal}
webcrawler_memory_usage_bytes{type="external"} ${metrics.memory.external}

# HELP webcrawler_cpu_usage_microseconds CPU usage in microseconds
# TYPE webcrawler_cpu_usage_microseconds counter
webcrawler_cpu_usage_microseconds{type="user"} ${metrics.cpu.user}
webcrawler_cpu_usage_microseconds{type="system"} ${metrics.cpu.system}
    `.trim();
  }

  /**
   * Start the server
   */
  async start(port = null) {
    const serverPort = port || config.server.port || process.env.PORT || 3000;
    const serverHost = config.server.host || 'localhost';

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(serverPort, serverHost, (error) => {
        if (error) {
          logger.error('Failed to start server:', error);
          return reject(error);
        }

        logger.info(`🚀 Web Crawler AI API running on http://${serverHost}:${serverPort}`);
        logger.info(`📊 Dashboard: http://${serverHost}:${serverPort}`);
        logger.info(`🔍 API Documentation: http://${serverHost}:${serverPort}/api/docs`);
        logger.info(`🏥 Health Check: http://${serverHost}:${serverPort}/health`);
        logger.info(`📈 Metrics: http://${serverHost}:${serverPort}/metrics`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

        resolve(this.server);
      });

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${serverPort} is already in use`);
        } else {
          logger.error('Server error:', error);
        }
        reject(error);
      });

      // Graceful shutdown handlers
      process.on('SIGINT', () => this.gracefulShutdown());
      process.on('SIGTERM', () => this.gracefulShutdown());
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    logger.info('Received shutdown signal. Starting graceful shutdown...');

    try {
      await this.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }
}

// Export server instance
const server = new APIServer();

module.exports = {
  server,
  start: (port) => server.start(port),
  stop: () => server.stop(),
  app: server.app
};