// src/core/content-extractor.js - Content Extraction Logic
const cheerio = require('cheerio');
const { URL } = require('url');
const logger = require('../utils/logger');
const textProcessor = require('../utils/text-processor');

class ContentExtractor {
  constructor() {
    // Selectors for content elements
    this.contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-body',
      '#content',
      '[role="main"]'
    ];

    // Elements to remove (noise)
    this.noiseSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      '.sidebar',
      '.advertisement',
      '.ads',
      '.social-share',
      '.comments',
      '.related-posts',
      '.breadcrumb',
      '.pagination',
      'noscript'
    ];

    // Structured data selectors
    this.structuredDataSelectors = {
      title: ['title', 'h1', '.title', '.headline', '[property="og:title"]'],
      description: [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        '.summary',
        '.excerpt'
      ],
      author: [
        'meta[name="author"]',
        '[rel="author"]',
        '.author',
        '.byline',
        '[property="article:author"]'
      ],
      publishDate: [
        'meta[property="article:published_time"]',
        'meta[property="article:modified_time"]',
        'time[datetime]',
        '.publish-date',
        '.date'
      ],
      keywords: [
        'meta[name="keywords"]',
        'meta[property="article:tag"]',
        '.tags',
        '.keywords'
      ]
    };
  }

  /**
   * Extract content from HTML
   */
  async extract(html, url) {
    try {
      const $ = cheerio.load(html);
      const urlObj = new URL(url);
      
      // Remove noise elements
      this.removeNoise($);
      
      // Extract structured data
      const content = {
        url,
        domain: urlObj.hostname,
        path: urlObj.pathname,
        timestamp: new Date().toISOString(),
        language: this.detectLanguage($),
        title: this.extractTitle($),
        description: this.extractDescription($),
        author: this.extractAuthor($),
        publishDate: this.extractPublishDate($),
        keywords: this.extractKeywords($),
        headings: this.extractHeadings($),
        paragraphs: this.extractParagraphs($),
        links: this.extractLinks($, url),
        images: this.extractImages($, url),
        metadata: this.extractMetadata($),
        structuredData: this.extractStructuredData($)
      };

      // Calculate content metrics
      content.wordCount = this.calculateWordCount(content);
      content.readingTime = this.calculateReadingTime(content.wordCount);
      content.contentDensity = this.calculateContentDensity(content);
      
      // Extract semantic keywords
      content.semanticKeywords = this.extractSemanticKeywords(content);
      
      // Content classification
      content.contentType = this.classifyContent(content);
      content.topics = this.extractTopics(content);

      logger.debug(`Extracted content from ${url}:`, {
        title: content.title,
        wordCount: content.wordCount,
        headings: content.headings.length,
        links: content.links.length,
        images: content.images.length
      });

      return content;
    } catch (error) {
      logger.error(`Content extraction failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Remove noise elements from the DOM
   */
  removeNoise($) {
    this.noiseSelectors.forEach(selector => {
      $(selector).remove();
    });
    
    // Remove elements with certain attributes
    $('[style*="display:none"], [style*="visibility:hidden"]').remove();
    $('.hidden, .invisible').remove();
  }

  /**
   * Detect page language
   */
  detectLanguage($) {
    // Try HTML lang attribute
    let lang = $('html').attr('lang');
    if (lang) return lang.substring(0, 2).toLowerCase();
    
    // Try meta tags
    lang = $('meta[http-equiv="content-language"]').attr('content');
    if (lang) return lang.substring(0, 2).toLowerCase();
    
    lang = $('meta[name="language"]').attr('content');
    if (lang) return lang.substring(0, 2).toLowerCase();
    
    // Default to English
    return 'en';
  }

  /**
   * Extract page title
   */
  extractTitle($) {
    // Try multiple selectors in order of preference
    for (const selector of this.structuredDataSelectors.title) {
      const element = $(selector).first();
      if (element.length) {
        let title = '';
        if (element.attr('content')) {
          title = element.attr('content');
        } else {
          title = element.text();
        }
        
        if (title && title.trim().length > 0) {
          return textProcessor.cleanText(title.trim());
        }
      }
    }
    
    return '';
  }

  /**
   * Extract page description
   */
  extractDescription($) {
    for (const selector of this.structuredDataSelectors.description) {
      const element = $(selector).first();
      if (element.length) {
        let description = element.attr('content') || element.text();
        if (description && description.trim().length > 10) {
          return textProcessor.cleanText(description.trim());
        }
      }
    }
    
    // Fallback: extract first meaningful paragraph
    const firstPara = $('p').first().text();
    if (firstPara && firstPara.length > 50) {
      return textProcessor.cleanText(firstPara.substring(0, 300) + '...');
    }
    
    return '';
  }

  /**
   * Extract author information
   */
  extractAuthor($) {
    for (const selector of this.structuredDataSelectors.author) {
      const element = $(selector).first();
      if (element.length) {
        const author = element.attr('content') || element.text();
        if (author && author.trim().length > 0) {
          return textProcessor.cleanText(author.trim());
        }
      }
    }
    return '';
  }

  /**
   * Extract publish date
   */
  extractPublishDate($) {
    for (const selector of this.structuredDataSelectors.publishDate) {
      const element = $(selector).first();
      if (element.length) {
        let date = element.attr('content') || 
                   element.attr('datetime') || 
                   element.text();
        
        if (date) {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
      }
    }
    return '';
  }

  /**
   * Extract keywords
   */
  extractKeywords($) {
    const keywords = new Set();
    
    for (const selector of this.structuredDataSelectors.keywords) {
      $(selector).each((i, elem) => {
        const text = $(elem).attr('content') || $(elem).text();
        if (text) {
          const keywordList = text.split(/[,;]+/).map(k => k.trim());
          keywordList.forEach(keyword => {
            if (keyword.length > 2) {
              keywords.add(keyword.toLowerCase());
            }
          });
        }
      });
    }
    
    return Array.from(keywords);
  }

  /**
   * Extract headings with hierarchy
   */
  extractHeadings($) {
    const headings = [];
    
    $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 0) {
        headings.push({
          level: parseInt(elem.tagName.substring(1)),
          text: textProcessor.cleanText(text),
          id: $(elem).attr('id') || null
        });
      }
    });
    
    return headings;
  }

  /**
   * Extract meaningful paragraphs
   */
  extractParagraphs($) {
    const paragraphs = [];
    
    // Try to find main content area first
    let contentArea = null;
    for (const selector of this.contentSelectors) {
      const area = $(selector).first();
      if (area.length) {
        contentArea = area;
        break;
      }
    }
    
    const context = contentArea || $('body');
    
    context.find('p').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 30) { // Filter out very short paragraphs
        const cleanText = textProcessor.cleanText(text);
        if (cleanText.length > 30) {
          paragraphs.push(cleanText);
        }
      }
    });
    
    return paragraphs;
  }

  /**
   * Extract links with context
   */
  extractLinks($, baseUrl) {
    const links = [];
    const seenUrls = new Set();
    
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();
      const title = $(elem).attr('title') || '';
      
      if (href && text) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          
          if (!seenUrls.has(absoluteUrl)) {
            seenUrls.add(absoluteUrl);
            
            links.push({
              url: absoluteUrl,
              text: textProcessor.cleanText(text),
              title: title ? textProcessor.cleanText(title) : '',
              context: this.getLinkContext($(elem)),
              isInternal: this.isInternalLink(absoluteUrl, baseUrl),
              rel: $(elem).attr('rel') || ''
            });
          }
        } catch (error) {
          // Skip invalid URLs
          logger.debug(`Invalid URL found: ${href}`);
        }
      }
    });
    
    return links;
  }

  /**
   * Extract images with metadata
   */
  extractImages($, baseUrl) {
    const images = [];
    
    $('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      const alt = $(elem).attr('alt') || '';
      const title = $(elem).attr('title') || '';
      const width = $(elem).attr('width');
      const height = $(elem).attr('height');
      
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          
          images.push({
            src: absoluteUrl,
            alt: textProcessor.cleanText(alt),
            title: textProcessor.cleanText(title),
            width: width ? parseInt(width) : null,
            height: height ? parseInt(height) : null,
            context: this.getImageContext($(elem))
          });
        } catch (error) {
          logger.debug(`Invalid image URL: ${src}`);
        }
      }
    });
    
    return images;
  }

  /**
   * Extract metadata from meta tags
   */
  extractMetadata($) {
    const metadata = {};
    
    $('meta').each((i, elem) => {
      const name = $(elem).attr('name') || $(elem).attr('property');
      const content = $(elem).attr('content');
      
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    return metadata;
  }

  /**
   * Extract structured data (JSON-LD, microdata)
   */
  extractStructuredData($) {
    const structuredData = [];
    
    // Extract JSON-LD
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        structuredData.push({
          type: 'json-ld',
          data
        });
      } catch (error) {
        logger.debug('Failed to parse JSON-LD:', error);
      }
    });
    
    // Extract microdata
    $('[itemscope]').each((i, elem) => {
      const itemType = $(elem).attr('itemtype');
      const properties = {};
      
      $(elem).find('[itemprop]').each((j, propElem) => {
        const prop = $(propElem).attr('itemprop');
        const value = $(propElem).attr('content') || $(propElem).text();
        properties[prop] = value;
      });
      
      if (Object.keys(properties).length > 0) {
        structuredData.push({
          type: 'microdata',
          itemType,
          properties
        });
      }
    });
    
    return structuredData;
  }

  /**
   * Calculate total word count
   */
  calculateWordCount(content) {
    const allText = [
      content.title,
      content.description,
      ...content.headings.map(h => h.text),
      ...content.paragraphs
    ].join(' ');
    
    return textProcessor.getWordCount(allText);
  }

  /**
   * Calculate estimated reading time
   */
  calculateReadingTime(wordCount) {
    const wordsPerMinute = 200; // Average reading speed
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Calculate content density (text vs HTML ratio)
   */
  calculateContentDensity(content) {
    const textLength = content.paragraphs.join('').length;
    const totalLength = content.wordCount * 5; // Rough estimate
    return totalLength > 0 ? Math.min(textLength / totalLength, 1) : 0;
  }

  /**
   * Extract semantic keywords using simple NLP
   */
  extractSemanticKeywords(content) {
    const allText = [
      content.title,
      content.description,
      ...content.paragraphs
    ].join(' ').toLowerCase();
    
    return textProcessor.extractKeywords(allText, {
      maxKeywords: 20,
      minWordLength: 4,
      excludeStopWords: true
    });
  }

  /**
   * Classify content type
   */
  classifyContent(content) {
    const url = content.url.toLowerCase();
    const title = content.title.toLowerCase();
    const text = content.paragraphs.join(' ').toLowerCase();
    
    // URL-based classification
    if (url.includes('/blog/') || url.includes('/post/')) return 'blog-post';
    if (url.includes('/news/')) return 'news-article';
    if (url.includes('/product/')) return 'product-page';
    if (url.includes('/about')) return 'about-page';
    if (url.includes('/contact')) return 'contact-page';
    
    // Content-based classification
    if (text.includes('recipe') || text.includes('ingredients')) return 'recipe';
    if (text.includes('tutorial') || text.includes('how to')) return 'tutorial';
    if (text.includes('review') && text.includes('rating')) return 'review';
    
    // Default classification based on structure
    if (content.headings.length > 3 && content.wordCount > 500) return 'article';
    if (content.paragraphs.length < 3) return 'landing-page';
    
    return 'webpage';
  }

  /**
   * Extract topics from content
   */
  extractTopics(content) {
    const topics = new Set();
    
    // Extract from keywords
    content.keywords.forEach(keyword => topics.add(keyword));
    
    // Extract from semantic keywords (top 10)
    content.semanticKeywords
      .slice(0, 10)
      .forEach(keyword => topics.add(keyword.word));
    
    // Extract from headings
    content.headings.forEach(heading => {
      const words = heading.text.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && !textProcessor.isStopWord(word)) {
          topics.add(word);
        }
      });
    });
    
    return Array.from(topics).slice(0, 15); // Limit to top 15 topics
  }

  /**
   * Get context around a link
   */
  getLinkContext($elem) {
    const parent = $elem.parent();
    const context = parent.text().trim();
    return context.length > 200 ? context.substring(0, 200) + '...' : context;
  }

  /**
   * Get context around an image
   */
  getImageContext($elem) {
    // Check for figure caption
    const figure = $elem.closest('figure');
    if (figure.length) {
      const caption = figure.find('figcaption').text().trim();
      if (caption) return caption;
    }
    
    // Check surrounding text
    const parent = $elem.parent();
    const context = parent.text().trim();
    return context.length > 100 ? context.substring(0, 100) + '...' : context;
  }

  /**
   * Check if link is internal
   */
  isInternalLink(url, baseUrl) {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(baseUrl);
      return urlObj.hostname === baseUrlObj.hostname;
    } catch {
      return false;
    }
  }
}

module.exports = ContentExtractor;