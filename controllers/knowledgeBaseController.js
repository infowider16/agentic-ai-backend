const fs = require('fs/promises');
const path = require('path');
const { crawlWebsiteToKnowledgeBase } = require('../services/websiteCrawlerService');
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
    const normalizedHostname = hostname.startsWith('www.') ? hostname : hostname;

    return normalizedHostname.replace(/[^a-z0-9]/g, '') || 'websiteknowledgebase';
  } catch (error) {
    return 'websiteknowledgebase';
  }
}

async function postKnowledgeBaseCrawl(req, res) {
  const startUrl = String(req.body.start_url || req.body.url || '').trim();

  if (!startUrl) {
    return res.status(400).json({ error: 'start_url is required' });
  }

  try {
    const websiteFolderName = buildWebsiteFolderName(startUrl);
    const websiteOutputDir = path.join(KNOWLEDGE_BASE_ROOT_DIR, websiteFolderName);
    const rawKnowledgeBaseFile = path.join(websiteOutputDir, 'knowledge_base.json');
    const aiKnowledgeBaseFile = path.join(websiteOutputDir, 'ai_knowledge_base.json');
    const result = await crawlWebsiteToKnowledgeBase(startUrl, {
      concurrency: normalizeOptionalNumber(req.body.concurrency),
      maxPages: normalizeOptionalNumber(req.body.max_pages),
      retryCount: normalizeOptionalNumber(req.body.retry_count),
      timeoutMs: normalizeOptionalNumber(req.body.timeout_ms),
      outputFile: req.body.output_file || rawKnowledgeBaseFile,
      headless: req.body.headless !== false
    });

    const transformedResult = await transformKnowledgeBaseFile({
      input: result.outputFile,
      output: aiKnowledgeBaseFile,
      minWords: normalizeOptionalNumber(req.body.chunk_min),
      maxWords: normalizeOptionalNumber(req.body.chunk_max),
      maxChunksPerPage: normalizeOptionalNumber(req.body.max_chunks_per_page)
    });

    await fs.unlink(result.outputFile);

    return res.json({
      startUrl: result.startUrl,
      pageCount: result.pageCount,
      failedCount: result.failedCount,
      failedPages: result.failedPages,
      outputFolder: websiteOutputDir,
      outputFolderName: websiteFolderName,
      aiKnowledgeBaseFile,
      chunkCount: transformedResult.totalChunks,
      processedPages: transformedResult.processedPages,
      rawKnowledgeBaseDeleted: true
    });
  } catch (error) {
    console.error('Knowledge base crawl error:', error.message);

    if (/valid http or https start url|html page/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'Crawler failed' });
  }
}

module.exports = {
  postKnowledgeBaseCrawl
};