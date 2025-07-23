const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// Import the shared crawler instance from crawl route
const { getCrawler } = require('./crawl');
const { scrapeBingSearch } = require('../../utils/bing-search-scraper');
// const { scrapeBraveSearch } = require('../../utils/brave-search-scraper');
const ContentExtractor = require('../../core/content-extractor');
const axios = require('axios');
const Summarizer = require('node-summarizer').Summarizer;
const { Configuration, OpenAIApi } = require('openai');
const OpenAI = require('openai');
require('dotenv').config();
const fs = require('fs');

// Default test content for when no crawled content is available
const DEFAULT_CONTENT = [
  {
    id: 'test-1',
    url: 'https://example.com/ai-technology',
    title: 'Artificial Intelligence and Modern Technology',
    content: 'Artificial Intelligence (AI) is transforming the way we live and work. From machine learning algorithms to natural language processing, AI technologies are becoming increasingly sophisticated. Companies are investing heavily in AI research and development to gain competitive advantages.',
    snippet: 'AI is transforming modern technology with machine learning and natural language processing capabilities.',
    score: 0.95,
    timestamp: new Date().toISOString(),
    domain: 'example.com'
  },
  {
    id: 'test-2',
    url: 'https://example.com/web-development',
    title: 'Modern Web Development Practices',
    content: 'Web development has evolved significantly with the introduction of frameworks like React, Vue, and Angular. Modern web applications require robust architecture, responsive design, and efficient performance optimization. Developers must stay updated with the latest technologies and best practices.',
    snippet: 'Modern web development involves React, Vue, Angular frameworks with responsive design and performance optimization.',
    score: 0.88,
    timestamp: new Date().toISOString(),
    domain: 'example.com'
  },
  {
    id: 'test-3',
    url: 'https://example.com/data-science',
    title: 'Data Science and Analytics',
    content: 'Data science combines statistics, programming, and domain expertise to extract meaningful insights from data. Organizations use data analytics to make informed decisions, predict trends, and optimize operations. Tools like Python, R, and SQL are essential for data scientists.',
    snippet: 'Data science combines statistics, programming, and domain expertise for meaningful data insights and analytics.',
    score: 0.82,
    timestamp: new Date().toISOString(),
    domain: 'example.com'
  },
  {
    id: 'test-4',
    url: 'https://example.com/cybersecurity',
    title: 'Cybersecurity in the Digital Age',
    content: 'Cybersecurity is crucial in protecting digital assets and information. With increasing cyber threats, organizations must implement robust security measures including encryption, multi-factor authentication, and regular security audits. Ethical hacking and penetration testing help identify vulnerabilities.',
    snippet: 'Cybersecurity protects digital assets through encryption, authentication, and regular security audits.',
    score: 0.78,
    timestamp: new Date().toISOString(),
    domain: 'example.com'
  },
  {
    id: 'test-5',
    url: 'https://example.com/cloud-computing',
    title: 'Cloud Computing Solutions',
    content: 'Cloud computing provides scalable and flexible computing resources over the internet. Services like AWS, Azure, and Google Cloud offer infrastructure, platform, and software as a service. Cloud computing enables businesses to reduce costs and improve efficiency.',
    snippet: 'Cloud computing offers scalable resources through AWS, Azure, and Google Cloud services.',
    score: 0.75,
    timestamp: new Date().toISOString(),
    domain: 'example.com'
  }
];

