const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const DEFAULT_OUTPUT_FILE = 'knowledge_base.json';
const DEFAULT_CONCURRENCY = Number(process.env.CRAWLER_CONCURRENCY || 3);
const DEFAULT_MAX_PAGES = Number(process.env.CRAWLER_MAX_PAGES || 100);
const DEFAULT_TIMEOUT_MS = Number(process.env.CRAWLER_TIMEOUT_MS || 30000);
const DEFAULT_RETRY_COUNT = Number(process.env.CRAWLER_RETRY_COUNT || 2);
const DEFAULT_USER_AGENT = process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const REMOVABLE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'nav',
  'header',
  'footer',
  'aside',
  'template',
  'svg',
  'canvas',
  'iframe',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]',
  '[hidden]',
  '.sidebar',
  '.side-bar',
  '.ad',
  '.ads',
  '.advertisement',
  '.promo',
  '.cookie-banner',
  '.newsletter',
  '#sidebar',
  '#ads',
  '#ad',
  '[class*="sidebar"]',
  '[id*="sidebar"]',
  '[class*="advert"]',
  '[id*="advert"]',
  '[class*="cookie"]',
  '[id*="cookie"]'
].join(', ');
const TRACKING_PARAM_PREFIXES = ['utm_', 'fbclid', 'gclid', 'msclkid'];
const INDEX_FILE_NAMES = new Set(['index.php', 'index.html', 'index.htm', 'default.aspx', 'default.asp']);
const NON_HTML_EXTENSIONS = new Set([
  '.7z', '.avi', '.bmp', '.css', '.csv', '.doc', '.docx', '.eot', '.eps', '.gif', '.gz', '.ico', '.jpeg', '.jpg', '.js',
  '.json', '.m4a', '.m4v', '.mov', '.mp3', '.mp4', '.mpeg', '.mpg', '.otf', '.pdf', '.png', '.ppt', '.pptx', '.rar',
  '.rss', '.svg', '.tar', '.tgz', '.tif', '.tiff', '.ttf', '.txt', '.wav', '.webm', '.webp', '.woff', '.woff2', '.xls',
  '.xlsx', '.xml', '.zip'
]);
const MAIN_CONTENT_SELECTORS = [
  'main',
  '[role="main"]',
  'article',
  '.main-content',
  '#main-content',
  '.page-content',
  '#page-content',
  '.content-area',
  '#content',
  '.content',
  '.entry-content',
  '.post-content',
  '.service-content',
  '.service-detail',
  '.service-details',
  '.container .row .col-lg-8',
  '.container .row .col-md-8'
];
const STRIP_TEXT_PATTERNS = [
  /nullam dignissim,[\s\S]*?get started\s+/i,
  /contact info[\s\S]*?get started\s+/i,
  /contact us how can we help you today\?[\s\S]*$/i,
  /get in touch submit now[\s\S]*$/i,
  /quick links[\s\S]*$/i,
  /copyright\s+\d{4}[\s\S]*$/i,
  /all rights reserved\.?[\s\S]*$/i
];
const NOISY_TEXT_PATTERNS = [
  /contact info/i,
  /quick links/i,
  /all rights reserved/i,
  /copyright/i,
  /get in touch/i,
  /submit now/i,
  /follow us/i,
  /newsletter/i
];
const CONTACT_SECTION_SELECTORS = [
  'footer',
  'header',
  '[role="contentinfo"]',
  '.top-bar',
  '.topbar',
  '.contact',
  '#contact',
  '[class*="contact"]',
  '[id*="contact"]'
];
const DEFAULT_BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
];

function toPositiveInteger(value, fallbackValue) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
}

function toNonNegativeInteger(value, fallbackValue) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
}

