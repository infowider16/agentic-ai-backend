# agentic-ai-backend

## Website Knowledge Base Crawler

This backend now includes a reusable crawler service that renders pages with Puppeteer, extracts clean text with Cheerio, and writes all crawled pages into a single `knowledge_base.json` file.

### Install dependencies

```bash
npm install
```

If you only want the crawler packages in another environment:

```bash
npm install puppeteer cheerio
```

### Direct service usage

```js
const { crawlWebsiteToKnowledgeBase } = require('./services/websiteCrawlerService');

async function run() {
	const result = await crawlWebsiteToKnowledgeBase('https://example.com', {
		concurrency: 3,
		maxPages: 25,
		retryCount: 2,
		timeoutMs: 30000,
		outputFile: 'knowledge_base.json'
	});

	console.log(result.knowledgeBase);
}

run();
```

### CLI usage

```bash
npm run crawl:website -- https://example.com 25
```

### API usage

Start the server and call:

```bash
POST /api/knowledge-base/crawl
Content-Type: application/json

{
	"start_url": "https://example.com",
	"concurrency": 3,
	"max_pages": 25,
	"retry_count": 2,
	"timeout_ms": 30000,
	"output_file": "knowledge_base.json"
}
```

The response includes:

```json
{
	"startUrl": "https://example.com/",
	"pageCount": 10,
	"failedCount": 0,
	"outputFile": "C:\\path\\to\\project\\knowledge_base.json",
	"knowledgeBase": [
		{
			"source": "https://example.com/",
			"title": "Example Domain",
			"text": "Example Domain This domain is for use in illustrative examples in documents.",
			"timestamp": "2026-04-14T00:00:00.000Z"
		}
	],
	"failedPages": []
}
```