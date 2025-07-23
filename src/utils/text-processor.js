const natural = require('natural');
const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'would', 'could', 'should', 'this', 'these', 'they', 'them',
  'their', 'there', 'where', 'when', 'what', 'who', 'why', 'how', 'can', 'do',
  'have', 'had', 'been', 'being', 'but', 'not', 'or', 'so', 'if', 'no', 'yes'
]);

class TextProcessor {
  /**
   * Clean and normalize text
   */
  static cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n\t]/g, ' ') // Remove line breaks and tabs
      .replace(/[^\w\s.,!?;:-]/g, '') // Remove special characters
      .trim();
  }

  /**
   * Tokenize text into words and stem them
   */
  static tokenize(text, options = {}) {
    const {
      lowercase = true,
      removeStopWords = false,
      minLength = 1,
      maxLength = 50,
      stem = true
    } = options;

    if (!text) return [];

    let tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => 
        token.length >= minLength && 
        token.length <= maxLength
      );

    if (removeStopWords) {
      tokens = tokens.filter(token => !stopWords.has(token));
    }

    if (stem) {
      tokens = this.stemTokens(tokens);
    }

    return tokens;
  }

  /**
   * Stem an array of tokens using natural's Porter stemmer
   */
  static stemTokens(tokens) {
    return tokens.map(token => natural.PorterStemmer.stem(token));
  }

  /**
   * Extract keywords from text
   */
  static extractKeywords(text, options = {}) {
    const {
      maxKeywords = 20,
      minWordLength = 3,
      excludeStopWords = true
    } = options;

    const words = this.tokenize(text, {
      removeStopWords: excludeStopWords,
      minLength: minWordLength
    });

    // Count word frequencies
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Sort by frequency and return top keywords
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word, freq]) => ({ word, frequency: freq }));
  }

  /**
   * Get word count
   */
  static getWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Check if word is a stop word
   */
  static isStopWord(word) {
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Calculate text similarity (Jaccard similarity)
   */
  static calculateSimilarity(text1, text2) {
    const tokens1 = new Set(this.tokenize(text1, { removeStopWords: true }));
    const tokens2 = new Set(this.tokenize(text2, { removeStopWords: true }));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

module.exports = TextProcessor;