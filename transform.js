const fs = require('fs/promises');
const path = require('path');
const slugify = require('slugify');
const nlp = require('compromise');
const keywordExtractor = require('keyword-extractor');
const { z } = require('zod');

const DEFAULT_INPUT_FILE = path.resolve(process.cwd(), 'knowledge_base.json');
const DEFAULT_OUTPUT_FILE = path.resolve(process.cwd(), 'ai_knowledge_base.json');
const DEFAULT_MIN_WORDS = 100;
const DEFAULT_MAX_WORDS = 150;
const DEFAULT_MAX_CHUNKS_PER_PAGE = Number(process.env.KB_MAX_CHUNKS_PER_PAGE || 0);
const DEFAULT_LANGUAGE = 'en';
const NOISE_PHRASES = [
  'explore more',
  'get started',
  'read more',
  'learn more',
  'submit now',
  'quick links',
  'contact us',
  'contact information',
  'all rights reserved'
];
const TITLE_STOP_WORDS = new Set(['page', 'home', 'services', 'service', 'about', 'the', 'and', 'for', 'with']);
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const RAW_PAGE_SCHEMA = z.object({
  source: z.string().min(1),
  title: z.string().optional().default(''),
  text: z.string().optional().default(''),
  timestamp: z.string().optional().default('')
});
const CHUNK_SCHEMA = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  metadata: z.object({
    source_url: z.string().url(),
    domain: z.string().min(1),
    page_title: z.string().min(1),
    section_title: z.string().min(1),
    content_type: z.string().min(1),
    language: z.string().min(2),
    keywords: z.array(z.string()).default([]),
    summary: z.string().min(1),
    timestamp: z.string().min(1),
    chunk_index: z.number().int().positive(),
    chunk_total: z.number().int().positive()
  })
});

function parseCliArgs(argv) {
  const options = {
    input: DEFAULT_INPUT_FILE,
    output: DEFAULT_OUTPUT_FILE,
    minWords: DEFAULT_MIN_WORDS,
    maxWords: DEFAULT_MAX_WORDS,
    maxChunksPerPage: DEFAULT_MAX_CHUNKS_PER_PAGE
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === '--input' && nextValue) {
      options.input = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === '--output' && nextValue) {
      options.output = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (argument === '--chunk-min' && nextValue) {
      options.minWords = toPositiveInteger(nextValue, DEFAULT_MIN_WORDS);
      index += 1;
      continue;
    }

    if (argument === '--chunk-max' && nextValue) {
      options.maxWords = toPositiveInteger(nextValue, DEFAULT_MAX_WORDS);
      index += 1;
      continue;
    }

    if (argument === '--max-chunks-per-page' && nextValue) {
      options.maxChunksPerPage = toNonNegativeInteger(nextValue, DEFAULT_MAX_CHUNKS_PER_PAGE);
      index += 1;
    }
  }

  if (options.minWords > options.maxWords) {
    const previousMinWords = options.minWords;
    options.minWords = options.maxWords;
    options.maxWords = previousMinWords;
  }

  return options;
}

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

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeTitleRepetition(text, title) {
  const normalizedTitle = normalizeWhitespace(title);

  if (!normalizedTitle) {
    return text;
  }

  let nextText = normalizeWhitespace(text);
  const repeatedTitlePattern = new RegExp(`^(?:${escapeRegExp(normalizedTitle)}\\s+){1,3}`, 'i');
  nextText = nextText.replace(repeatedTitlePattern, '').trim();

  if (!nextText) {
    return normalizedTitle;
  }

  return nextText;
}

