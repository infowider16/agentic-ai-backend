const { crawlWebsiteToKnowledgeBase } = require('../services/websiteCrawlerService');

async function main() {
  const startUrl = process.argv[2];
  const maxPages = process.argv[3] ? Number(process.argv[3]) : undefined;

  if (!startUrl) {
    console.error('Usage: node scripts/crawl-website.js <startUrl> [maxPages]');
    process.exit(1);
  }

  try {
    const result = await crawlWebsiteToKnowledgeBase(startUrl, {
      maxPages
    });

    console.log(JSON.stringify({
      pageCount: result.pageCount,
      failedCount: result.failedCount,
      outputFile: result.outputFile
    }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();