const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrape Bing search results for a query
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
async function scrapeBingSearch(query, limit = 10) {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const results = [];
  try {
    const { data } = await axios.get(searchUrl, { headers });
    const $ = cheerio.load(data);
    $("li.b_algo").each((i, el) => {
      if (results.length >= limit) return false;
      const title = $(el).find('h2').text().trim();
      const url = $(el).find('h2 a').attr('href');
      
      // Try multiple selectors for snippets
      let snippet = $(el).find('.b_caption p').text().trim();
      if (!snippet) snippet = $(el).find('.b_snippet').text().trim();
      if (!snippet) snippet = $(el).find('.b_caption').text().trim();
      if (!snippet) snippet = $(el).find('p').text().trim();
      if (!snippet) snippet = $(el).find('.b_algoSlug').text().trim();
      
      if (title && url) {
        results.push({ title, url, snippet });
      }
    });
    return results;
  } catch (err) {
    console.error('Bing search scrape failed:', err.message);
    return [];
  }
}

module.exports = { scrapeBingSearch }; 