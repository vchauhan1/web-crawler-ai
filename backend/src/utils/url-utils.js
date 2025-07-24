const { URL } = require('url');

class UrlUtils {
  /**
   * Normalize URL for consistent handling
   */
  static normalize(url) {
    try {
      const urlObj = new URL(url);
      
      // Remove fragment
      urlObj.hash = '';
      
      // Remove common tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source'
      ];
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      // Sort query parameters for consistency
      urlObj.searchParams.sort();
      
      // Ensure trailing slash consistency
      if (urlObj.pathname === '') {
        urlObj.pathname = '/';
      }
      
      return urlObj.toString().toLowerCase();
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if URL is valid
   */
  static isValid(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Parse URL into components
   */
  static parse(url) {
    try {
      const urlObj = new URL(url);
      return {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        origin: urlObj.origin
      };
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  /**
   * Get domain from URL
   */
  static getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  /**
   * Get protocol from URL
   */
  static getProtocol(url) {
    try {
      return new URL(url).protocol.slice(0, -1); // Remove trailing ':'
    } catch {
      return 'https';
    }
  }

  /**
   * Check if URL is internal to domain
   */
  static isInternal(url, baseUrl) {
    try {
      const urlDomain = new URL(url).hostname;
      const baseDomain = new URL(baseUrl).hostname;
      return urlDomain === baseDomain;
    } catch {
      return false;
    }
  }

  /**
   * Resolve relative URL against base
   */
  static resolve(relativeUrl, baseUrl) {
    try {
      return new URL(relativeUrl, baseUrl).toString();
    } catch {
      return null;
    }
  }

  /**
   * Extract URLs from text
   */
  static extractUrls(text) {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    return text.match(urlRegex) || [];
  }

  /**
   * Check if URL should be excluded from crawling
   */
  static shouldExclude(url, excludePatterns = []) {
    const defaultExcludes = [
      /\.(pdf|doc|docx|xls|xlsx|zip|exe|dmg)$/i,
      /\/(login|register|admin|wp-admin)\/?$/i,
      /\/api\//i,
      /#/
    ];

    const allPatterns = [...defaultExcludes, ...excludePatterns];
    
    return allPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(url);
      }
      return url.includes(pattern);
    });
  }
}

module.exports = UrlUtils;