async function pathExists(targetPath) {
  if (!targetPath) {
    return false;
  }

  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

async function resolveBrowserLaunchOptions(headless) {
  const launchOptions = {
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  const configuredPath = normalizeWhitespace(process.env.PUPPETEER_EXECUTABLE_PATH);

  if (configuredPath) {
    if (await pathExists(configuredPath)) {
      launchOptions.executablePath = configuredPath;
      return launchOptions;
    }

    console.warn(`[crawler] configured browser not found at ${configuredPath}; trying fallbacks`);
  }

  let managedBrowserPath = '';

  try {
    managedBrowserPath = puppeteer.executablePath();
  } catch (error) {
    console.warn(`[crawler] unable to resolve Puppeteer managed browser: ${error.message}`);
  }

  if (managedBrowserPath && await pathExists(managedBrowserPath)) {
    launchOptions.executablePath = managedBrowserPath;
    return launchOptions;
  }

  const fallbackBrowserPath = DEFAULT_BROWSER_CANDIDATES.find(function(candidatePath) {
    return require('fs').existsSync(candidatePath);
  });

  if (fallbackBrowserPath) {
    launchOptions.executablePath = fallbackBrowserPath;
    console.warn(`[crawler] using fallback browser at ${fallbackBrowserPath}`);
    return launchOptions;
  }

  return launchOptions;
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeTrackingParams(urlObject) {
  const nextParams = new URLSearchParams();

  Array.from(urlObject.searchParams.keys())
    .sort()
    .forEach(function(key) {
      const lowerKey = key.toLowerCase();
      const shouldSkip = TRACKING_PARAM_PREFIXES.some(function(prefix) {
        return lowerKey === prefix || lowerKey.startsWith(prefix);
      });

      if (shouldSkip) {
        return;
      }

      urlObject.searchParams.getAll(key).forEach(function(value) {
        nextParams.append(key, value);
      });
    });

  urlObject.search = nextParams.toString() ? `?${nextParams.toString()}` : '';
}

function trimTrailingSlash(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.replace(/\/+$/, '') || '/';
}

function normalizePathname(pathname) {
  const normalizedPathname = trimTrailingSlash(pathname);
  const segments = normalizedPathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  if (lastSegment && INDEX_FILE_NAMES.has(lastSegment.toLowerCase())) {
    const parentPath = segments.slice(0, -1).join('/');

    return parentPath ? `/${parentPath}` : '/';
  }

  return normalizedPathname;
}

function normalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl) {
    return null;
  }

  let urlObject;

  try {
    urlObject = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
  } catch (error) {
    return null;
  }

  if (!['http:', 'https:'].includes(urlObject.protocol)) {
    return null;
  }

  urlObject.hash = '';
  urlObject.pathname = normalizePathname(urlObject.pathname);

  if ((urlObject.protocol === 'https:' && urlObject.port === '443') || (urlObject.protocol === 'http:' && urlObject.port === '80')) {
    urlObject.port = '';
  }

  removeTrackingParams(urlObject);

  return urlObject.toString();
}

function getFileExtension(urlValue) {
  try {
    return path.extname(new URL(urlValue).pathname).toLowerCase();
  } catch (error) {
    return '';
  }
}

function shouldSkipByExtension(urlValue) {
  const extension = getFileExtension(urlValue);

  return extension ? NON_HTML_EXTENSIONS.has(extension) : false;
}

function isSameDomain(candidateUrl, rootUrl) {
  try {
    const candidate = new URL(candidateUrl);
    const root = new URL(rootUrl);

    return candidate.hostname === root.hostname;
  } catch (error) {
    return false;
  }
}

function isLikelyHtmlResponse(response) {
  if (!response) {
    return true;
  }

  const headers = response.headers();
  const contentType = String(headers['content-type'] || '').toLowerCase();

  if (!contentType) {
    return true;
  }

  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
}

function getElementIdentity(element) {
  return `${String(element.attr('id') || '').toLowerCase()} ${String(element.attr('class') || '').toLowerCase()}`;
}

function removeBoilerplateElements($) {
  $(REMOVABLE_SELECTORS).remove();

  $('body')
    .find('*')
    .each(function() {
      const element = $(this);
      const identity = getElementIdentity(element);
      const text = normalizeWhitespace(element.text()).toLowerCase();

      if (/(^|\s)(ad|ads|advert|advertisement|sidebar|breadcrumb|topbar|top-bar|social|share|popup|modal|menu)(\s|$)/.test(identity)) {
        element.remove();
        return;
      }

      if ((/contact info|quick links|all rights reserved|copyright|newsletter/i.test(text) && text.length < 700) ||
        (/get in touch submit now/i.test(text) && text.length < 900)) {
        element.remove();
      }
    });

  $('form').remove();
  $('input').remove();
  $('button').remove();
  $('textarea').remove();
}

function scoreContentCandidate($, element) {
  const text = normalizeWhitespace($(element).text());
  const wordCount = text ? text.split(' ').length : 0;

  if (wordCount < 40) {
    return -1;
  }

  let score = wordCount;
  const tagName = String(element.tagName || element.name || '').toLowerCase();
  const identity = getElementIdentity($(element));

  if (tagName === 'main') {
    score += 250;
  }

  if (tagName === 'article') {
    score += 180;
  }

  if (/(main|content|article|entry|post|service|detail|body)/.test(identity)) {
    score += 120;
  }

  if (/(footer|header|menu|nav|sidebar|contact|form|breadcrumb|hero|banner)/.test(identity)) {
    score -= 220;
  }

  NOISY_TEXT_PATTERNS.forEach(function(pattern) {
    if (pattern.test(text)) {
      score -= 80;
    }
  });

  return score;
}

function pickMainContentNode($) {
  let bestNode = null;
  let bestScore = -1;

  MAIN_CONTENT_SELECTORS.forEach(function(selector) {
    $(selector).each(function() {
      const candidateScore = scoreContentCandidate($, this);

      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestNode = this;
      }
    });
  });

  if (bestNode) {
    return $(bestNode);
  }

  $('section, div').each(function() {
    const candidateScore = scoreContentCandidate($, this);

    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestNode = this;
    }
  });

  return bestNode ? $(bestNode) : $('body');
}

