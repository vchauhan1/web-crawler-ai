// src/core/search-engine.js - Semantic Search Implementation
const logger = require('../utils/logger');
const textProcessor = require('../utils/text-processor');
const config = require('../../config');

class SearchEngine {
  constructor() {
    this.index = new Map(); // contentId -> searchable data
    this.invertedIndex = new Map(); // term -> Set(contentIds)
    this.termFrequency = new Map(); // contentId -> Map(term -> frequency)
    this.documentFrequency = new Map(); // term -> document count
    this.contentStore = new Map(); // contentId -> content metadata
    this.totalDocuments = 0;
    
    // Search configuration
    this.config = config.search || {};
    this.defaultLimit = this.config.defaultLimit || 10;
    this.maxLimit = this.config.maxLimit || 100;
    this.minQueryLength = this.config.minQueryLength || 2;
    this.enableFuzzySearch = this.config.enableFuzzySearch !== false;
    this.boostFactors = this.config.boostFactors || {
      title: 10,
      description: 5,
      content: 2,
      quality: 0.1
    };

    logger.info('Search engine initialized');
  }

  /**
   * Index content for searching
   */
  indexContent(contentId, content) {
    try {
      // Store content metadata
      this.contentStore.set(contentId, {
        url: content.url,
        title: content.title,
        description: content.description,
        qualityScore: content.qualityScore || 0,
        contentType: content.contentType,
        publishDate: content.publishDate,
        wordCount: content.wordCount || 0,
        topics: content.topics || []
      });

      // Create searchable text
      const searchableFields = {
        title: content.title || '',
        description: content.description || '',
        headings: (content.headings || []).map(h => h.text).join(' '),
        content: (content.paragraphs || []).join(' '),
        keywords: (content.keywords || []).join(' '),
        topics: (content.topics || []).join(' ')
      };

      // Tokenize and process each field
      const fieldTerms = {};
      const allTerms = new Set();
      
      Object.entries(searchableFields).forEach(([field, text]) => {
        const terms = this.tokenizeText(text);
        fieldTerms[field] = terms;
        terms.forEach(term => allTerms.add(term));
      });

      // Calculate term frequencies
      const termFreq = new Map();
      Object.entries(fieldTerms).forEach(([field, terms]) => {
        terms.forEach(term => {
          const currentFreq = termFreq.get(term) || 0;
          const boost = this.boostFactors[field] || 1;
          termFreq.set(term, currentFreq + boost);
        });
      });

      // Update inverted index
      allTerms.forEach(term => {
        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, new Set());
          this.documentFrequency.set(term, 0);
        }
        
        if (!this.invertedIndex.get(term).has(contentId)) {
          this.invertedIndex.get(term).add(contentId);
          this.documentFrequency.set(term, this.documentFrequency.get(term) + 1);
        }
      });

      // Store term frequencies for this document
      this.termFrequency.set(contentId, termFreq);
      
      // Store complete searchable text
      this.index.set(contentId, {
        ...fieldTerms,
        allText: Object.values(searchableFields).join(' ').toLowerCase(),
        terms: Array.from(allTerms),
        termCount: allTerms.size
      });

      this.totalDocuments++;
      
