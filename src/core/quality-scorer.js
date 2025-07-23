const textProcessor = require('../utils/text-processor');
const logger = require('../utils/logger');

class QualityScorer {
  constructor() {
    this.weights = {
      wordCount: 0.2,
      headingStructure: 0.15,
      metaInformation: 0.15,
      linkQuality: 0.1,
      imagePresence: 0.05,
      textQuality: 0.2,
      structuredData: 0.1,
      freshness: 0.05
    };

    this.thresholds = {
      minWordCount: 100,
      optimalWordCount: 800,
      maxWordCount: 5000,
      minHeadings: 1,
      optimalHeadings: 5
    };
  }

  /**
   * Calculate overall content quality score (0-100)
   */
  calculate(content) {
    if (!content) return 0;

    let totalScore = 0;
    const scores = {};

    // Word count scoring
    scores.wordCount = this.scoreWordCount(content.wordCount || 0);
    totalScore += scores.wordCount * this.weights.wordCount;

    // Heading structure scoring
    scores.headingStructure = this.scoreHeadingStructure(content.headings || []);
    totalScore += scores.headingStructure * this.weights.headingStructure;

    // Meta information scoring
    scores.metaInformation = this.scoreMetaInformation(content);
    totalScore += scores.metaInformation * this.weights.metaInformation;

    // Link quality scoring
    scores.linkQuality = this.scoreLinkQuality(content.links || []);
    totalScore += scores.linkQuality * this.weights.linkQuality;

    // Image presence scoring
    scores.imagePresence = this.scoreImagePresence(content.images || []);
    totalScore += scores.imagePresence * this.weights.imagePresence;

    // Text quality scoring
    scores.textQuality = this.scoreTextQuality(content);
    totalScore += scores.textQuality * this.weights.textQuality;

    // Structured data scoring
    scores.structuredData = this.scoreStructuredData(content.structuredData || []);
    totalScore += scores.structuredData * this.weights.structuredData;

    // Freshness scoring
    scores.freshness = this.scoreFreshness(content.publishDate);
    totalScore += scores.freshness * this.weights.freshness;

    const finalScore = Math.min(Math.max(Math.round(totalScore), 0), 100);

    logger.debug('Quality scoring breakdown:', {
      url: content.url,
      finalScore,
      breakdown: scores
    });

    return finalScore;
  }

  /**
   * Score based on word count
   */
  scoreWordCount(wordCount) {
    if (wordCount < this.thresholds.minWordCount) {
      return (wordCount / this.thresholds.minWordCount) * 50;
    } else if (wordCount <= this.thresholds.optimalWordCount) {
      return 50 + ((wordCount - this.thresholds.minWordCount) / 
        (this.thresholds.optimalWordCount - this.thresholds.minWordCount)) * 50;
    } else if (wordCount <= this.thresholds.maxWordCount) {
      return 100 - ((wordCount - this.thresholds.optimalWordCount) / 
        (this.thresholds.maxWordCount - this.thresholds.optimalWordCount)) * 20;
    } else {
      return 80; // Very long content gets penalized slightly
    }
  }

