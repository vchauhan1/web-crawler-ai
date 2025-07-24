const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrape Brave search results for a query
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
async function scrapeBraveSearch(query, limit = 10) {
  const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const results = [];
  try {
    const { data } = await axios.get(searchUrl, { headers });
    const $ = cheerio.load(data);
    $("main .results .snippet").each((i, el) => {
      if (results.length >= limit) return false;
      const title = $(el).find('.snippet-title').text().trim();
      const url = $(el).find('.snippet-title a').attr('href');
      const snippet = $(el).find('.snippet-description').text().trim();
      if (title && url) {
        results.push({ title, url, snippet });
      }
    });
    return results;
  } catch (err) {
    console.error('Brave search scrape failed:', err.message);
    return [];
  }
}

module.exports = { scrapeBraveSearch }; 