const jwt = require('jsonwebtoken');
const CLIENT_SECRET_KEY = '5ecdbb0a734a7e48a8a14585e63023a0b485f02b92febfe067e015ef6f72d2fb';


const payload = {
  user_id: 'am00123',
  user_name: 'AmanDubey001',
  user_email: 'aman.dubey001@example.com',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000)
};

const token = jwt.sign(payload, CLIENT_SECRET_KEY, { algorithm: 'HS256', expiresIn: '24h' });
console.log(token);