function cleanExtractedText(text) {
  let cleanedText = normalizeWhitespace(text);

  STRIP_TEXT_PATTERNS.forEach(function(pattern) {
    cleanedText = cleanedText.replace(pattern, ' ');
  });

  cleanedText = cleanedText
    .replace(/\b(read more|learn more)\b/gi, ' ')
    .replace(/\b(home)\b\s+(?=[a-z])/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedText;
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function trimContactNoise(text) {
  return normalizeWhitespace(text)
    .replace(/quick links[\s\S]*$/i, ' ')
    .replace(/contact us how can we help you today\?[\s\S]*$/i, ' ')
    .replace(/get in touch submit now[\s\S]*$/i, ' ')
    .replace(/copyright\s+\d{4}[\s\S]*$/i, ' ')
    .replace(/all rights reserved\.?[\s\S]*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractContactSnippet(html) {
  const $ = cheerio.load(html);
  const fullText = normalizeWhitespace($('body').text());
  const candidateTexts = [];
  const addressKeywordPattern = /address|india|indore|madhya pradesh|bus stand|road|street|avenue|corporate|suite|office/i;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phonePattern = /\+?\d[\d\s().-]{7,}\d/g;

  CONTACT_SECTION_SELECTORS.forEach(function(selector) {
    $(selector).each(function() {
      const candidateText = trimContactNoise($(this).text());

      if (!candidateText) {
        return;
      }

      if ((emailPattern.test(candidateText) || phonePattern.test(candidateText) || addressKeywordPattern.test(candidateText)) && candidateText.length <= 500) {
        candidateTexts.push(candidateText);
      }

      emailPattern.lastIndex = 0;
      phonePattern.lastIndex = 0;
    });
  });

  const emails = uniqueValues(fullText.match(emailPattern) || []);
  const phones = uniqueValues(
    (fullText.match(phonePattern) || []).map(function(phone) {
      return normalizeWhitespace(phone);
    }).filter(function(phone) {
      return phone.replace(/\D/g, '').length >= 10;
    })
  );
  const addressCandidate = candidateTexts.find(function(candidateText) {
    return addressKeywordPattern.test(candidateText);
  }) || '';
  const contactParts = [];

  if (addressCandidate) {
    contactParts.push(`Address ${addressCandidate}`);
  }

  if (emails.length > 0) {
    contactParts.push(`Email ${emails.join(', ')}`);
  }

  if (phones.length > 0) {
    contactParts.push(`Phone ${phones.join(', ')}`);
  }

  return normalizeWhitespace(contactParts.join(' '));
}

function createContentHash(text) {
  return crypto.createHash('sha1').update(String(text || '')).digest('hex');
}

function extractPageContent(html, pageUrl) {
  const contactSnippet = pageUrl ? extractContactSnippet(html) : '';
  const $ = cheerio.load(html);

  removeBoilerplateElements($);

  const mainContentNode = pickMainContentNode($);
  const title = normalizeWhitespace($('title').first().text()) || pageUrl;
  const text = cleanExtractedText(mainContentNode.text() || $('body').text());

  return {
    title,
    text,
    contactSnippet
  };
}

async function configurePage(page, timeoutMs) {
  await page.setUserAgent(DEFAULT_USER_AGENT);
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9'
  });
  page.setDefaultNavigationTimeout(timeoutMs);
  page.setDefaultTimeout(timeoutMs);
  await page.setRequestInterception(true);

  page.on('request', function(request) {
    const resourceType = request.resourceType();

    if (['image', 'media', 'font'].includes(resourceType)) {
      request.abort();
      return;
    }

    request.continue();
  });
}

async function crawlSinglePage(browser, url, settings) {
  let page;

  try {
    page = await browser.newPage();
    await configurePage(page, settings.timeoutMs);

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: settings.timeoutMs
    });

    await page.waitForSelector('body', {
      timeout: Math.min(settings.timeoutMs, 5000)
    }).catch(function() {
      return null;
    });

    const finalUrl = normalizeUrl(page.url());

    if (!finalUrl || !isSameDomain(finalUrl, settings.rootUrl)) {
      return {
        status: 'skipped',
        reason: 'redirected-outside-domain',
        source: url,
        discoveredLinks: []
      };
    }

    if (shouldSkipByExtension(finalUrl) || !isLikelyHtmlResponse(response)) {
      return {
        status: 'skipped',
        reason: 'non-html-response',
        source: finalUrl,
        discoveredLinks: []
      };
    }

    const html = await page.content();
    const pageData = extractPageContent(html, finalUrl);
    const discoveredLinks = await page.$$eval('a[href]', function(anchors) {
      return anchors
        .map(function(anchor) {
          return anchor.href;
        })
        .filter(Boolean);
    });

    return {
      status: 'success',
      source: finalUrl,
      discoveredLinks,
      record: {
        source: finalUrl,
        title: pageData.title,
        text: finalUrl === settings.rootUrl && pageData.contactSnippet
          ? `${pageData.text} Contact Information ${pageData.contactSnippet}`
          : pageData.text,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      status: 'failed',
      source: url,
      discoveredLinks: [],
      error
    };
  } finally {
    if (page) {
      await page.close().catch(function() {
        return null;
      });
    }
  }
}

async function crawlPageWithRetries(browser, url, settings) {
  let attempt = 0;
  let lastResult = null;

  while (attempt <= settings.retryCount) {
    console.log(`[crawler] crawling ${url} (attempt ${attempt + 1}/${settings.retryCount + 1})`);
    lastResult = await crawlSinglePage(browser, url, settings);

    if (lastResult.status !== 'failed') {
      return lastResult;
    }

    console.error(`[crawler] failed ${url}: ${lastResult.error.message}`);
    attempt += 1;
  }

  return lastResult;
}

function normalizeOutputPath(outputFile) {
  if (!outputFile) {
    return path.resolve(process.cwd(), DEFAULT_OUTPUT_FILE);
  }

  if (path.isAbsolute(outputFile)) {
    return outputFile;
  }

  return path.resolve(process.cwd(), outputFile);
}

function buildSettings(startUrl, options) {
  const rootUrl = normalizeUrl(startUrl);

  if (!rootUrl) {
    throw new Error('A valid http or https start URL is required.');
  }

  if (shouldSkipByExtension(rootUrl)) {
    throw new Error('Start URL must point to an HTML page, not a file asset.');
  }

  return {
    rootUrl,
    concurrency: toPositiveInteger(options.concurrency, DEFAULT_CONCURRENCY),
    maxPages: toPositiveInteger(options.maxPages, DEFAULT_MAX_PAGES),
    timeoutMs: toPositiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS),
    retryCount: toNonNegativeInteger(options.retryCount, DEFAULT_RETRY_COUNT),
    headless: options.headless !== false,
    outputFile: normalizeOutputPath(options.outputFile)
  };
}

