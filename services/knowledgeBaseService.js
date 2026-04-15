const fs = require('fs/promises');
const path = require('path');
const { crawlWebsiteToKnowledgeBase } = require('./websiteCrawlerService');
const { transformKnowledgeBaseFile } = require('../transform');

const KNOWLEDGE_BASE_ROOT_DIR = path.resolve(process.cwd(), 'knowledge-bases');

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function buildWebsiteFolderName(startUrl) {
  try {
    const hostname = new URL(startUrl).hostname.toLowerCase();
    const normalizedHostname = hostname.startsWith('www.') ? hostname.slice(4) : hostname;

    return normalizedHostname.replace(/[^a-z0-9]/g, '') || 'websiteknowledgebase';
  } catch (error) {
    return 'websiteknowledgebase';
  }
}

async function cleanupKnowledgeBaseDir(outputDir) {
  if (!outputDir) {
    return;
  }

  await fs.rm(outputDir, { recursive: true, force: true });
}

async function generateKnowledgeBaseForUrl(startUrl, options = {}) {
  const websiteFolderName = buildWebsiteFolderName(startUrl);
  const websiteOutputDir = path.join(KNOWLEDGE_BASE_ROOT_DIR, websiteFolderName);
  const rawKnowledgeBaseFile = path.join(websiteOutputDir, 'knowledge_base.json');
  const aiKnowledgeBaseFile = path.join(websiteOutputDir, 'ai_knowledge_base.json');

  try {
    const crawlResult = await crawlWebsiteToKnowledgeBase(startUrl, {
      concurrency: normalizeOptionalNumber(options.concurrency),
      maxPages: normalizeOptionalNumber(options.maxPages),
      retryCount: normalizeOptionalNumber(options.retryCount),
      timeoutMs: normalizeOptionalNumber(options.timeoutMs),
      outputFile: options.outputFile || rawKnowledgeBaseFile,
      headless: options.headless !== false
    });

    const transformedResult = await transformKnowledgeBaseFile({
      input: crawlResult.outputFile,
      output: aiKnowledgeBaseFile,
      minWords: normalizeOptionalNumber(options.chunkMin),
      maxWords: normalizeOptionalNumber(options.chunkMax),
      maxChunksPerPage: normalizeOptionalNumber(options.maxChunksPerPage)
    });

    const serializedKnowledgeBase = await fs.readFile(aiKnowledgeBaseFile, 'utf8');
    await fs.unlink(crawlResult.outputFile);

    if (options.cleanupOutputDir) {
      await cleanupKnowledgeBaseDir(websiteOutputDir);
    }

    return {
      startUrl: crawlResult.startUrl,
      pageCount: crawlResult.pageCount,
      failedCount: crawlResult.failedCount,
      failedPages: crawlResult.failedPages,
      outputFolder: websiteOutputDir,
      outputFolderName: websiteFolderName,
      aiKnowledgeBaseFile,
      chunkCount: transformedResult.totalChunks,
      processedPages: transformedResult.processedPages,
      rawKnowledgeBaseDeleted: true,
      knowledgeBase: serializedKnowledgeBase
    };
  } catch (error) {
    if (options.cleanupOutputDir) {
      await cleanupKnowledgeBaseDir(websiteOutputDir);
    }

    throw error;
  }
}

module.exports = {
  KNOWLEDGE_BASE_ROOT_DIR,
  normalizeOptionalNumber,
  buildWebsiteFolderName,
  cleanupKnowledgeBaseDir,
  generateKnowledgeBaseForUrl
};