/**
 * POST /search - Enhanced AI-powered search with full content extraction
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit = 10, enableContentExtraction = true } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Search query is required',
        code: 'MISSING_QUERY'
      });
    }

    logger.api.request('POST', '/search', { query, limit, enableContentExtraction });
    const startTime = Date.now();

    // Scrape Bing for search results
    logger.info(`Calling Bing search for query: "${query}"`);
    const links = await scrapeBingSearch(query, limit);
    logger.info(`Bing search returned ${links?.length || 0} results`);
    
    if (!links.length) {
      // If Bing search fails, return default content with better AI summary
      logger.info('Bing search failed, generating AI summary from default content');
      
      const queryLower = query.toLowerCase();
      const filteredDefaultContent = DEFAULT_CONTENT.filter(item => 
        item.title.toLowerCase().includes(queryLower) ||
        item.content.toLowerCase().includes(queryLower) ||
        item.snippet.toLowerCase().includes(queryLower)
      );

      const contentToReturn = filteredDefaultContent.length > 0 ? filteredDefaultContent : DEFAULT_CONTENT;
      
      // Generate AI summary even for default content
      let summary = '';
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey && contentToReturn.length > 0) {
        try {
          const openai = new OpenAI({ apiKey });
          const combinedContent = contentToReturn.slice(0, 3).map(r => `${r.title}: ${r.content}`).join('\n\n');
          const prompt = `Based on the following information about "${query}", provide a comprehensive summary in Markdown format:\n\n${combinedContent}\n\nPlease format your response using Markdown with:\n- ## headers for main sections\n- **bold text** for key points\n- Bullet points (-) for lists\n- Clear, structured information\n\nSummary:`;
          
          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are an expert research assistant. Provide comprehensive, well-structured summaries in Markdown format that highlight key insights and main points using proper headers, bold text, and bullet points.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.3
          });
          summary = completion.choices[0].message.content.trim();
          logger.info('Generated AI summary from default content');
        } catch (err) {
          logger.warn('Failed to generate AI summary:', err.message);
          summary = `Information about ${query} based on available data. Please check individual results for detailed information.`;
        }
      } else {
        summary = `Search results for "${query}". ${contentToReturn.length} related ${contentToReturn.length === 1 ? 'result' : 'results'} found.`;
      }
      
      const duration = Date.now() - startTime;
      
      logger.search.query(query, contentToReturn, duration);
      logger.api.response('POST', '/search', 200, duration);

      return res.json({
        query,
        results: contentToReturn,
        total: contentToReturn.length,
        took: duration,
        summary: summary,
        source: 'Default Content',
        note: 'Bing search unavailable, showing relevant default content'
      });
    }

    let results = [];
    let enhancedContent = [];
    
    if (enableContentExtraction) {
      // Enhanced mode: Extract full content from each link
      logger.info('Extracting full content from search results...');
      const extractor = new ContentExtractor();
      
      // Process links with concurrency limit to avoid overwhelming servers
      const maxConcurrent = 3;
      for (let i = 0; i < links.length; i += maxConcurrent) {
        const batch = links.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (link, batchIndex) => {
          const index = i + batchIndex;
          try {
            logger.debug(`Extracting content from: ${link.url}`);
            const { data: html } = await axios.get(link.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              },
              timeout: 15000,
              maxRedirects: 3,
              maxContentLength: 2 * 1024 * 1024 // 2MB limit
            });
            
            const extractedContent = await extractor.extract(html, link.url);
            const fullContent = extractedContent.paragraphs ? extractedContent.paragraphs.join(' ') : '';
            
            // Create comprehensive summary from extracted content
            let contentSummary = extractedContent.description || '';
            if (!contentSummary && fullContent) {
              // Take first few paragraphs if no description
              const paragraphs = extractedContent.paragraphs || [];
              contentSummary = paragraphs.slice(0, 3).join(' ');
              if (contentSummary.length > 800) {
                contentSummary = contentSummary.substring(0, 800) + '...';
              }
            }
            
            const result = {
              id: `enhanced-${index}`,
              url: link.url,
              title: link.title || extractedContent.title || 'No Title',
              content: fullContent || link.snippet || 'No content available',
              snippet: link.snippet || contentSummary || 'No snippet available',
              extractedSummary: contentSummary,
              wordCount: extractedContent.wordCount || 0,
              headings: extractedContent.headings || [],
              keywords: extractedContent.keywords || [],
              score: 0.9 - (index * 0.05), // Better scoring
              timestamp: new Date().toISOString(),
              domain: new URL(link.url).hostname,
              contentType: extractedContent.contentType || 'webpage',
              language: extractedContent.language || 'en'
            };
            
            enhancedContent.push({
              title: result.title,
              content: contentSummary || fullContent.substring(0, 1000),
              url: result.url,
              keywords: result.keywords.join(' '),
              headings: result.headings.map(h => h.text).join(' ')
            });
            
            return result;
            
          } catch (err) {
            logger.warn(`Failed to extract content from ${link.url}:`, err.message);
            // Fallback to basic result
            const result = {
              id: `basic-${index}`,
              url: link.url,
              title: link.title || 'No Title',
              content: link.snippet || 'Content extraction failed',
              snippet: link.snippet || 'No snippet available',
              score: 0.9 - (index * 0.05),
              timestamp: new Date().toISOString(),
              domain: new URL(link.url).hostname,
              contentType: 'webpage',
              error: 'Content extraction failed'
            };
            
            enhancedContent.push({
              title: result.title,
              content: result.content,
              url: result.url
            });
            
            return result;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
    } else {
      // Basic mode: Use only Bing snippets (faster)
      results = links.map((link, index) => ({
        id: `basic-${index}`,
        url: link.url,
        title: link.title || 'No Title',
        content: link.snippet || 'No content available',
        snippet: link.snippet || 'No snippet available',
        score: 0.9 - (index * 0.1),
        timestamp: new Date().toISOString(),
        domain: new URL(link.url).hostname,
        contentType: 'webpage'
      }));
      
      enhancedContent = results.map(r => ({
        title: r.title,
        content: r.content,
        url: r.url
      }));
    }

    // Generate comprehensive AI summary
    let summary = '';
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey && enhancedContent.length > 0) {
      try {
        const openai = new OpenAI({ apiKey });
        
        // Create rich context for AI summarization
        const contextContent = enhancedContent.slice(0, 5).map((item, idx) => 
          `${idx + 1}. **${item.title}** (${item.url})\n${item.content}\n${item.keywords ? `Keywords: ${item.keywords}` : ''}\n${item.headings ? `Headings: ${item.headings}` : ''}`
        ).join('\n\n---\n\n');
        
        const prompt = `You are an expert research assistant. Analyze the following search results about "${query}" and provide a comprehensive, well-structured summary in Markdown format.

Search Results:
${contextContent}

Please provide a well-formatted Markdown summary with:

## Overview
A brief overview of what ${query} is/means

## Key Insights
- Use bullet points for main findings
- Include important facts and data points
- Highlight significant trends or developments

## Important Details
- Additional relevant information from the search results
- Notable quotes or statistics (if any)
- Context and background information

## Summary
A concise conclusion that synthesizes the key information

Format your response using proper Markdown syntax with headers (##), bullet points (-), **bold text** for emphasis, and clear structure. Make it informative and easy to read.`;
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert research assistant and content synthesizer. Create comprehensive, well-structured summaries in Markdown format that provide real value to users. Use proper Markdown headers (##), **bold text**, bullet points (-), and clear formatting. Focus on accuracy, clarity, and actionable insights.' 
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.3,
          presence_penalty: 0.1,
          frequency_penalty: 0.1
        });
        
        summary = completion.choices[0].message.content.trim();
        logger.info(`Generated comprehensive AI summary for query: "${query}" (${summary.length} chars)`);
        
      } catch (err) {
        logger.error('Failed to generate AI summary:', err.message);
        
        // Fallback to simple summary
        const topResults = enhancedContent.slice(0, 3);
        summary = `Search results for "${query}" returned ${results.length} relevant ${results.length === 1 ? 'result' : 'results'}. ` +
          `Top findings include information about ${topResults.map(r => r.title.toLowerCase()).join(', ')}. ` +
          `For detailed information, please review the individual search results below.`;
      }
    } else if (!apiKey) {
      summary = `Found ${results.length} search ${results.length === 1 ? 'result' : 'results'} for "${query}". OpenAI API key not configured for AI summarization.`;
    } else {
      summary = `No search results found for "${query}". Please try a different search term.`;
    }

    const duration = Date.now() - startTime;
    
    logger.search.query(query, results, duration);
    logger.api.response('POST', '/search', 200, duration);

    res.json({
      query,
      results: results,
      total: results.length,
      took: duration,
      source: 'Enhanced Bing Search',
      summary: summary,
      contentExtraction: enableContentExtraction,
      metadata: {
        averageWordCount: results.reduce((sum, r) => sum + (r.wordCount || 0), 0) / results.length,
        contentTypes: [...new Set(results.map(r => r.contentType))],
        domains: [...new Set(results.map(r => r.domain))]
      }
    });

  } catch (error) {
    logger.api.error('POST', '/search', error);
    
    // Enhanced error handling with AI summary
    const queryLower = (req.body.query || '').toLowerCase();
    const filteredDefaultContent = DEFAULT_CONTENT.filter(item => 
      item.title.toLowerCase().includes(queryLower) ||
      item.content.toLowerCase().includes(queryLower) ||
      item.snippet.toLowerCase().includes(queryLower)
    );

    const contentToReturn = filteredDefaultContent.length > 0 ? filteredDefaultContent : DEFAULT_CONTENT;
    
    // Try to generate AI summary even in error case
    let errorSummary = '';
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && contentToReturn.length > 0) {
      try {
        const openai = new OpenAI({ apiKey });
        const combinedContent = contentToReturn.slice(0, 2).map(r => `${r.title}: ${r.content}`).join('\n\n');
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'Provide a helpful summary based on available information.' },
            { role: 'user', content: `Provide a summary about "${req.body.query}" based on: ${combinedContent}` }
          ],
          max_tokens: 200,
          temperature: 0.4
        });
        errorSummary = completion.choices[0].message.content.trim();
      } catch (aiError) {
        errorSummary = `Search temporarily unavailable. Showing related content about ${req.body.query || 'your topic'}.`;
      }
    } else {
      errorSummary = `Search encountered an issue. Showing ${contentToReturn.length} related ${contentToReturn.length === 1 ? 'result' : 'results'}.`;
    }
    
    res.json({
      query: req.body.query || '',
      results: contentToReturn,
      total: contentToReturn.length,
      took: 0,
      summary: errorSummary,
      source: 'Default Content (Error Fallback)',
      error: 'Search service temporarily unavailable',
      note: 'Showing relevant default content due to search service issue'
    });
  }
});

/**
 * POST /search/live - Live Bing search, crawl, and summarize
 */