async function writeKnowledgeBase(outputFile, records) {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(records, null, 2), 'utf8');
}

async function crawlWebsiteToKnowledgeBase(startUrl, options) {
  const settings = buildSettings(startUrl, options || {});
  const queuedUrls = new Set([settings.rootUrl]);
  const visitedUrls = new Set();
  const storedUrls = new Set();
  const storedContentHashes = new Set();
  const knowledgeBase = [];
  const failedPages = [];
  let currentLevel = [settings.rootUrl];
  let browser;

  console.log(`[crawler] starting crawl for ${settings.rootUrl}`);

  try {
    browser = await puppeteer.launch(await resolveBrowserLaunchOptions(settings.headless));

    while (currentLevel.length > 0 && visitedUrls.size < settings.maxPages) {
      const nextLevel = [];

      for (let index = 0; index < currentLevel.length && visitedUrls.size < settings.maxPages; index += settings.concurrency) {
        const batch = currentLevel
          .slice(index, index + settings.concurrency)
          .filter(function(url) {
            return !visitedUrls.has(url);
          })
          .slice(0, settings.maxPages - visitedUrls.size);

        batch.forEach(function(url) {
          visitedUrls.add(url);
        });

        const batchResults = await Promise.all(
          batch.map(function(url) {
            return crawlPageWithRetries(browser, url, settings);
          })
        );

        batchResults.forEach(function(result) {
          const canonicalSource = normalizeUrl(result.source) || result.source;

          if (result.status === 'success' && result.record && result.record.text && !storedUrls.has(canonicalSource)) {
            const contentHash = createContentHash(result.record.text);

            if (storedContentHashes.has(contentHash)) {
              console.log(`[crawler] skipped duplicate content ${canonicalSource}`);
              return;
            }

            result.record.source = canonicalSource;
            knowledgeBase.push(result.record);
            storedUrls.add(canonicalSource);
            storedContentHashes.add(contentHash);
            queuedUrls.add(canonicalSource);
            console.log(`[crawler] saved ${canonicalSource}`);
          } else if (result.status === 'failed') {
            failedPages.push({
              source: canonicalSource,
              error: result.error.message,
              timestamp: new Date().toISOString()
            });
          } else {
            console.log(`[crawler] skipped ${canonicalSource}: ${result.reason}`);
          }

          (result.discoveredLinks || []).forEach(function(link) {
            const normalizedLink = normalizeUrl(link, canonicalSource);

            if (!normalizedLink) {
              return;
            }

            if (!isSameDomain(normalizedLink, settings.rootUrl) || shouldSkipByExtension(normalizedLink)) {
              return;
            }

            if (queuedUrls.has(normalizedLink) || visitedUrls.has(normalizedLink) || queuedUrls.size >= settings.maxPages) {
              return;
            }

            queuedUrls.add(normalizedLink);
            nextLevel.push(normalizedLink);
          });
        });
      }

      currentLevel = nextLevel;
    }

    await writeKnowledgeBase(settings.outputFile, knowledgeBase);
    console.log(`[crawler] finished: ${knowledgeBase.length} pages saved to ${settings.outputFile}`);

    return {
      startUrl: settings.rootUrl,
      pageCount: knowledgeBase.length,
      failedCount: failedPages.length,
      outputFile: settings.outputFile,
      knowledgeBase,
      failedPages
    };
  } finally {
    if (browser) {
      await browser.close().catch(function() {
        return null;
      });
    }
  }
}

module.exports = {
  crawlWebsiteToKnowledgeBase
};