const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// Import the shared crawler instance from crawl route
const { getCrawler } = require('./crawl');

// GET /api/v1/stats
router.get('/', async (req, res) => {
  try {
    const crawler = await getCrawler();
    const stats = crawler.getStats();
    
    res.json({
      status: 'ok',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.api.error('GET', '/stats', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

// GET /api/v1/stats/detailed
router.get('/detailed', async (req, res) => {
  try {
    const crawler = await getCrawler();
    const stats = crawler.getStats();
    
    res.json({
      status: 'ok',
      stats,
      detailed: {
        contentStore: crawler.contentStore.size,
        crawledUrls: Array.from(crawler.crawledUrls),
        failedUrls: Array.from(crawler.failedUrls),
        pendingUrls: Array.from(crawler.pendingUrls.keys()),
        activeCrawls: crawler.activeCrawls,
        maxActiveCrawls: crawler.maxActiveCrawls
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.api.error('GET', '/stats/detailed', error);
    res.status(500).json({
      error: 'Failed to get detailed stats',
      message: error.message
    });
  }
});

module.exports = router; 