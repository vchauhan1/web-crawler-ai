const express = require('express');
const router = express.Router();
const WebCrawlerAI = require('../../core/crawler');
const logger = require('../../utils/logger');

// Global crawler instance
let crawlerInstance = null;

async function getCrawler() {
  if (!crawlerInstance) {
    crawlerInstance = new WebCrawlerAI();
    await crawlerInstance.init();
  }
  return crawlerInstance;
}

/**
 * POST /crawl - Start crawling a URL with enhanced error handling
 */
router.post('/', async (req, res) => {
  try {
    const { url, maxDepth = 2, followLinks = true, options = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        code: 'MISSING_URL'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return res.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL',
        details: urlError.message
      });
    }

    logger.api.request('POST', '/crawl', { url, maxDepth, followLinks });
    const startTime = Date.now();

    try {
      const crawler = await getCrawler();
      
      // Set crawler options
      if (maxDepth) crawler.maxDepth = parseInt(maxDepth);
      
      let result;
      let crawlType;
      
      if (followLinks) {
        // Batch crawl (follows links)
        crawlType = 'batch';
        logger.info(`Starting batch crawl of ${url} with maxDepth ${maxDepth}`);
        result = await crawler.crawlBatch([url], {
          maxDepth: parseInt(maxDepth),
          ...options
        });
      } else {
        // Single page crawl
        crawlType = 'single';
        logger.info(`Starting single page crawl of ${url}`);
        result = await crawler.crawlUrl(url, 0);
      }
      
      const duration = Date.now() - startTime;
      const stats = crawler.getStats();
      
      if (result) {
        logger.api.response('POST', '/crawl', 200, duration);
        
        // Enhanced response with more details
        res.json({
          success: true,
          message: `${crawlType === 'batch' ? 'Batch crawl' : 'Single page crawl'} completed successfully`,
          crawlType,
          url,
          result: followLinks ? result : {
            url: result.url,
            title: result.title,
            wordCount: result.wordCount,
            contentType: result.contentType,
            qualityScore: result.qualityScore,
            extractedAt: result.extractedAt
          },
          stats: {
            totalPages: stats.totalPages || 0,
            totalUrls: stats.totalUrls || 0, 
            totalWords: stats.totalWords || 0,
            totalFailed: stats.totalFailed || 0,
            successRate: stats.successRate || 0,
            averageQuality: stats.averageQuality || 0,
            uniqueDomains: stats.uniqueDomains || 0,
            duration: Math.round(duration / 1000) || 0
          },
          duration,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn(`Crawl failed for URL: ${url}`);
        res.status(400).json({
          error: 'Failed to crawl URL',
          code: 'CRAWL_FAILED',
          url,
          duration,
          details: 'The crawler was unable to extract content from the specified URL'
        });
      }
    } catch (crawlerError) {
      logger.error(`Crawler operation failed for ${url}:`, crawlerError);
      
      const duration = Date.now() - startTime;
      res.status(500).json({
        error: 'Crawler operation failed',
        code: 'CRAWLER_ERROR',
        url,
        message: crawlerError.message,
        duration,
        details: 'An error occurred during the crawling process'
      });
    }

  } catch (error) {
    logger.api.error('POST', '/crawl', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /crawl/status - Get crawling status
 */
router.get('/status', async (req, res) => {
  try {
    const crawler = await getCrawler();
    const stats = crawler.getStats();
    
    res.json({
      status: 'active',
      stats,
      pendingUrls: crawler.pendingUrls.size,
      activeCrawls: crawler.activeCrawls
    });
  } catch (error) {
    logger.api.error('GET', '/crawl/status', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  router,
  getCrawler
};