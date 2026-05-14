/**
 * Test file to verify 3 fixes:
 * 1. Message length limit (>2000 chars = 400 error)
 * 2. Rate limiting (>20 requests/min = 429 error)
 * 3. Expired JWT token (bot treats as Guest User)
 *
 * Run: node test-fixes.js
 * Make sure server is running: node server.js
 */

const http = require('http');
const jwt = require('jsonwebtoken');

const HOST = 'localhost';
const PORT = 3000;
const AGENT_ID = 'AGENT_EF94371D';
const CLIENT_SECRET_KEY = '5ecdbb0a734a7e48a8a14585e63023a0b485f02b92febfe067e015ef6f72d2fb';

// ─── Helper ──────────────────────────────────────────────────────────────────

function postChat(body) {
  return new Promise(function(resolve, reject) {
    const data = JSON.stringify(body);
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, function(res) {
      let raw = '';
      res.on('data', function(chunk) { raw += chunk; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function pass(label) {
  console.log('  \x1b[32m✔ PASS\x1b[0m  ' + label);
}

function fail(label, detail) {
  console.log('  \x1b[31m✘ FAIL\x1b[0m  ' + label);
  if (detail) console.log('         Detail:', detail);
}

function section(title) {
  console.log('\n\x1b[36m━━ ' + title + ' ━━\x1b[0m');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testMessageLengthLimit() {
  section('Test 1: Message Length Limit (>2000 chars)');

  // Should FAIL (2001 chars)
  const longMessage = 'a'.repeat(2001);
  const res1 = await postChat({ agent_id: AGENT_ID, message: longMessage });
  if (res1.status === 400 && res1.body.error && res1.body.error.includes('too long')) {
    pass('2001-char message rejected with 400');
  } else {
    fail('2001-char message should return 400', 'Got status ' + res1.status + ' — ' + JSON.stringify(res1.body));
  }

  // Should PASS (exactly 2000 chars)
  const exactMessage = 'a'.repeat(2000);
  const res2 = await postChat({ agent_id: AGENT_ID, message: exactMessage });
  if (res2.status !== 400 || !res2.body.error || !res2.body.error.includes('too long')) {
    pass('2000-char message accepted (not rejected by length check)');
  } else {
    fail('2000-char message should NOT be rejected by length limit', JSON.stringify(res2.body));
  }

  // Should FAIL (empty message)
  const res3 = await postChat({ agent_id: AGENT_ID, message: '' });
  if (res3.status === 400) {
    pass('Empty message rejected with 400');
  } else {
    fail('Empty message should return 400', 'Got status ' + res3.status);
  }
}

async function testRateLimit() {
  section('Test 2: Rate Limiting (max 20 requests/minute)');

  console.log('  Sending 22 requests rapidly...');

  const requests = [];
  for (let i = 0; i < 22; i++) {
    requests.push(postChat({ agent_id: AGENT_ID, message: 'ping ' + i }));
  }

  const results = await Promise.all(requests);

  const statuses = results.map(function(r) { return r.status; });
  const has429 = statuses.includes(429);
  const count429 = statuses.filter(function(s) { return s === 429; }).length;
  const firstBlocked = statuses.indexOf(429) + 1;

  if (has429) {
    pass('Rate limit triggered — ' + count429 + ' request(s) blocked with 429 (first at request #' + firstBlocked + ')');
  } else {
    fail('Rate limit did NOT trigger after 22 rapid requests', 'All statuses: ' + statuses.join(', '));
  }

  // Check error message
  const blocked = results.find(function(r) { return r.status === 429; });
  if (blocked && blocked.body && blocked.body.error && blocked.body.error.includes('Too many')) {
    pass('429 response has correct error message: "' + blocked.body.error + '"');
  } else {
    fail('429 response missing expected error message', blocked ? JSON.stringify(blocked.body) : 'no blocked response found');
  }
}

async function testExpiredToken() {
  section('Test 3: Expired JWT Token (should be treated as Guest)');

  // Generate an already-expired token (expired 1 hour ago)
  const expiredToken = jwt.sign(
    { user_id: 'u1', user_name: 'TestUser', role: 'admin' },
    CLIENT_SECRET_KEY,
    { algorithm: 'HS256', expiresIn: -3600 } // negative = already expired
  );

  const res = await postChat({
    agent_id: AGENT_ID,
    message: 'what is my name?',
    token: expiredToken
  });

  if (res.status === 200 && res.body.reply) {
    // Check that the reply does NOT contain the user_name from token
    const replyLower = res.body.reply.toLowerCase();
    const mentionsTestUser = replyLower.includes('testuser') || replyLower.includes('test user');

    if (!mentionsTestUser) {
      pass('Expired token treated as Guest — bot did not reveal "TestUser" identity');
    } else {
      fail('Expired token was NOT rejected — bot revealed user identity from expired token', 'Reply: ' + res.body.reply.slice(0, 150));
    }
    pass('Server returned 200 (did not crash on expired token)');
  } else {
    fail('Unexpected response for expired token', 'Status: ' + res.status + ' — ' + JSON.stringify(res.body).slice(0, 200));
  }

  // Generate a valid token — bot should know the user
  const validToken = jwt.sign(
    { user_id: 'u2', user_name: 'AmanDubey001', role: 'admin' },
    CLIENT_SECRET_KEY,
    { algorithm: 'HS256', expiresIn: '10m' }
  );

  const res2 = await postChat({
    agent_id: AGENT_ID,
    message: 'what is my name?',
    token: validToken
  });

  if (res2.status === 200 && res2.body.reply) {
    const replyLower2 = res2.body.reply.toLowerCase();
    const mentionsAman = replyLower2.includes('amandubey') || replyLower2.includes('aman');
    if (mentionsAman) {
      pass('Valid token works — bot recognized "AmanDubey001"');
    } else {
      fail('Valid token sent but bot did not mention user name', 'Reply: ' + res2.body.reply.slice(0, 150));
    }
  } else {
    fail('Valid token request failed', 'Status: ' + res2.status);
  }
}

// ─── Run all tests ────────────────────────────────────────────────────────────

async function run() {
  console.log('\x1b[1m\nAgenticAI — Fix Verification Tests\x1b[0m');
  console.log('Server: http://' + HOST + ':' + PORT);
  console.log('Agent:  ' + AGENT_ID);

  try {
    await testMessageLengthLimit();
    await testExpiredToken();
    await testRateLimit();
  } catch (err) {
    console.error('\n\x1b[31mTest runner error:\x1b[0m', err.message);
    console.error('Make sure server is running: node server.js');
  }

  console.log('\n\x1b[1mDone.\x1b[0m\n');
}

run();