router.post('/live', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required', code: 'MISSING_QUERY' });
    }
    logger.api.request('POST', '/search/live', { query, limit });
    // 1. Scrape Bing for links
    const links = await scrapeBingSearch(query, limit);
    if (!links.length) {
      return res.json({ query, results: [], total: 0 });
    }
    // 2. Crawl and extract summary for each link
    const extractor = new ContentExtractor();
    const results = [];
    let combinedSummaries = '';
    for (const link of links) {
      try {
        const { data: html } = await axios.get(link.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: 20000
        });
        const content = await extractor.extract(html, link.url);
        let summary = content.description || (content.paragraphs && content.paragraphs.slice(0,2).join(' ')) || '';
        if (summary.length > 500) summary = summary.slice(0, 500) + '...';
        results.push({
          title: link.title || content.title,
          url: link.url,
          snippet: link.snippet,
          summary
        });
        combinedSummaries += `\n- ${summary}`;
      } catch (err) {
        results.push({
          title: link.title,
          url: link.url,
          snippet: link.snippet,
          summary: '[Failed to crawl or extract content]'
        });
      }
    }
    // 3. Summarize using OpenAI
    let overallSummary = '';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      overallSummary = '[OpenAI API key not set. Please set OPENAI_API_KEY in your environment.]';
    } else if (!fs.existsSync('.env')) {
      overallSummary = '[.env file not found in project root. Please create one with OPENAI_API_KEY.]';
    } else {
      try {
        const openai = new OpenAI({ apiKey });
        const prompt = `Summarize the following news and information about: ${query}\n${combinedSummaries}\n\nSummary:`;
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes news and web content for users.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 256,
          temperature: 0.5
        });
        overallSummary = completion.choices[0].message.content.trim();
      } catch (err) {
        overallSummary = '[Failed to generate summary with OpenAI: ' + (err?.message || err) + ']';
      }
    }
    res.json({ query, summary: overallSummary, results, total: results.length });
  } catch (error) {
    logger.api.error('POST', '/search/live', error);
    res.status(500).json({ error: 'Live search failed', message: error.message });
  }
});

/**
 * GET /search/suggestions - Get search suggestions
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const crawler = await getCrawler();
    const suggestions = crawler.searchEngine.getSuggestions(query, parseInt(limit));

    res.json({ suggestions });

  } catch (error) {
    logger.api.error('GET', '/search/suggestions', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;