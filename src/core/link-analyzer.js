const urlUtils = require('../utils/url-utils');
const logger = require('../utils/logger');

class LinkAnalyzer {
  constructor() {
    // Priority scoring weights
    this.weights = {
      internal: 10,
      depth: -2,
      textQuality: 5,
      urlStructure: 3,
      contextRelevance: 4
    };

    // URL patterns that indicate valuable content
    this.valuablePatterns = [
      /\/article\//i,
      /\/post\//i,
      /\/blog\//i,
      /\/news\//i,
      /\/story\//i,
      /\/content\//i,
      /\/page\//i,
      /\/tutorial\//i,
      /\/guide\//i,
      /\/review\//i
    ];

    // URL patterns to avoid
    this.avoidPatterns = [
      /\/login/i,
      /\/register/i,
      /\/signup/i,
      /\/cart/i,
      /\/checkout/i,
      /\/account/i,
      /\/profile/i,
      /\/settings/i,
      /\/admin/i,
      /\/wp-admin/i,
      /\/api\//i,
      /\.(pdf|doc|docx|zip|exe)$/i
    ];
  }

  /**
   * Prioritize links for crawling
   */
  prioritizeLinks(links, baseUrl) {
    if (!links || links.length === 0) return [];

    const baseDomain = urlUtils.getDomain(baseUrl);
    const scoredLinks = links.map(link => ({
      ...link,
      priority: this.calculatePriority(link, baseUrl, baseDomain)
    }));

    // Sort by priority (highest first) and filter valid links
    return scoredLinks
      .filter(link => link.priority > 0 && urlUtils.isValid(link.url))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate priority score for a link
   */
  calculatePriority(link, baseUrl, baseDomain) {
    let score = 0;

    // Check if link should be avoided
    if (this.shouldAvoidUrl(link.url)) {
      return 0;
    }

    // Internal vs external links
    const linkDomain = urlUtils.getDomain(link.url);
    if (linkDomain === baseDomain) {
      score += this.weights.internal;
    } else {
      score += 2; // Lower priority for external links
    }

    // Text quality scoring
    score += this.scoreTextQuality(link.text);

    // URL structure scoring
    score += this.scoreUrlStructure(link.url);

    // Context relevance scoring
    score += this.scoreContextRelevance(link.context, link.text);

    // Normalize score
    return Math.max(score, 0);
  }

  /**
   * Check if URL should be avoided
   */
  shouldAvoidUrl(url) {
    return this.avoidPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Score link text quality
   */
  scoreTextQuality(text) {
    if (!text) return 0;

    let score = 0;
    const textLower = text.toLowerCase();

    // Length-based scoring
    if (text.length > 5 && text.length < 100) {
      score += 3;
    }

    // Content indicators
    const contentWords = ['article', 'post', 'story', 'news', 'blog', 'tutorial', 'guide', 'review'];
    if (contentWords.some(word => textLower.includes(word))) {
      score += 5;
    }

    // Navigation indicators (lower priority)
    const navWords = ['home', 'about', 'contact', 'sitemap'];
    if (navWords.some(word => textLower.includes(word))) {
      score += 1;
    }

    // Avoid generic text
    const genericWords = ['click here', 'read more', 'continue', 'next', 'prev'];
    if (genericWords.some(word => textLower.includes(word))) {
      score -= 2;
    }

    return score;
  }

  /**
   * Score URL structure
   */
  scoreUrlStructure(url) {
    let score = 0;

    // Valuable URL patterns
    if (this.valuablePatterns.some(pattern => pattern.test(url))) {
      score += 8;
    }

    // URL depth (fewer slashes = higher priority)
    const pathDepth = (url.match(/\//g) || []).length - 2; // Subtract protocol slashes
    if (pathDepth <= 2) {
      score += 3;
    } else if (pathDepth <= 4) {
      score += 1;
    }

    // Clean URLs (no query parameters)
    if (!url.includes('?')) {
      score += 1;
    }

    // Readable URLs (contain words, not just numbers/IDs)
    const path = url.split('/').pop() || '';
    if (path.length > 3 && /[a-zA-Z]/.test(path)) {
      score += 2;
    }

    return score;
  }

  /**
   * Score context relevance
   */
  scoreContextRelevance(context, linkText) {
    if (!context) return 0;

    let score = 0;
    const contextLower = context.toLowerCase();
    const textLower = linkText.toLowerCase();

    // Context length
    if (context.length > 50) {
      score += 2;
    }

    // Semantic relevance keywords
    const relevantWords = [
      'information', 'details', 'learn', 'discover', 'explore',
      'comprehensive', 'complete', 'full', 'detailed'
    ];

    relevantWords.forEach(word => {
      if (contextLower.includes(word)) {
        score += 1;
      }
    });

    // Context-text coherence
    const textWords = textLower.split(/\s+/);
    const contextWords = contextLower.split(/\s+/);
    const overlap = textWords.filter(word => 
      word.length > 3 && contextWords.includes(word)
    );

    if (overlap.length > 0) {
      score += overlap.length;
    }

    return score;
  }

  /**
   * Analyze link patterns for a domain
   */
  analyzeDomainPatterns(links, domain) {
    const domainLinks = links.filter(link => 
      urlUtils.getDomain(link.url) === domain
    );

    const patterns = {
      totalLinks: domainLinks.length,
      urlPatterns: this.extractUrlPatterns(domainLinks),
      textPatterns: this.extractTextPatterns(domainLinks),
      depth: this.analyzeDepthDistribution(domainLinks)
    };

    logger.debug(`Link patterns for ${domain}:`, patterns);
    return patterns;
  }

  /**
   * Extract common URL patterns
   */
  extractUrlPatterns(links) {
    const patterns = {};
    
    links.forEach(link => {
      const path = new URL(link.url).pathname;
      const segments = path.split('/').filter(s => s);
      
      if (segments.length > 0) {
        const firstSegment = segments[0];
        patterns[firstSegment] = (patterns[firstSegment] || 0) + 1;
      }
    });

    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
  }

  /**
   * Extract common text patterns
   */
  extractTextPatterns(links) {
    const textCounts = {};
    
    links.forEach(link => {
      const words = link.text.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          textCounts[word] = (textCounts[word] || 0) + 1;
        }
      });
    });

    return Object.entries(textCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
  }

  /**
   * Analyze depth distribution
   */
  analyzeDepthDistribution(links) {
    const depths = {};
    
    links.forEach(link => {
      const depth = (link.url.match(/\//g) || []).length - 2;
      depths[depth] = (depths[depth] || 0) + 1;
    });

    return depths;
  }

  /**
   * Filter links by domain policy
   */
  filterByDomainPolicy(links, policy = {}) {
    const {
      allowedDomains = [],
      blockedDomains = [],
      maxLinksPerDomain = 100
    } = policy;

    let filtered = links;

    // Filter by allowed/blocked domains
    if (allowedDomains.length > 0) {
      filtered = filtered.filter(link => 
        allowedDomains.includes(urlUtils.getDomain(link.url))
      );
    }

    if (blockedDomains.length > 0) {
      filtered = filtered.filter(link => 
        !blockedDomains.includes(urlUtils.getDomain(link.url))
      );
    }

    // Limit links per domain
    if (maxLinksPerDomain > 0) {
      const domainCounts = {};
      filtered = filtered.filter(link => {
        const domain = urlUtils.getDomain(link.url);
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        return domainCounts[domain] <= maxLinksPerDomain;
      });
    }

    return filtered;
  }
}

module.exports = LinkAnalyzer;