function removeNoise(text) {
  let nextText = normalizeWhitespace(text)
    .replace(EMAIL_PATTERN, ' ')
    .replace(PHONE_PATTERN, ' ')
    .replace(/\b(?:mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\b[^.]{0,40}/gi, ' ')
    .replace(/\(\s*\d{5,6}\s*\)/g, ' ')
    .replace(/\b(?:address|email|phone|contact info)\b:?/gi, ' ')
    .replace(/\b\d{2,5},\s*[^.]{0,160}\b(?:india|usa|uae|canada|uk|australia)\b\.?/gi, ' ')
    .replace(/\b(?:near|suite|office|floor)\b[^.]{0,120}/gi, ' ')
    .replace(/\b(?:mod-friday|mon-friday|working hours|business hours)\b[^.]{0,40}/gi, ' ');

  NOISE_PHRASES.forEach(function(phrase) {
    const phrasePattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    nextText = nextText.replace(phrasePattern, ' ');
  });

  return normalizeWhitespace(nextText);
}

function splitIntoSentences(text) {
  const normalizedText = normalizeWhitespace(text);

  if (!normalizedText) {
    return [];
  }

  const sentences = nlp(normalizedText).sentences().out('array');

  if (Array.isArray(sentences) && sentences.length > 0) {
    return sentences.map(normalizeWhitespace).filter(Boolean);
  }

  return normalizedText
    .split(/(?<=[.!?])\s+/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function dedupeSentences(sentences, title) {
  const normalizedTitle = normalizeWhitespace(title).toLowerCase();
  const seen = new Set();

  return sentences.filter(function(sentence) {
    const normalizedSentence = normalizeWhitespace(sentence).toLowerCase();

    if (!normalizedSentence) {
      return false;
    }

    if (normalizedTitle && normalizedSentence === normalizedTitle) {
      return false;
    }

    if (normalizedSentence.length < 3) {
      return false;
    }

    if (seen.has(normalizedSentence)) {
      return false;
    }

    seen.add(normalizedSentence);
    return true;
  });
}

function splitLongSentence(sentence, maxWords) {
  const words = normalizeWhitespace(sentence).split(' ').filter(Boolean);

  if (words.length <= maxWords) {
    return [normalizeWhitespace(sentence)];
  }

  const segments = [];

  for (let index = 0; index < words.length; index += maxWords) {
    segments.push(words.slice(index, index + maxWords).join(' '));
  }

  return segments;
}

function countWords(text) {
  return normalizeWhitespace(text).split(' ').filter(Boolean).length;
}

function chunkSentences(sentences, minWords, maxWords) {
  const expandedSentences = sentences.flatMap(function(sentence) {
    return splitLongSentence(sentence, maxWords);
  });
  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  expandedSentences.forEach(function(sentence) {
    const sentenceWordCount = countWords(sentence);
    const wouldExceedLimit = currentWordCount + sentenceWordCount > maxWords;

    if (wouldExceedLimit && currentWordCount >= minWords) {
      chunks.push(currentChunk.join(' ').trim());
      currentChunk = [sentence];
      currentWordCount = sentenceWordCount;
      return;
    }

    if (wouldExceedLimit && currentWordCount > 0) {
      chunks.push(currentChunk.join(' ').trim());
      currentChunk = [sentence];
      currentWordCount = sentenceWordCount;
      return;
    }

    currentChunk.push(sentence);
    currentWordCount += sentenceWordCount;
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' ').trim());
  }

  if (chunks.length > 1) {
    const lastChunk = chunks[chunks.length - 1];
    const secondLastChunk = chunks[chunks.length - 2];

    if (countWords(lastChunk) < Math.max(40, Math.floor(minWords * 0.5)) && countWords(secondLastChunk) + countWords(lastChunk) <= maxWords) {
      chunks.splice(chunks.length - 2, 2, `${secondLastChunk} ${lastChunk}`.trim());
    }
  }

  return chunks.filter(Boolean);
}

function inferContentType(urlString) {
  let pathname = '';

  try {
    pathname = new URL(urlString).pathname.toLowerCase();
  } catch (error) {
    return 'general_page';
  }

  if (pathname === '/' || pathname === '') {
    return 'homepage';
  }

  if (pathname.includes('/services/')) {
    return 'service_page';
  }

  if (pathname === '/service.php' || pathname.includes('/service')) {
    return 'service_page';
  }

  if (pathname.includes('about')) {
    return 'about_page';
  }

  if (pathname.includes('blog') || pathname.includes('news') || pathname.includes('article')) {
    return 'blog_page';
  }

  if (pathname.includes('contact')) {
    return 'contact_page';
  }

  return 'general_page';
}

function extractDomain(urlString) {
  try {
    return new URL(urlString).hostname;
  } catch (error) {
    return 'unknown-domain';
  }
}

function buildSummary(content) {
  const sentences = splitIntoSentences(content);

  return normalizeWhitespace(sentences.slice(0, 2).join(' ')) || normalizeWhitespace(content).slice(0, 220);
}

function buildKeywords(content) {
  return keywordExtractor.extract(content, {
    language: DEFAULT_LANGUAGE,
    remove_digits: true,
    return_changed_case: true,
    remove_duplicates: true
  }).slice(0, 10);
}

function buildSectionTitle(chunkIndex) {
  return chunkIndex === 1 ? 'Overview' : `Section ${chunkIndex}`;
}

function buildChunkId(pageTitle, chunkIndex, usedIds) {
  const baseSlug = slugify(normalizeWhitespace(pageTitle) || 'untitled-page', {
    lower: true,
    strict: true,
    trim: true
  }) || 'untitled-page';
  let candidateId = `${baseSlug}-${String(chunkIndex).padStart(3, '0')}`;
  let suffix = 2;

  while (usedIds.has(candidateId)) {
    candidateId = `${baseSlug}-${String(chunkIndex).padStart(3, '0')}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidateId);
  return candidateId;
}

function inferTitleFromUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const pathname = url.pathname;

    if (!pathname || pathname === '/') {
      return 'Home';
    }

    const lastSegment = pathname.split('/').filter(Boolean).pop() || 'page';

    return lastSegment
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return 'Untitled Page';
  }
}

function tokenizeTitle(value) {
  return slugify(normalizeWhitespace(value), {
    lower: true,
    strict: true,
    trim: true
  }).split('-').filter(function(token) {
    return token && !TITLE_STOP_WORDS.has(token);
  });
}

function shouldUseUrlDerivedTitle(pageTitle, sourceUrl) {
  let pathname = '/';

  try {
    pathname = new URL(sourceUrl).pathname;
  } catch (error) {
    return false;
  }

  if (!pathname || pathname === '/') {
    return false;
  }

  const titleTokens = tokenizeTitle(pageTitle);
  const urlTitleTokens = tokenizeTitle(inferTitleFromUrl(sourceUrl));

  if (titleTokens.length === 0) {
    return true;
  }

  return !urlTitleTokens.some(function(token) {
    return titleTokens.includes(token);
  });
}

function sanitizePageTitle(pageTitle, sourceUrl) {
  const normalizedTitle = normalizeWhitespace(pageTitle);

  if (normalizedTitle && !shouldUseUrlDerivedTitle(normalizedTitle, sourceUrl)) {
    return normalizedTitle;
  }

  const fallbackTitle = normalizeWhitespace(inferTitleFromUrl(sourceUrl));

  if (fallbackTitle) {
    return fallbackTitle.replace(/\b\w/g, function(match) {
      return match.toUpperCase();
    });
  }

  return 'Untitled Page';
}

function transformPage(page, options, usedIds) {
  const parsedPage = RAW_PAGE_SCHEMA.safeParse(page);

  if (!parsedPage.success) {
    return [];
  }

  const sourceUrl = parsedPage.data.source;
  const pageTitle = sanitizePageTitle(parsedPage.data.title, sourceUrl);
  const cleanedText = removeNoise(removeTitleRepetition(parsedPage.data.text, pageTitle));

  if (!cleanedText) {
    return [];
  }

  const sentences = dedupeSentences(splitIntoSentences(cleanedText), pageTitle);

  if (sentences.length === 0) {
    return [];
  }

  let chunks = chunkSentences(sentences, options.minWords, options.maxWords).map(function(chunk) {
    return normalizeWhitespace(chunk);
  }).filter(Boolean);

  if (options.maxChunksPerPage > 0) {
    chunks = chunks.slice(0, options.maxChunksPerPage);
  }

  const domain = extractDomain(sourceUrl);
  const contentType = inferContentType(sourceUrl);
  const chunkTotal = chunks.length;

  return chunks.map(function(chunk, index) {
    const chunkIndex = index + 1;
    const output = {
      id: buildChunkId(pageTitle, chunkIndex, usedIds),
      content: normalizeWhitespace(chunk),
      metadata: {
        source_url: sourceUrl,
        domain,
        page_title: pageTitle,
        section_title: buildSectionTitle(chunkIndex),
        content_type: contentType,
        language: DEFAULT_LANGUAGE,
        keywords: buildKeywords(chunk),
        summary: buildSummary(chunk),
        timestamp: parsedPage.data.timestamp || new Date().toISOString(),
        chunk_index: chunkIndex,
        chunk_total: chunkTotal
      }
    };
    const validationResult = CHUNK_SCHEMA.safeParse(output);

    return validationResult.success ? validationResult.data : null;
  }).filter(Boolean);
}

async function readInputFile(filePath) {
  const fileContent = await fs.readFile(filePath, 'utf8');
  const parsedContent = JSON.parse(fileContent);

  if (!Array.isArray(parsedContent)) {
    throw new Error('Input file must contain a JSON array of scraped page objects.');
  }

  return parsedContent;
}

async function writeOutputFile(filePath, records) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf8');
}

async function transformKnowledgeBaseFile(options) {
  const normalizedOptions = {
    input: options && options.input ? path.resolve(options.input) : DEFAULT_INPUT_FILE,
    output: options && options.output ? path.resolve(options.output) : DEFAULT_OUTPUT_FILE,
    minWords: toPositiveInteger(options && options.minWords, DEFAULT_MIN_WORDS),
    maxWords: toPositiveInteger(options && options.maxWords, DEFAULT_MAX_WORDS),
    maxChunksPerPage: toNonNegativeInteger(options && options.maxChunksPerPage, DEFAULT_MAX_CHUNKS_PER_PAGE)
  };
  const usedIds = new Set();
  const rawPages = await readInputFile(normalizedOptions.input);
  let processedPages = 0;
  let totalChunks = 0;
  const transformedRecords = [];

  rawPages.forEach(function(page) {
    const pageChunks = transformPage(page, normalizedOptions, usedIds);

    if (pageChunks.length === 0) {
      return;
    }

    processedPages += 1;
    totalChunks += pageChunks.length;
    transformedRecords.push(...pageChunks);
  });

  await writeOutputFile(normalizedOptions.output, transformedRecords);

  return {
    inputFile: normalizedOptions.input,
    outputFile: normalizedOptions.output,
    processedPages,
    totalPages: rawPages.length,
    totalChunks,
    records: transformedRecords
  };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const result = await transformKnowledgeBaseFile(options);

  console.log(`[transform] pages processed: ${result.processedPages}/${result.totalPages}`);
  console.log(`[transform] chunks created: ${result.totalChunks}`);
  console.log(`[transform] output written to: ${result.outputFile}`);
}

if (require.main === module) {
  main().catch(function(error) {
    console.error(`[transform] failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  transformPage,
  parseCliArgs,
  transformKnowledgeBaseFile
};