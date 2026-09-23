/**
 * Autonomous web search and webpage content extractor.
 */

function decodeHtmlEntities(str) {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Search DuckDuckGo without API keys.
 * Uses DuckDuckGo Lite with robust fallback to Wikipedia search.
 * @param {string} query - The search query.
 * @param {number} [maxResults=5]
 */
export async function searchWeb(query, maxResults = 5) {
  const results = [];

  // Primary: DuckDuckGo Lite
  try {
    const url = 'https://lite.duckduckgo.com/lite/';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      body: `q=${encodeURIComponent(query)}`
    });

    if (response.ok) {
      const html = await response.text();
      const linkRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi;

      const linkMatches = [...html.matchAll(linkRegex)];
      const snippetMatches = [...html.matchAll(snippetRegex)];

      for (let i = 0; i < linkMatches.length && results.length < maxResults; i++) {
        let rawUrl = linkMatches[i][1];
        if (rawUrl.includes('uddg=')) {
          const params = new URLSearchParams(rawUrl.split('?')[1]);
          rawUrl = decodeURIComponent(params.get('uddg') || rawUrl);
        }
        const title = decodeHtmlEntities(linkMatches[i][2].replace(/<[^>]+>/g, ''));
        const snippet = snippetMatches[i] ? decodeHtmlEntities(snippetMatches[i][1].replace(/<[^>]+>/g, '')) : '';

        if (rawUrl.startsWith('http') && !rawUrl.includes('duckduckgo.com')) {
          results.push({
            title,
            url: rawUrl,
            snippet
          });
        }
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // Fallback: Wikipedia full-text search API if DuckDuckGo returns empty
  if (results.length === 0) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const data = await wikiRes.json();
        const items = data?.query?.search || [];
        for (let i = 0; i < items.length && results.length < maxResults; i++) {
          results.push({
            title: decodeHtmlEntities(items[i].title),
            snippet: decodeHtmlEntities(items[i].snippet.replace(/<[^>]+>/g, '')),
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(items[i].title.replace(/\s+/g, '_'))}`
          });
        }
      }
    } catch (err) {
      // Return empty if fallback also fails
    }
  }

  return {
    query,
    totalResults: results.length,
    results
  };
}

/**
 * Fetch and extract text content from a web URL.
 * @param {string} url - Target webpage URL.
 * @param {number} [maxLength=4000] - Character limit for returned text.
 */
export async function fetchWebContent(url, maxLength = 4000) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}`, url };
    }

    const html = await response.text();
    // Strip scripts, styles, headers, footers
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const truncated = cleaned.length > maxLength;
    if (truncated) {
      cleaned = cleaned.substring(0, maxLength) + '... [truncated]';
    }

    return {
      url,
      characterCount: cleaned.length,
      isTruncated: truncated,
      content: cleaned
    };
  } catch (err) {
    return { error: `Failed to fetch webpage: ${err.message}`, url };
  }
}
