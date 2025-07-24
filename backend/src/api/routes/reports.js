const express = require('express');
const router = express.Router();
const WebCrawlerAI = require('../../core/crawler');
const logger = require('../../utils/logger');
const { scrapeBingSearch } = require('../../utils/bing-search-scraper');
const ContentExtractor = require('../../core/content-extractor');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

// Import the crawler instance from crawl route to share data
const crawlRoutes = require('./crawl');

async function getCrawler() {
  return await crawlRoutes.getCrawler();
}

/**
 * POST /reports/generate - Advanced AI Research Agent for Comprehensive Reports
 */
router.post('/generate', async (req, res) => {
  try {
    const { query, type = 'comprehensive' } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        code: 'MISSING_QUERY'
      });
    }

    logger.api.request('POST', '/reports/generate', { query, type });
    const startTime = Date.now();
    
    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'OpenAI API key not configured. AI-powered reports require OpenAI integration.',
        code: 'MISSING_API_KEY'
      });
    }

    logger.info(`🔬 Starting Advanced AI Research for: "${query}"`);
    
    // STAGE 1: Query Analysis & Enhancement
    logger.info('📋 Stage 1: Analyzing query and generating research strategy...');
    const researchPlan = await analyzeQueryAndCreateResearchPlan(query, type, apiKey);
    logger.info(`✓ Generated ${researchPlan.searchQueries.length} targeted search queries`);
    
    // STAGE 2: Multi-Query Web Research
    logger.info('🔍 Stage 2: Conducting comprehensive web research...');
    const researchResults = await conductComprehensiveResearch(researchPlan.searchQueries);
    logger.info(`✓ Extracted content from ${researchResults.length} high-quality sources`);
    
    // STAGE 3: Content Analysis & Prioritization
    logger.info('🎯 Stage 3: Analyzing and prioritizing content...');
    const prioritizedContent = await analyzeAndPrioritizeContent(researchResults, query, type, apiKey);
    logger.info(`✓ Prioritized ${prioritizedContent.length} content sources by relevance`);
    
    // STAGE 4: Advanced Report Synthesis
    logger.info('📊 Stage 4: Synthesizing comprehensive report...');
    const reportContent = await generateAdvancedReport(query, type, prioritizedContent, researchPlan, apiKey);
    logger.info(`✓ Generated comprehensive ${reportContent.split(' ').length}-word report`);

    const duration = Date.now() - startTime;
    const report = {
      id: Date.now().toString(),
      title: `${getReportTypeTitle(type)}: ${query}`,
      type,
      query,
      content: reportContent,
      createdAt: new Date().toISOString(),
      wordCount: reportContent.split(' ').length,
      sources: researchResults.length,
      duration: Math.round(duration / 1000),
      metadata: {
        generatedBy: 'Advanced AI Research Agent',
        researchStages: 4,
        searchQueries: researchPlan.searchQueries.length,
        contentExtracted: true,
        aiAnalyzed: true,
        totalWords: prioritizedContent.reduce((sum, item) => sum + (item.wordCount || 0), 0),
        uniqueDomains: [...new Set(researchResults.map(r => r.domain))].length,
        averageRelevanceScore: prioritizedContent.reduce((sum, item) => sum + (item.relevanceScore || 0), 0) / prioritizedContent.length
      },
      researchPlan: {
        originalQuery: query,
        refinedQueries: researchPlan.searchQueries,
        analysisFramework: researchPlan.analysisFramework,
        focusAreas: researchPlan.focusAreas
      }
    };

    logger.api.response('POST', '/reports/generate', 200, duration);
    logger.info(`🎉 Advanced AI Research completed in ${Math.round(duration / 1000)}s`);
    
    res.json({
      success: true,
      report,
      sources: researchResults.map(r => ({
        title: r.title,
        url: r.url,
        domain: r.domain,
        wordCount: r.wordCount,
        relevanceScore: r.relevanceScore
      })),
      researchPlan: {
        searchQueries: researchPlan.searchQueries,
        focusAreas: researchPlan.focusAreas
      }
    });

  } catch (error) {
    logger.api.error('POST', '/reports/generate', error);
    res.status(500).json({
      error: 'Advanced report generation failed',
      message: error.message,
      code: 'RESEARCH_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /reports - Get all generated reports
 */
router.get('/', async (req, res) => {
  try {
    // For now, return empty array since we don't have persistent storage
    // In a real implementation, this would fetch from database
    res.json({
      success: true,
      reports: []
    });
  } catch (error) {
    logger.api.error('GET', '/reports', error);
    res.status(500).json({
      error: 'Failed to fetch reports',
      message: error.message
    });
  }
});

/**
 * STAGE 1: Analyze Query and Create Research Plan
 */
async function analyzeQueryAndCreateResearchPlan(query, type, apiKey) {
  const openai = new OpenAI({ apiKey });
  
  const analysisPrompt = `You are an expert research strategist. Analyze the following query and create a comprehensive research plan.

Query: "${query}"
Report Type: ${type}

Provide a JSON response with:
1. "analysisFramework" - What approach should be taken for this research?
2. "focusAreas" - Array of 4-6 specific aspects to investigate
3. "searchQueries" - Array of 8-10 sophisticated search queries that will capture comprehensive information
4. "expectedSources" - Types of sources that would be most valuable
5. "researchDepth" - How deep should the analysis go?

Make the search queries diverse, specific, and strategic. Include:
- Different perspectives and angles
- Technical and non-technical aspects
- Current trends and historical context
- Expert opinions and analysis
- Statistical and data-driven queries
- Comparative analysis queries

Example for "Tesla company analysis":
{
  "analysisFramework": "Multi-dimensional business analysis covering financial performance, market position, innovation strategy, and competitive landscape",
  "focusAreas": ["Financial Performance", "Electric Vehicle Market Position", "Autonomous Driving Technology", "Energy Business Segment", "Manufacturing & Production", "Competitive Analysis"],
  "searchQueries": [
    "Tesla quarterly financial results revenue profit margins 2024",
    "Tesla Model 3 Model Y sales data market share electric vehicles",
    "Tesla FSD Full Self Driving technology progress regulatory approval",
    "Tesla energy storage solar panel business Powerwall revenue",
    "Tesla Gigafactory production capacity manufacturing efficiency",
    "Tesla vs BYD Volkswagen GM electric vehicle competition analysis",
    "Elon Musk Tesla strategic vision future roadmap",
    "Tesla stock price analysis investor sentiment Wall Street ratings"
  ],
  "expectedSources": ["Financial reports", "Industry analysis", "News articles", "Expert opinions", "Market research"],
  "researchDepth": "Deep analysis with quantitative data and qualitative insights"
}

Provide ONLY the JSON response, no additional text.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are an expert research strategist. Respond only with valid JSON.' },
      { role: 'user', content: analysisPrompt }
    ],
    max_tokens: 1000,
    temperature: 0.2
  });
  
  try {
    return JSON.parse(completion.choices[0].message.content.trim());
  } catch (error) {
    logger.warn('Failed to parse research plan JSON, using fallback');
    return createFallbackResearchPlan(query, type);
  }
}

/**
 * STAGE 2: Conduct Comprehensive Multi-Query Research
 */
async function conductComprehensiveResearch(searchQueries) {
  const allResults = [];
  const extractor = new ContentExtractor();
  
  logger.info(`🔍 Executing ${searchQueries.length} targeted search queries...`);
  
  for (let i = 0; i < searchQueries.length; i++) {
    const searchQuery = searchQueries[i];
    logger.debug(`Query ${i + 1}/${searchQueries.length}: "${searchQuery}"`);
    
    try {
      // Get search results for this specific query
      const bingResults = await scrapeBingSearch(searchQuery, 4);
      logger.debug(`Found ${bingResults?.length || 0} results for query ${i + 1}`);
      
      if (bingResults && bingResults.length > 0) {
        // Extract content from top results (parallel processing)
        const extractionPromises = bingResults.slice(0, 3).map(async (result, idx) => {
          try {
            const { data: html } = await axios.get(result.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
              },
              timeout: 12000,
              maxRedirects: 3,
              maxContentLength: 2 * 1024 * 1024 // 2MB limit
            });
            
            const content = await extractor.extract(html, result.url);
            const fullText = content.paragraphs ? content.paragraphs.join(' ') : '';
            
            return {
              id: `query-${i}-result-${idx}`,
              sourceQuery: searchQuery,
              url: result.url,
              title: result.title || content.title || 'No Title',
              content: fullText,
              snippet: result.snippet || content.description || '',
              domain: new URL(result.url).hostname,
              wordCount: content.wordCount || 0,
              headings: content.headings || [],
              keywords: content.keywords || [],
              publishDate: content.publishDate,
              contentType: content.contentType || 'webpage',
              extractedAt: new Date().toISOString(),
              searchQueryIndex: i
            };
          } catch (extractError) {
            logger.warn(`Content extraction failed for ${result.url}:`, extractError.message);
            return {
              id: `query-${i}-fallback-${idx}`,
              sourceQuery: searchQuery,
              url: result.url,
              title: result.title || 'No Title',
              content: result.snippet || 'Extraction failed',
              snippet: result.snippet || 'No snippet',
              domain: new URL(result.url).hostname,
              wordCount: result.snippet ? result.snippet.split(' ').length : 0,
              extractionError: true,
              extractedAt: new Date().toISOString(),
              searchQueryIndex: i
            };
          }
        });
        
        const queryResults = await Promise.allSettled(extractionPromises);
        const successfulResults = queryResults
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value)
          .filter(result => result.content && result.content.length > 100); // Quality filter
        
        allResults.push(...successfulResults);
      }
      
      // Add delay between queries to be respectful
      if (i < searchQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (queryError) {
      logger.warn(`Search query ${i + 1} failed:`, queryError.message);
    }
  }
  
  logger.info(`✅ Research completed: ${allResults.length} content sources extracted`);
  return allResults;
}

/**
 * STAGE 3: Analyze and Prioritize Content
 */
async function analyzeAndPrioritizeContent(researchResults, originalQuery, type, apiKey) {
  if (researchResults.length === 0) {
    return [];
  }
  
  const openai = new OpenAI({ apiKey });
  
  // Create content summaries for AI analysis
  const contentSummaries = researchResults.map((result, idx) => {
    const contentPreview = result.content.substring(0, 500);
    return {
      id: result.id,
      index: idx,
      title: result.title,
      domain: result.domain,
      contentPreview,
      wordCount: result.wordCount,
      sourceQuery: result.sourceQuery
    };
  });
  
  // Batch analysis for efficiency
  const batchSize = 10;
  const prioritizedResults = [];
  
  for (let i = 0; i < contentSummaries.length; i += batchSize) {
    const batch = contentSummaries.slice(i, i + batchSize);
    
    const analysisPrompt = `Analyze these content sources for relevance to the query: "${originalQuery}" (Report type: ${type})

Content Sources:
${batch.map((item, idx) => `${idx + 1}. **${item.title}** (${item.domain})
Source Query: "${item.sourceQuery}"
Content Preview: ${item.contentPreview}...
Word Count: ${item.wordCount}
`).join('\n')}

For each source, provide a JSON array with:
- "index": The source index (1-${batch.length})
- "relevanceScore": Score 0-10 (10 = highly relevant, comprehensive, authoritative)
- "contentQuality": Score 0-10 (10 = high quality, well-written, detailed)
- "uniqueValue": Score 0-10 (10 = provides unique insights not found elsewhere)
- "overallPriority": Score 0-10 (10 = essential for the report)
- "keyInsights": Array of 2-3 key insights this source provides
- "contentType": "news", "analysis", "technical", "academic", "official", "opinion"

Provide ONLY the JSON array, no additional text.`;
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert content analyst. Respond only with valid JSON.' },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });
      
      const analysis = JSON.parse(completion.choices[0].message.content.trim());
      
      // Merge analysis with original content
      analysis.forEach(item => {
        if (item.index && item.index >= 1 && item.index <= batch.length) {
          const originalIndex = i + item.index - 1;
          const originalResult = researchResults[originalIndex];
          
          if (originalResult) {
            prioritizedResults.push({
              ...originalResult,
              relevanceScore: item.relevanceScore || 0,
              contentQuality: item.contentQuality || 0,
              uniqueValue: item.uniqueValue || 0,
              overallPriority: item.overallPriority || 0,
              keyInsights: item.keyInsights || [],
              contentType: item.contentType || 'unknown',
              analysisComplete: true
            });
          }
        }
      });
      
    } catch (analysisError) {
      logger.warn(`Content analysis failed for batch ${Math.floor(i / batchSize) + 1}:`, analysisError.message);
      // Add unanalyzed content with default scores
      batch.forEach((_, batchIdx) => {
        const originalIndex = i + batchIdx;
        const originalResult = researchResults[originalIndex];
        if (originalResult) {
          prioritizedResults.push({
            ...originalResult,
            relevanceScore: 5,
            contentQuality: 5,
            uniqueValue: 5,
            overallPriority: 5,
            keyInsights: ['Content analysis unavailable'],
            contentType: 'unknown',
            analysisComplete: false
          });
        }
      });
    }
  }
  
  // Sort by overall priority and relevance
  const sorted = prioritizedResults.sort((a, b) => {
    const scoreA = (a.overallPriority * 0.4) + (a.relevanceScore * 0.3) + (a.contentQuality * 0.2) + (a.uniqueValue * 0.1);
    const scoreB = (b.overallPriority * 0.4) + (b.relevanceScore * 0.3) + (b.contentQuality * 0.2) + (b.uniqueValue * 0.1);
    return scoreB - scoreA;
  });
  
  logger.info(`📊 Content prioritized: Top source scored ${sorted[0]?.overallPriority || 0}/10`);
  return sorted;
}

/**
 * STAGE 4: Generate Advanced Report with Deep Analysis
 */
async function generateAdvancedReport(query, type, prioritizedContent, researchPlan, apiKey) {
  const openai = new OpenAI({ apiKey });
  
  // Take top 8-12 highest priority sources
  const topSources = prioritizedContent.slice(0, 12);
  
  // Create comprehensive context
  const researchContext = {
    query,
    type,
    researchPlan,
    totalSources: prioritizedContent.length,
    topSources: topSources.map((source, idx) => ({
      rank: idx + 1,
      title: source.title,
      domain: source.domain,
      content: source.content.substring(0, 1500), // Substantial content sample
      keyInsights: source.keyInsights,
      contentType: source.contentType,
      relevanceScore: source.relevanceScore,
      sourceQuery: source.sourceQuery,
      wordCount: source.wordCount
    }))
  };
  
  const reportPrompts = {
    comprehensive: generateComprehensiveReportPrompt(researchContext),
    business: generateBusinessReportPrompt(researchContext),
    technical: generateTechnicalReportPrompt(researchContext),
    research: generateResearchReportPrompt(researchContext)
  };
  
  const selectedPrompt = reportPrompts[type] || reportPrompts.comprehensive;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { 
        role: 'system', 
        content: 'You are an expert research analyst and professional report writer. Create comprehensive, well-structured reports in Markdown format with deep analysis, critical thinking, and actionable insights. Use proper headers, bullet points, tables where appropriate, and maintain professional formatting throughout. Focus on synthesizing information rather than just summarizing.' 
      },
      { role: 'user', content: selectedPrompt }
    ],
    max_tokens: 4000,
    temperature: 0.3,
    presence_penalty: 0.1,
    frequency_penalty: 0.1
  });
  
  let reportContent = completion.choices[0].message.content.trim();
  
  // Add comprehensive metadata footer
  reportContent += generateReportMetadata(query, type, prioritizedContent, researchPlan);
  
  return reportContent;
}

/**
 * Helper Functions for Advanced Report Generation
 */

// Fallback research plan when AI analysis fails
function createFallbackResearchPlan(query, type) {
  const baseQueries = [
    `"${query}" overview introduction basics`,
    `"${query}" latest news developments 2024`,
    `"${query}" analysis expert opinion`,
    `"${query}" statistics data research`,
    `"${query}" trends future outlook`,
    `"${query}" comparison alternatives`
  ];
  
  return {
    analysisFramework: `Comprehensive analysis of ${query} covering multiple perspectives`,
    focusAreas: ['Overview', 'Current Status', 'Key Developments', 'Analysis', 'Future Outlook'],
    searchQueries: baseQueries,
    expectedSources: ['News articles', 'Analysis reports', 'Expert opinions'],
    researchDepth: 'Standard multi-source analysis'
  };
}

// Generate comprehensive report prompt
function generateComprehensiveReportPrompt(context) {
  return `Create a comprehensive research report about "${context.query}" using the following prioritized research data:

**Research Plan:**
- Framework: ${context.researchPlan.analysisFramework}
- Focus Areas: ${context.researchPlan.focusAreas.join(', ')}
- Sources Analyzed: ${context.totalSources} total, ${context.topSources.length} high-priority

**High-Priority Research Sources:**
${context.topSources.map((source, idx) => `
**Source ${idx + 1}** (Priority Score: ${source.relevanceScore}/10)
**Title:** ${source.title}
**Domain:** ${source.domain} | **Type:** ${source.contentType}
**Research Query:** "${source.sourceQuery}"
**Key Insights:** ${source.keyInsights.join(', ')}
**Content:** ${source.content}

---`).join('\n')}

**REPORT REQUIREMENTS:**
Create a professional, comprehensive report with the following structure:

# Executive Summary
(3-4 sentences summarizing the most critical findings)

# Introduction and Background
(Context and importance of the topic)

# Key Findings and Analysis
## Core Insights
(Most important discoveries from research)

## Detailed Analysis
(Deep dive into specific aspects, supported by data from sources)

## Current Trends and Developments
(Latest developments and emerging patterns)

# Comparative Analysis
(How this topic relates to alternatives, competitors, or similar concepts)

# Implications and Impact
(What these findings mean for stakeholders)

# Future Outlook
(Predictions and anticipated developments)

# Strategic Recommendations
(Actionable insights and suggestions)

# Conclusion
(Synthesis of key points and final thoughts)

**IMPORTANT GUIDELINES:**
- Synthesize information from multiple sources, don't just summarize
- Include specific data, quotes, and examples from the research
- Provide critical analysis and your own insights
- Use professional language and formatting
- Ensure accuracy and avoid speculation not supported by sources
- Make it substantial and valuable to the reader`;
}

// Generate business report prompt
function generateBusinessReportPrompt(context) {
  return `Create a professional business analysis report about "${context.query}" using the research data provided:

**Research Data:** ${context.topSources.length} high-priority sources analyzed
${context.topSources.map(source => `- ${source.title} (${source.domain}) - Relevance: ${source.relevanceScore}/10`).join('\n')}

**Source Content:**
${context.topSources.map((source, idx) => `**Source ${idx + 1}:** ${source.content.substring(0, 800)}...`).join('\n\n')}

Create a business-focused report with:

# Business Analysis: ${context.query}

## Executive Summary

## Market Overview
- Market size, growth, and opportunities
- Key players and competitive landscape
- Market trends and dynamics

## Business Model and Operations
- Revenue streams and business model
- Operational structure and capabilities
- Value proposition and competitive advantages

## Financial Analysis
- Financial performance and metrics
- Investment considerations
- Growth drivers and challenges

## Strategic Assessment
### SWOT Analysis
**Strengths:**
**Weaknesses:**
**Opportunities:**
**Threats:**

## Risk Analysis
- Key risks and mitigation strategies
- Market and operational risks
- Regulatory and competitive risks

## Strategic Recommendations
- Investment recommendations
- Strategic initiatives
- Operational improvements

## Conclusion

Base all analysis on the provided research sources and maintain professional business report standards.`;
}

// Generate technical report prompt
function generateTechnicalReportPrompt(context) {
  return `Create a detailed technical analysis report about "${context.query}" using the research sources:

**Technical Research Sources:**
${context.topSources.map((source, idx) => `${idx + 1}. ${source.title} (${source.domain})
Content: ${source.content.substring(0, 600)}...
`).join('\n')}

Structure the report as:

# Technical Analysis: ${context.query}

## Overview and Introduction

## Technical Specifications
- Core technical details and specifications
- Architecture and design principles
- Performance characteristics and metrics

## Implementation and Functionality
- How the technology works
- Key components and systems
- Technical requirements and dependencies

## Comparative Technical Analysis
- Comparison with alternatives
- Technical advantages and limitations
- Performance benchmarks

## Use Cases and Applications
- Primary technical applications
- Industry implementations
- Integration scenarios

## Technical Challenges and Solutions
- Current limitations and challenges
- Proposed solutions and improvements
- Future technical developments

## Standards and Compliance
- Relevant technical standards
- Compliance requirements
- Certification and validation

## Technical Recommendations
- Implementation best practices
- Technical considerations
- Future technical roadmap

## Conclusion

Ensure technical accuracy and provide detailed technical insights based on the research sources.`;
}

// Generate research report prompt
function generateResearchReportPrompt(context) {
  return `Create an academic-style research report about "${context.query}" using the following research sources:

**Research Sources and Data:**
${context.topSources.map((source, idx) => `
**Source ${idx + 1}:** ${source.title}
**Institution/Publisher:** ${source.domain}
**Content Type:** ${source.contentType}
**Key Findings:** ${source.keyInsights.join('; ')}
**Content:** ${source.content.substring(0, 700)}...
`).join('\n')}

Create a comprehensive research report with:

# Research Report: ${context.query}

## Abstract
(Concise summary of research findings and significance)

## Introduction
- Background and context
- Research objectives and scope
- Methodology and approach

## Literature Review
- Current state of knowledge
- Key studies and findings from sources
- Research gaps and opportunities

## Analysis and Findings
### Primary Findings
(Main discoveries from the research)

### Secondary Findings
(Supporting evidence and additional insights)

### Data Analysis
(Quantitative and qualitative analysis)

## Discussion
- Interpretation of findings
- Implications for the field
- Theoretical and practical contributions

## Limitations and Considerations
- Research limitations
- Methodological considerations
- Potential biases

## Future Research Directions
- Recommended future studies
- Emerging research questions
- Research opportunities

## Conclusion
- Summary of key findings
- Research contributions
- Final recommendations

## References and Sources
(Based on the research sources provided)

Maintain academic rigor and provide evidence-based analysis throughout.`;
}

// Generate comprehensive metadata footer
function generateReportMetadata(query, type, prioritizedContent, researchPlan) {
  const topSources = prioritizedContent.slice(0, 10);
  const avgRelevance = prioritizedContent.reduce((sum, item) => sum + (item.relevanceScore || 0), 0) / prioritizedContent.length;
  const totalWords = prioritizedContent.reduce((sum, item) => sum + (item.wordCount || 0), 0);
  const uniqueDomains = [...new Set(prioritizedContent.map(r => r.domain))];
  
  return `

---

## Research Methodology and Sources

### Research Process
1. **Query Analysis:** Advanced AI analysis of research requirements
2. **Multi-Query Search:** ${researchPlan.searchQueries.length} targeted search strategies
3. **Content Extraction:** Comprehensive content analysis from ${prioritizedContent.length} sources
4. **Content Prioritization:** AI-powered relevance and quality scoring
5. **Report Synthesis:** Advanced AI report generation with deep analysis

### Source Quality Metrics
- **Total Sources Analyzed:** ${prioritizedContent.length}
- **Average Relevance Score:** ${avgRelevance.toFixed(1)}/10
- **Total Content Words:** ${totalWords.toLocaleString()}
- **Unique Domains:** ${uniqueDomains.length}
- **Content Types:** ${[...new Set(prioritizedContent.map(r => r.contentType))].join(', ')}

### Top Research Sources
${topSources.map((source, idx) => `${idx + 1}. **${source.title}** - ${source.domain} (Score: ${source.relevanceScore}/10)`).join('\n')}

### Research Queries Used
${researchPlan.searchQueries.map((query, idx) => `${idx + 1}. "${query}"`).join('\n')}

---

**Report Metadata:**
- **Generated:** ${new Date().toLocaleString()}
- **Query:** "${query}"
- **Report Type:** ${type.charAt(0).toUpperCase() + type.slice(1)}
- **Research Depth:** Advanced Multi-Stage Analysis
- **Generated By:** Advanced AI Research Agent v2.0

*This report was generated using advanced AI research methodology with comprehensive web analysis, content prioritization, and intelligent synthesis.*`;
}

/**
 * Get report type title
 */
function getReportTypeTitle(type) {
  const titles = {
    comprehensive: 'Comprehensive Research Report',
    business: 'Business Analysis Report', 
    technical: 'Technical Analysis Report',
    research: 'Academic Research Report',
    general: 'General Analysis Report',
    custom: 'Custom Analysis Report'
  };
  return titles[type] || 'Advanced Research Report';
}

/**
 * Generate a comprehensive empty report with available information
 */
function generateEmptyReport(query, type, stats) {
  const reportType = type.replace('_', ' ').toUpperCase();
  
  return `# ${reportType} Report: ${query}

**Generated:** ${new Date().toLocaleString()}
**Status:** Comprehensive Analysis Report

## Executive Summary
This report provides a comprehensive analysis of "${query}" based on available data and market intelligence.

## Query Analysis
**Search Term:** ${query}
**Report Type:** ${reportType}
**Analysis Date:** ${new Date().toLocaleDateString()}

## Current Market Context
Based on the search query "${query}", this report analyzes the current market position and trends.

### Key Areas of Interest:
- Market performance and trends
- Company overview and business model
- Recent developments and news
- Industry analysis and competitive landscape
- Future outlook and projections

## Data Sources and Methodology
This report was generated using advanced web crawling and AI-powered analysis techniques.

### Crawler Statistics:
- **Pages Crawled:** ${stats.totalPages}
- **URLs Processed:** ${stats.totalUrls}
- **Words Extracted:** ${stats.totalWords}
- **Failed Crawls:** ${stats.totalFailed}
- **Unique Domains:** ${stats.uniqueDomains}

## Recommendations
1. **Manual Research**: For detailed analysis, consider crawling specific websites related to "${query}"
2. **Data Sources**: Focus on authoritative sources like company websites, financial news, and industry reports
3. **Regular Updates**: Set up periodic crawling to track changes and trends

## Next Steps
To generate more detailed reports:
1. Use the dashboard to crawl specific websites related to "${query}"
2. Try different search queries to expand the data set
3. Combine multiple data sources for comprehensive analysis

## Technical Notes
- Report generated using AI-powered web crawler
- Analysis based on semantic search and content extraction
- Quality scoring applied to ensure relevance and accuracy
- Real-time data processing and analysis

---
*This report was automatically generated by the Web Crawler AI system.*`;
}

/**
 * Get relevant URLs to crawl based on query and report type
 */
async function getRelevantUrlsForQuery(query, type) {
  const urls = [];
  
  // Clean and process the query
  const cleanQuery = query.toLowerCase().trim();
  
  switch (type) {
    case 'stock_news':
      // For stock news, try financial news websites
      if (cleanQuery.includes('stock') || cleanQuery.includes('market') || 
          cleanQuery.includes('adani') || cleanQuery.includes('reliance') ||
          cleanQuery.includes('tesla') || cleanQuery.includes('apple')) {
        urls.push(
          'https://economictimes.indiatimes.com',
          'https://www.moneycontrol.com',
          'https://www.ndtv.com/business',
          'https://www.livemint.com',
          'https://www.financialexpress.com'
        );
      }
      break;
      
    case 'general':
      // For general queries, try news and information sites
      urls.push(
        'https://www.wikipedia.org',
        'https://www.britannica.com',
        'https://www.bbc.com/news',
        'https://www.reuters.com',
        'https://www.theguardian.com'
      );
      break;
      
    case 'custom':
      // For custom queries, try a mix of sources
      urls.push(
        'https://www.wikipedia.org',
        'https://www.britannica.com',
        'https://www.bbc.com/news',
        'https://www.reuters.com'
      );
      break;
  }
  
  // Add query-specific URLs
  if (cleanQuery.includes('adani')) {
    urls.push('https://www.adani.com');
  }
  if (cleanQuery.includes('reliance')) {
    urls.push('https://www.ril.com');
  }
  if (cleanQuery.includes('tesla')) {
    urls.push('https://www.tesla.com');
  }
  
  return urls.slice(0, 3); // Limit to 3 URLs to avoid overwhelming
}

/**
 * Generate empty report when no data is available
 */
function generateEmptyReport(query, type) {
  const reportTitle = getReportTypeTitle(type);
  
  return `# ${reportTitle}: ${query}

**Generated:** ${new Date().toLocaleString()}
**Status:** No Data Available
**Query:** "${query}"

## Notice

Unable to generate a comprehensive report for "${query}" due to:
- No search results found
- Web scraping limitations
- Content extraction failures

## Suggested Actions

### 1. Refine Your Search
- Try different keywords or phrases
- Use more specific terms
- Consider alternative spellings or synonyms

### 2. Check Internet Connectivity
- Ensure stable internet connection
- Verify external websites are accessible
- Check for firewall restrictions

### 3. Try Different Report Types
- **Comprehensive:** General overview and analysis
- **Business:** Business and market focus
- **Technical:** Technical specifications and details
- **Research:** Academic and research-oriented

### 4. Manual Research
- Use the crawl endpoint to analyze specific websites
- Search for authoritative sources manually
- Cross-reference multiple sources

## Technical Information

- **Search Engine:** Bing Web Search
- **Content Extraction:** Advanced NLP processing
- **AI Analysis:** OpenAI GPT-3.5 Turbo
- **Report Generation:** Automated Markdown formatting

## Contact Support

If this issue persists, please:
1. Check the application logs for detailed error information
2. Verify API keys and configurations
3. Ensure all required dependencies are installed

---

*Report generated by Web Crawler AI - No content available for analysis*`;
}

module.exports = router; 