      logger.debug(`Indexed content: ${contentId}`, {
        title: content.title,
        terms: allTerms.size,
        wordCount: content.wordCount
      });

    } catch (error) {
      logger.error(`Failed to index content ${contentId}:`, error);
    }
  }

  /**
   * Search indexed content
   */
  search(query, options = {}) {
    try {
      const limit = Math.min(options.limit || this.defaultLimit, this.maxLimit);
      const offset = options.offset || 0;
      const filters = options.filters || {};
      
      if (!query || query.length < this.minQueryLength) {
        return {
          results: [],
          total: 0,
          query,
          took: 0
        };
      }

      const startTime = Date.now();
      
      // Process query
      const queryTerms = this.tokenizeText(query.toLowerCase(), { stem: true });
      const queryVector = this.createQueryVector(queryTerms);
      
      // Get candidate documents
      const candidates = this.getCandidateDocuments(queryTerms);
      
      if (candidates.size === 0) {
        return {
          results: [],
          total: 0,
          query,
          took: Date.now() - startTime
        };
      }

      // Calculate relevance scores
      const scoredResults = [];
      
      for (const contentId of candidates) {
        const content = this.contentStore.get(contentId);
        const indexData = this.index.get(contentId);
        
        if (!content || !indexData) continue;
        
        // Apply filters
        if (!this.passesFilters(content, filters)) continue;
        
        // Calculate relevance score
        const score = this.calculateRelevanceScore(
          contentId,
          queryTerms,
          queryVector,
          indexData,
          content
        );
        
        if (score > 0) {
          scoredResults.push({
            contentId,
            score,
            ...content
          });
        }
      }

      // Sort by relevance score
      scoredResults.sort((a, b) => b.score - a.score);
      
      // Apply pagination
      const paginatedResults = scoredResults.slice(offset, offset + limit);
      
      const took = Date.now() - startTime;
      
      logger.debug(`Search completed`, {
        query,
        total: scoredResults.length,
        returned: paginatedResults.length,
        took
      });

      return {
        results: paginatedResults.map(result => ({
          url: result.url,
          title: result.title,
          description: result.description,
          contentType: result.contentType,
          qualityScore: result.qualityScore,
          wordCount: result.wordCount,
          publishDate: result.publishDate,
          topics: result.topics,
          relevanceScore: Math.round(result.score * 100) / 100
        })),
        total: scoredResults.length,
        query,
        took
      };

    } catch (error) {
      logger.error('Search failed:', error);
      return {
        results: [],
        total: 0,
        query,
        error: error.message,
        took: 0
      };
    }
  }

  /**
   * Tokenize text into searchable terms
   */
  tokenizeText(text, options = {}) {
    if (!text || typeof text !== 'string') return [];
    
    return textProcessor.tokenize(text, {
      lowercase: true,
      removeStopWords: true,
      minLength: 2,
      maxLength: 50,
      stem: true,
      ...options
    });
  }

  /**
   * Create query vector for similarity calculation
   */
  createQueryVector(queryTerms) {
    const vector = new Map();
    
    queryTerms.forEach(term => {
      vector.set(term, (vector.get(term) || 0) + 1);
    });
    
    return vector;
  }

  /**
   * Get candidate documents that contain query terms
   */
  getCandidateDocuments(queryTerms) {
    const candidates = new Set();
    
    queryTerms.forEach(term => {
      // Exact matches
      if (this.invertedIndex.has(term)) {
        this.invertedIndex.get(term).forEach(docId => {
          candidates.add(docId);
        });
      }
      
      // Fuzzy matches if enabled
      if (this.enableFuzzySearch && term.length > 3) {
        this.findSimilarTerms(term).forEach(similarTerm => {
          if (this.invertedIndex.has(similarTerm)) {
            this.invertedIndex.get(similarTerm).forEach(docId => {
              candidates.add(docId);
            });
          }
        });
      }
    });
    
    return candidates;
  }

  /**
   * Calculate relevance score using TF-IDF and other factors
   */
  calculateRelevanceScore(contentId, queryTerms, queryVector, indexData, content) {
    let score = 0;
    const termFreq = this.termFrequency.get(contentId);
    
    if (!termFreq) return 0;
    
    // TF-IDF score
    queryTerms.forEach(term => {
      const tf = termFreq.get(term) || 0;
      if (tf > 0) {
        const df = this.documentFrequency.get(term) || 1;
        const idf = Math.log(this.totalDocuments / df);
        score += tf * idf;
      }
    });
    
    // Exact phrase matching bonus
    const exactPhraseBonus = this.calculateExactPhraseBonus(
      queryTerms.join(' '),
      indexData.allText
    );
    score += exactPhraseBonus * 5;
    
    // Title matching bonus
    const titleBonus = this.calculateFieldMatchBonus(
      queryTerms,
      indexData.title || [],
      this.boostFactors.title
    );
    score += titleBonus;
    
    // Description matching bonus
    const descriptionBonus = this.calculateFieldMatchBonus(
      queryTerms,
      indexData.description || [],
      this.boostFactors.description
    );
    score += descriptionBonus;
    
    // Quality score bonus
    const qualityBonus = (content.qualityScore || 0) * this.boostFactors.quality;
    score += qualityBonus;
    
    // Freshness bonus (newer content gets slight boost)
    if (content.publishDate) {
      const daysSincePublish = (Date.now() - new Date(content.publishDate)) / (1000 * 60 * 60 * 24);
      const freshnessBonus = Math.max(0, (365 - daysSincePublish) / 365) * 0.1;
      score += freshnessBonus;
    }
    
    // Content type bonus
    const typeBonus = this.getContentTypeBonus(content.contentType);
    score += typeBonus;
    
    // Normalize score by document length
    const lengthNorm = Math.log(1 + (indexData.termCount || 1));
    score = score / lengthNorm;
    
    return Math.max(score, 0);
  }

  /**
   * Calculate exact phrase matching bonus
   */
  calculateExactPhraseBonus(phrase, text) {
    if (!phrase || !text) return 0;
    
    const normalizedPhrase = phrase.toLowerCase();
    const normalizedText = text.toLowerCase();
    
    const matches = (normalizedText.match(new RegExp(normalizedPhrase, 'g')) || []).length;
    return matches > 0 ? Math.log(1 + matches) : 0;
  }

  /**
   * Calculate field-specific matching bonus
   */
  calculateFieldMatchBonus(queryTerms, fieldTerms, boostFactor) {
    if (!fieldTerms || fieldTerms.length === 0) return 0;
    
    let matches = 0;
    queryTerms.forEach(term => {
      if (fieldTerms.includes(term)) {
        matches++;
      }
    });
    
    return matches > 0 ? (matches / queryTerms.length) * boostFactor : 0;
  }

  /**
   * Get content type specific bonus
   */
  getContentTypeBonus(contentType) {
    const typeBoosts = {
      'article': 0.2,
      'blog-post': 0.15,
      'tutorial': 0.25,
      'news-article': 0.1,
      'review': 0.1,
      'product-page': 0.05,
      'recipe': 0.15
    };
    
    return typeBoosts[contentType] || 0;
  }

  /**
   * Find similar terms for fuzzy matching
   */
  findSimilarTerms(term) {
    const similarTerms = [];
    const threshold = 0.8;
    
    for (const indexTerm of this.invertedIndex.keys()) {
      if (indexTerm !== term && indexTerm.length >= term.length - 1) {
        const similarity = this.calculateStringSimilarity(term, indexTerm);
        if (similarity >= threshold) {
          similarTerms.push(indexTerm);
        }
      }
    }
    
    return similarTerms;
  }

  /**
   * Calculate string similarity (Jaro-Winkler approximation)
   */
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Simple Levenshtein distance approximation
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    let distance = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] !== shorter[i]) distance++;
    }
    distance += longer.length - shorter.length;
    
    return (longer.length - distance) / longer.length;
  }

  /**
   * Check if content passes filters
   */
  passesFilters(content, filters) {
    if (filters.contentType && content.contentType !== filters.contentType) {
      return false;
    }
    
    if (filters.minQuality && content.qualityScore < filters.minQuality) {
      return false;
    }
    
    if (filters.maxAge) {
      if (content.publishDate) {
        const daysSincePublish = (Date.now() - new Date(content.publishDate)) / (1000 * 60 * 60 * 24);
        if (daysSincePublish > filters.maxAge) return false;
      }
    }
    
    if (filters.minWordCount && content.wordCount < filters.minWordCount) {
      return false;
    }
    
    if (filters.topics && filters.topics.length > 0) {
      const hasMatchingTopic = filters.topics.some(topic => 
        content.topics && content.topics.includes(topic)
      );
      if (!hasMatchingTopic) return false;
    }
    
    return true;
  }

  /**
   * Get search suggestions/autocomplete
   */
  getSuggestions(partialQuery, limit = 10) {
    const suggestions = [];
    const query = partialQuery.toLowerCase().trim();
    
    if (query.length < 2) return suggestions;
    
    // Find terms that start with the query
    for (const term of this.invertedIndex.keys()) {
      if (term.startsWith(query) && suggestions.length < limit) {
        const docCount = this.documentFrequency.get(term) || 0;
        suggestions.push({
          term,
          frequency: docCount
        });
      }
    }
    
    // Sort by frequency
    suggestions.sort((a, b) => b.frequency - a.frequency);
    
    return suggestions.slice(0, limit).map(s => s.term);
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalDocuments: this.totalDocuments,
      totalTerms: this.invertedIndex.size,
      averageTermsPerDocument: this.totalDocuments > 0 
        ? Math.round(Array.from(this.termFrequency.values())
            .reduce((sum, termMap) => sum + termMap.size, 0) / this.totalDocuments)
        : 0,
      indexSize: this.index.size,
      invertedIndexSize: this.invertedIndex.size
    };
  }

  /**
   * Export search index
   */
  exportIndex() {
    return {
      index: Array.from(this.index.entries()),
      invertedIndex: Array.from(this.invertedIndex.entries()).map(([term, docIds]) => [
        term, 
        Array.from(docIds)
      ]),
      termFrequency: Array.from(this.termFrequency.entries()).map(([docId, termMap]) => [
        docId,
        Array.from(termMap.entries())
      ]),
      documentFrequency: Array.from(this.documentFrequency.entries()),
      contentStore: Array.from(this.contentStore.entries()),
      totalDocuments: this.totalDocuments
    };
  }

  /**
   * Import search index
   */
  importIndex(indexData) {
    this.index = new Map(indexData.index || []);
    this.invertedIndex = new Map((indexData.invertedIndex || []).map(([term, docIds]) => [
      term,
      new Set(docIds)
    ]));
    this.termFrequency = new Map((indexData.termFrequency || []).map(([docId, termEntries]) => [
      docId,
      new Map(termEntries)
    ]));
    this.documentFrequency = new Map(indexData.documentFrequency || []);
    this.contentStore = new Map(indexData.contentStore || []);
    this.totalDocuments = indexData.totalDocuments || 0;
    
    logger.info(`Imported search index with ${this.totalDocuments} documents`);
  }

  /**
   * Clear the search index
   */
  clear() {
    this.index.clear();
    this.invertedIndex.clear();
    this.termFrequency.clear();
    this.documentFrequency.clear();
    this.contentStore.clear();
    this.totalDocuments = 0;
    
    logger.info('Search index cleared');
  }
}

module.exports = SearchEngine;