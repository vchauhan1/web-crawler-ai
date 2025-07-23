// src/core/crawler.js - Main WebCrawlerAI Class
const puppeteer = require('puppeteer');
const { EventEmitter } = require('events');

const ContentExtractor = require('./content-extractor');
const SearchEngine = require('./search-engine');
const LinkAnalyzer = require('./link-analyzer');
const QualityScorer = require('./quality-scorer');
const logger = require('../utils/logger');
const urlUtils = require('../utils/url-utils');
const robotsParser = require('../utils/robots-parser');
const config = require('../../config');

class WebCrawlerAI extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.config = { ...config.crawler, ...options };
    this.maxConcurrency = this.config.maxConcurrency || 5;
    this.maxDepth = this.config.maxDepth || 3;
    this.delay = this.config.delay || 1000;
    this.userAgent = this.config.userAgent || 'WebCrawlerAI/1.0';
    this.respectRobots = this.config.respectRobots !== false;
    
    // Core components
    this.contentExtractor = new ContentExtractor();
    this.searchEngine = new SearchEngine();
    this.linkAnalyzer = new LinkAnalyzer();
    this.qualityScorer = new QualityScorer();
    
    // State management
    this.browser = null;
    this.crawledUrls = new Set();
    this.pendingUrls = new Map(); // url -> { depth, priority }
    this.failedUrls = new Set();
    this.robotsCache = new Map();
    this.activeCrawls = 0;
    this.maxActiveCrawls = this.maxConcurrency;
    
    // Storage
    this.contentStore = new Map();
    this.linkGraph = new Map();
    this.crawlStats = {
      startTime: null,
      endTime: null,
      totalRequested: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalWords: 0,
      averageQuality: 0,
      uniqueDomains: new Set()
    };

    logger.info('WebCrawlerAI initialized', {
      maxConcurrency: this.maxConcurrency,
      maxDepth: this.maxDepth,
      userAgent: this.userAgent
    });
  }

  /**
   * Initialize the crawler
   */
  async init() {
    try {
      // Close existing browser if it exists
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (closeError) {
          logger.warn('Failed to close existing browser:', closeError.message);
        }
        this.browser = null;
      }

      this.browser = await puppeteer.launch({
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        timeout: config.puppeteer.timeout,
        // Add additional stability options
        ignoreDefaultArgs: ['--disable-extensions'],
        pipe: true, // Use pipe instead of WebSocket for better stability
        // Add executable path for better compatibility
        executablePath: process.env.CHROME_PATH || undefined
      });

      // Set up browser error handling
      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected unexpectedly');
        this.browser = null;
      });

      logger.info('Browser launched successfully');
      this.emit('ready');
    } catch (error) {
      logger.error('Failed to initialize crawler:', error);
      throw error;
    }
  }

  /**
   * Close the crawler and cleanup resources
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
    this.emit('closed');
  }

  /**
   * Check if URL can be crawled based on robots.txt
   */
  async canCrawl(url) {
    if (!this.respectRobots) return true;

    try {
      const { hostname } = urlUtils.parse(url);
      
      if (!this.robotsCache.has(hostname)) {
        const robotsUrl = `${urlUtils.getProtocol(url)}://${hostname}/robots.txt`;
        const robotsRules = await robotsParser.fetch(robotsUrl, this.userAgent);
        this.robotsCache.set(hostname, robotsRules);
      }

      const rules = this.robotsCache.get(hostname);
      return robotsParser.canCrawl(url, this.userAgent, rules);
    } catch (error) {
      logger.warn(`Robots.txt check failed for ${url}:`, error.message);
      return true; // Allow crawling if robots.txt check fails
    }
  }

  /**
   * Crawl a single URL with retry mechanism
   */
  async crawlUrl(url, depth = 0, priority = 1, retryCount = 0) {
    const normalizedUrl = urlUtils.normalize(url);
    
    if (!normalizedUrl || 
        this.crawledUrls.has(normalizedUrl) || 
        this.failedUrls.has(normalizedUrl) ||
        depth > this.maxDepth) {
      return null;
    }

    if (!(await this.canCrawl(normalizedUrl))) {
      logger.info(`Blocked by robots.txt: ${normalizedUrl}`);
      return null;
    }

    // Wait for available slot
    await this.waitForSlot();
    this.activeCrawls++;
    this.crawledUrls.add(normalizedUrl);
    this.crawlStats.totalRequested++;

    logger.info(`Crawling (depth: ${depth}, priority: ${priority}): ${normalizedUrl}`);

    let page = null;
    try {
      // Check if browser is still connected
      if (!this.browser || !this.browser.isConnected()) {
        logger.warn('Browser disconnected, reinitializing...');
        await this.init();
      }

      page = await this.browser.newPage();
      
      // Configure page
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set request interception for optimization
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['stylesheet', 'font', 'image'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate to page
      let response;
      try {
        response = await page.goto(normalizedUrl, {
          waitUntil: 'networkidle2',
          timeout: config.puppeteer.timeout
        });
      } catch (err) {
        if (err.name === 'TimeoutError') {
          throw new Error('Navigation timeout: The site took too long to load. Try increasing the timeout or check your network.');
        }
        throw err;
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract content
      const html = await page.content();
      const pageTitle = await page.title();
      
      // Close page safely
      if (page && !page.isClosed()) {
        await page.close();
      }

      // Process content
      const content = await this.contentExtractor.extract(html, normalizedUrl);
      content.title = content.title || pageTitle;
      content.crawlDepth = depth;
      content.crawlPriority = priority;
      
      // Calculate quality score
      content.qualityScore = this.qualityScorer.calculate(content);
      
      // Store content
      const contentId = this.generateContentId(normalizedUrl);
      this.contentStore.set(contentId, content);
      
      // Index for search
      this.searchEngine.indexContent(contentId, content);
      
      // Update link graph
      this.updateLinkGraph(normalizedUrl, content.links);
      
      // Update statistics
      this.updateStats(content);
      
      // Emit progress event
      this.emit('page-crawled', {
        url: normalizedUrl,
        title: content.title,
        depth,
        quality: content.qualityScore,
        wordCount: content.wordCount
      });

      logger.info(`✓ Crawled: ${content.title} (${content.wordCount} words, quality: ${content.qualityScore})`);
      
      // Schedule child URLs if within depth limit
      if (depth < this.maxDepth) {
        this.scheduleChildUrls(content.links, normalizedUrl, depth + 1);
      }

      this.crawlStats.totalCompleted++;
      return content;

    } catch (error) {
      this.failedUrls.add(normalizedUrl);
      this.crawlStats.totalFailed++;
      
      // Close page safely if it exists
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch (closeError) {
          logger.warn(`Failed to close page for ${normalizedUrl}:`, closeError.message);
        }
      }
      
      logger.error(`Failed to crawl ${normalizedUrl}:`, error && error.stack ? error.stack : error);
      try {
        console.error('Failed to crawl', normalizedUrl);
        console.error('Error:', error);
        console.error('Error message:', error && error.message);
        console.error('Error stack:', error && error.stack);
        console.error('Error type:', typeof error);
        try { console.error('Error JSON:', JSON.stringify(error)); } catch (e) { console.error('Error not JSON serializable'); }
      } catch (e) { console.error('Error logging failed:', e); }
      // Retry logic for connection errors
      if (retryCount < 2 && (
        error.message.includes('Protocol error') || 
        error.message.includes('Connection closed') ||
        error.message.includes('Target closed')
      )) {
        logger.info(`Retrying crawl for ${normalizedUrl} (attempt ${retryCount + 1})`);
        this.activeCrawls--;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        return this.crawlUrl(url, depth, priority, retryCount + 1);
      }

      this.emit('crawl-error', {
        url: normalizedUrl,
        error: error && error.message,
        depth
      });
      return null;
    } finally {
      this.activeCrawls--;
    }
  }

  /**
   * Schedule child URLs for crawling
   */
  scheduleChildUrls(links, parentUrl, depth) {
    const prioritizedLinks = this.linkAnalyzer.prioritizeLinks(links, parentUrl);
    
    // Only crawl top priority links to avoid explosion
    const topLinks = prioritizedLinks.slice(0, Math.min(5, prioritizedLinks.length));
    
    topLinks.forEach(link => {
      if (!this.crawledUrls.has(link.url) && !this.pendingUrls.has(link.url)) {
        this.pendingUrls.set(link.url, {
          depth,
          priority: link.priority,
          parent: parentUrl
        });
      }
    });
  }

  /**
   * Wait for available crawling slot
   */
  async waitForSlot() {
    while (this.activeCrawls >= this.maxActiveCrawls) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Add delay between requests
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
  }

  /**
   * Batch crawl multiple URLs
   */
  async crawlBatch(urls, options = {}) {
    this.crawlStats.startTime = new Date();
    
    logger.info(`Starting batch crawl of ${urls.length} URLs`);
    
    // Add initial URLs to pending queue
    urls.forEach(url => {
      const normalizedUrl = urlUtils.normalize(url);
      if (normalizedUrl && !this.pendingUrls.has(normalizedUrl)) {
        this.pendingUrls.set(normalizedUrl, {
          depth: 0,
          priority: 10, // High priority for seed URLs
          parent: null
        });
      }
    });

    // Process pending URLs
    while (this.pendingUrls.size > 0 || this.activeCrawls > 0) {
      // Get next URL to crawl
      const nextEntry = this.getNextUrl();
      
      if (nextEntry) {
        const [url, metadata] = nextEntry;
        this.pendingUrls.delete(url);
        
        // Crawl URL and wait for it to complete
        await this.crawlUrl(url, metadata.depth, metadata.priority);
      } else {
        // Wait a bit if no URLs available but crawls still active
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.crawlStats.endTime = new Date();
    
    const stats = this.getStats();
    logger.info('Batch crawl completed:', stats);
    
    this.emit('crawl-completed', stats);
    return stats;
  }

  /**
   * Get next URL to crawl based on priority
   */
  getNextUrl() {
    if (this.pendingUrls.size === 0) return null;
    
    // Sort by priority (higher first)
    const sortedEntries = Array.from(this.pendingUrls.entries())
      .sort((a, b) => b[1].priority - a[1].priority);
    
    return sortedEntries[0];
  }

  /**
   * Search crawled content
   */
  search(query, options = {}) {
    return this.searchEngine.search(query, options);
  }

  /**
   * Update crawling statistics
   */
  updateStats(content) {
    this.crawlStats.totalWords += content.wordCount || 0;
    this.crawlStats.uniqueDomains.add(urlUtils.getDomain(content.url));
    
    // Calculate running average quality
    const totalContent = this.contentStore.size;
    const currentAvg = this.crawlStats.averageQuality;
    this.crawlStats.averageQuality = 
      ((currentAvg * (totalContent - 1)) + content.qualityScore) / totalContent;
  }

  /**
   * Get crawling statistics
   */
  getStats() {
    const duration = this.crawlStats.endTime && this.crawlStats.startTime 
      ? this.crawlStats.endTime - this.crawlStats.startTime 
      : Date.now() - (this.crawlStats.startTime || Date.now());

    return {
      totalPages: this.contentStore.size,
      totalUrls: this.crawledUrls.size,
      totalWords: this.crawlStats.totalWords,
      totalFailed: this.crawlStats.totalFailed,
      averageQuality: Math.round(this.crawlStats.averageQuality),
      uniqueDomains: this.crawlStats.uniqueDomains.size,
      pendingUrls: this.pendingUrls.size,
      duration: Math.round(duration / 1000), // seconds
      pagesPerSecond: this.contentStore.size / (duration / 1000),
      successRate: Math.round((this.crawlStats.totalCompleted / this.crawlStats.totalRequested) * 100)
    };
  }

  /**
   * Generate unique content ID
   */
  generateContentId(url) {
    return require('crypto').createHash('md5').update(url).digest('hex');
  }

  /**
   * Update link graph
   */
  updateLinkGraph(fromUrl, links) {
    if (!this.linkGraph.has(fromUrl)) {
      this.linkGraph.set(fromUrl, []);
    }
    
    const outboundLinks = links.map(link => ({
      url: link.url,
      text: link.text,
      context: link.context
    }));
    
    this.linkGraph.set(fromUrl, outboundLinks);
  }

  /**
   * Export crawled data
   */
  async exportData(format = 'json') {
    const data = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: require('../../package.json').version,
        stats: this.getStats()
      },
      crawledUrls: Array.from(this.crawledUrls),
      failedUrls: Array.from(this.failedUrls),
      contentStore: Array.from(this.contentStore.entries()),
      linkGraph: Array.from(this.linkGraph.entries()),
      searchIndex: this.searchEngine.exportIndex()
    };
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    return data;
  }

  /**
   * Import previously crawled data
   */
  async importData(data) {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    
    this.crawledUrls = new Set(data.crawledUrls || []);
    this.failedUrls = new Set(data.failedUrls || []);
    this.contentStore = new Map(data.contentStore || []);
    this.linkGraph = new Map(data.linkGraph || []);
    
    // Rebuild search index
    if (data.searchIndex) {
      this.searchEngine.importIndex(data.searchIndex);
    } else {
      // Rebuild from content
      for (const [contentId, content] of this.contentStore) {
        this.searchEngine.indexContent(contentId, content);
      }
    }
    
    logger.info(`Imported ${this.contentStore.size} pages from previous crawl`);
    
    // Update stats
    if (data.metadata && data.metadata.stats) {
      this.crawlStats = { ...this.crawlStats, ...data.metadata.stats };
    }
  }
}

module.exports = WebCrawlerAI;