// verify-token-debug.js
const jwt = require('jsonwebtoken');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYW0wMDEyMyIsInVzZXJfbmFtZSI6IkFtYW5EdWJleTAwMSIsInVzZXJfZW1haWwiOiJhbWFuLmR1YmV5MDAxQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc2OTQ4NjYzLCJleHAiOjE3NzY5NDkyNjN9.qsdbbQdJ72KP1kvAbyKmrILvaZMdnvwACRVCPybMC60';
const secret = '5ecdbb0a734a7e48a8a14585e63023a0b485f02b92febfe067e015ef6f72d2fb';

try {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  console.log('Decoded:', decoded);
} catch (e) {
  console.error('JWT verify error:', e);
}