// app.js - Main Application Entry Point
const path = require('path');
const fs = require('fs');

// Load environment configuration
require('dotenv').config();

// Import core modules
const logger = require('./src/utils/logger');
const config = require('./config');

// Ensure required directories exist
const requiredDirs = [
  './data/crawled',
  './data/cache/robots',
  './data/cache/pages',
  './data/indexes',
  './exports',
  './logs',
  './backups'
];

function ensureDirectories() {
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
}

// Application bootstrap
class Application {
  constructor() {
    this.mode = process.argv[2] || 'server';
    this.args = process.argv.slice(3);
  }

  async start() {
    try {
      // Ensure required directories exist
      ensureDirectories();
      
      logger.info('🚀 Starting Web Crawler AI');
      logger.info(`Mode: ${this.mode}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Version: ${require('./package.json').version}`);

      // Route to appropriate module based on mode
      switch (this.mode) {
        case 'server':
        case 'api':
          await this.startServer();
          break;
        case 'cli':
          await this.startCLI();
          break;
        case 'crawl':
        case 'search':
        case 'stats':
        case 'export':
          // Direct CLI commands
          await this.startCLI([this.mode, ...this.args]);
          break;
        default:
          this.showUsage();
      }
    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async startServer() {
    const server = require('./src/api/server');
    await server.start();
  }

  async startCLI(customArgs = null) {
    const cli = require('./src/cli');
    await cli.run(customArgs || this.args);
  }

  showUsage() {
    console.log(`
🕷️  Web Crawler AI - Usage

Modes:
  server              Start the web server and API (default)
  cli                 Interactive CLI mode
  crawl <url>         Crawl a website
  search <query>      Search crawled content
  stats              Show crawling statistics
  export [file]      Export crawled data

Examples:
  node app.js server
  node app.js crawl https://example.com
  node app.js search "artificial intelligence"
  node app.js export my-data.json

Environment Variables:
  NODE_ENV           Environment (development, production, test)
  PORT              Server port (default: 3000)
  LOG_LEVEL         Logging level (debug, info, warn, error)

For more help, visit: https://github.com/yourusername/web-crawler-ai
    `);
  }

  // Graceful shutdown handler
  setupGracefulShutdown() {
    const cleanup = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      try {
        // Close any open connections, databases, etc.
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGUSR1', cleanup);
    process.on('SIGUSR2', cleanup);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  const app = new Application();
  app.setupGracefulShutdown();
  app.start();
}

module.exports = Application;