  /**
   * Score heading structure and hierarchy
   */
  scoreHeadingStructure(headings) {
    if (headings.length === 0) return 0;

    let score = 0;

    // Basic presence score
    score += Math.min(headings.length / this.thresholds.optimalHeadings, 1) * 60;

    // Hierarchy scoring
    const levels = headings.map(h => h.level);
    const hasH1 = levels.includes(1);
    const hasMultipleLevels = new Set(levels).size > 1;
    
    if (hasH1) score += 20;
    if (hasMultipleLevels) score += 20;

    // Check for logical hierarchy
    let hierarchyScore = 0;
    for (let i = 1; i < headings.length; i++) {
      const currentLevel = headings[i].level;
      const prevLevel = headings[i - 1].level;
      
      if (currentLevel <= prevLevel + 1) {
        hierarchyScore += 1;
      }
    }
    
    if (headings.length > 1) {
      score += (hierarchyScore / (headings.length - 1)) * 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Score meta information completeness
   */
  scoreMetaInformation(content) {
    let score = 0;

    // Title presence and quality
    if (content.title) {
      score += 25;
      if (content.title.length >= 10 && content.title.length <= 70) {
        score += 15;
      }
    }

    // Description presence and quality
    if (content.description) {
      score += 25;
      if (content.description.length >= 50 && content.description.length <= 300) {
        score += 15;
      }
    }

    // Author information
    if (content.author) score += 10;

    // Publication date
    if (content.publishDate) score += 10;

    // Keywords
    if (content.keywords && content.keywords.length > 0) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Score link quality
   */
  scoreLinkQuality(links) {
    if (links.length === 0) return 0;

    let score = 0;
    const internalLinks = links.filter(link => link.isInternal);
    const externalLinks = links.filter(link => !link.isInternal);

    // Basic presence
    score += Math.min(links.length / 10, 1) * 30;

    // Internal vs external balance
    if (internalLinks.length > 0) score += 20;
    if (externalLinks.length > 0) score += 10;

    // Link text quality
    const qualityLinks = links.filter(link => 
      link.text && link.text.length > 5 && 
      !link.text.toLowerCase().includes('click here')
    );
    
    if (links.length > 0) {
      score += (qualityLinks.length / links.length) * 40;
    }

    return Math.min(score, 100);
  }

  /**
   * Score image presence and quality
   */
  scoreImagePresence(images) {
    if (images.length === 0) return 0;

    let score = 30; // Base score for having images

    // Alt text quality
    const imagesWithAlt = images.filter(img => 
      img.alt && img.alt.length > 5
    );
    
    if (images.length > 0) {
      score += (imagesWithAlt.length / images.length) * 40;
    }

    // Reasonable number of images
    if (images.length >= 2 && images.length <= 10) {
      score += 30;
    }

    return Math.min(score, 100);
  }

  /**
   * Score text quality and readability
   */
  scoreTextQuality(content) {
    const allText = [
      content.title || '',
      content.description || '',
      ...(content.paragraphs || [])
    ].join(' ');

    if (!allText) return 0;

    let score = 0;

    // Paragraph count and length
    const paragraphs = content.paragraphs || [];
    if (paragraphs.length > 0) {
      score += Math.min(paragraphs.length / 5, 1) * 25;
      
      // Average paragraph length
      const avgLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;
      if (avgLength >= 50 && avgLength <= 200) {
        score += 25;
      }
    }

    // Sentence variety (approximate)
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      const avgSentenceLength = allText.length / sentences.length;
      if (avgSentenceLength >= 15 && avgSentenceLength <= 30) {
        score += 25;
      }
    }

    // Keyword diversity
    const keywords = textProcessor.extractKeywords(allText, { maxKeywords: 20 });
    if (keywords.length >= 5) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  /**
   * Score structured data presence
   */
  scoreStructuredData(structuredData) {
    if (structuredData.length === 0) return 0;

    let score = 50; // Base score for having structured data

    // JSON-LD is preferred
    const hasJsonLd = structuredData.some(data => data.type === 'json-ld');
    if (hasJsonLd) score += 30;

    // Microdata is also good
    const hasMicrodata = structuredData.some(data => data.type === 'microdata');
    if (hasMicrodata) score += 20;

    return Math.min(score, 100);
  }

  /**
   * Score content freshness
   */
  scoreFreshness(publishDate) {
    if (!publishDate) return 50; // Neutral score for unknown date

    try {
      const pubDate = new Date(publishDate);
      const now = new Date();
      const daysDiff = (now - pubDate) / (1000 * 60 * 60 * 24);

      if (daysDiff < 0) return 50; // Future date, neutral
      if (daysDiff <= 7) return 100; // Very fresh
      if (daysDiff <= 30) return 90; // Recent
      if (daysDiff <= 90) return 80; // Fairly recent
      if (daysDiff <= 365) return 70; // Within a year
      if (daysDiff <= 730) return 60; // Within two years
      
      return 50; // Older content, neutral
    } catch (error) {
      return 50; // Invalid date, neutral
    }
  }

  /**
   * Get quality assessment details
   */
  getDetailedAssessment(content) {
    const scores = {};
    
    scores.wordCount = {
      score: this.scoreWordCount(content.wordCount || 0),
      value: content.wordCount || 0,
      assessment: this.getWordCountAssessment(content.wordCount || 0)
    };

    scores.headingStructure = {
      score: this.scoreHeadingStructure(content.headings || []),
      value: (content.headings || []).length,
      assessment: this.getHeadingAssessment(content.headings || [])
    };

    scores.metaInformation = {
      score: this.scoreMetaInformation(content),
      assessment: this.getMetaAssessment(content)
    };

    return {
      overallScore: this.calculate(content),
      breakdown: scores,
      recommendations: this.getRecommendations(content, scores)
    };
  }

  /**
   * Get improvement recommendations
   */
  getRecommendations(content, scores) {
    const recommendations = [];

    if (scores.wordCount.score < 50) {
      recommendations.push('Consider adding more content to reach at least 100 words');
    }

    if (scores.headingStructure.score < 50) {
      recommendations.push('Add more headings to improve content structure');
    }

    if (!content.description) {
      recommendations.push('Add a meta description to improve SEO');
    }

    if (!content.title || content.title.length < 10) {
      recommendations.push('Improve the page title for better SEO');
    }

    return recommendations;
  }

  getWordCountAssessment(wordCount) {
    if (wordCount < 100) return 'Too short';
    if (wordCount < 300) return 'Short';
    if (wordCount < 800) return 'Good length';
    if (wordCount < 2000) return 'Comprehensive';
    return 'Very long';
  }

  getHeadingAssessment(headings) {
    if (headings.length === 0) return 'No headings';
    if (headings.length < 3) return 'Few headings';
    if (headings.length < 6) return 'Good structure';
    return 'Well structured';
  }

  getMetaAssessment(content) {
    const hasTitle = !!content.title;
    const hasDescription = !!content.description;
    const hasAuthor = !!content.author;
    
    if (hasTitle && hasDescription && hasAuthor) return 'Complete';
    if (hasTitle && hasDescription) return 'Good';
    if (hasTitle) return 'Basic';
    return 'Poor';
  }
}

module.exports = QualityScorer;