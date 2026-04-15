const { generateKnowledgeBaseForUrl } = require('../services/knowledgeBaseService');

async function postKnowledgeBaseCrawl(req, res) {
  const startUrl = String(req.body.start_url || req.body.url || '').trim();

  if (!startUrl) {
    return res.status(400).json({ error: 'start_url is required' });
  }

  try {
    const result = await generateKnowledgeBaseForUrl(startUrl, {
      concurrency: req.body.concurrency,
      maxPages: req.body.max_pages,
      retryCount: req.body.retry_count,
      timeoutMs: req.body.timeout_ms,
      outputFile: req.body.output_file,
      headless: req.body.headless,
      chunkMin: req.body.chunk_min,
      chunkMax: req.body.chunk_max,
      maxChunksPerPage: req.body.max_chunks_per_page,
      cleanupOutputDir: false
    });

    return res.json({
      startUrl: result.startUrl,
      pageCount: result.pageCount,
      failedCount: result.failedCount,
      failedPages: result.failedPages,
      outputFolder: result.outputFolder,
      outputFolderName: result.outputFolderName,
      aiKnowledgeBaseFile: result.aiKnowledgeBaseFile,
      chunkCount: result.chunkCount,
      processedPages: result.processedPages,
      rawKnowledgeBaseDeleted: result.rawKnowledgeBaseDeleted
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