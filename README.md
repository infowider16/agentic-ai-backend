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

## Secure User Identity Integration (AI Chat Widget)

### 1. Backend: Per-Tenant Secret Key
- Each agent (tenant) must have a unique `client_secret_key` in the database.
- Never expose this key to the frontend.

### 2. Host Backend: JWT Generation
- Host backend generates a JWT for the logged-in user:

```js
const jwt = require('jsonwebtoken');
const payload = {
  user_id: 'unique_id_123',
  user_name: 'Anish',
  user_email: 'user@example.com',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000)
};
const token = jwt.sign(payload, CLIENT_SECRET_KEY, { algorithm: 'HS256', expiresIn: '10m' });
```

### 3. Widget Snippet (Frontend)
Embed this in your site:
```html
<script>
  window.AI_Widget_Config = {
    agentId: "YOUR_AGENT_ID",
    token: "GENERATED_JWT_TOKEN_FROM_BACKEND"
  };
</script>
<script src="https://cdn.your-saas.com/widget.js" async></script>
```

### 4. Chat API (Backend)
- The widget sends the token with each chat request.
- The backend verifies the token using the agent's `client_secret_key`.
- If valid, user context is injected into the AI prompt.
- If missing/invalid, AI operates in Guest User mode.

### 5. Security
- Always use HTTPS.
- Use short-lived tokens (e.g., 10 minutes).
- Never expose secret keys to the frontend.

### 6. Testing
- Log in as a user, open the widget, and send a message. AI should greet you by name/role.
- Log out or use incognito (no token): AI should treat you as Guest User.
- Tamper with the token: Backend should reject and fallback to Guest mode.