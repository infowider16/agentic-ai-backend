const jwt = require('jsonwebtoken');
const CLIENT_SECRET_KEY = '5ecdbb0a734a7e48a8a14585e63023a0b485f02b92febfe067e015ef6f72d2fb';


const payload = {
  user_id: 'am00123',
  user_name: 'Aman Dubey',
  user_email: 'aman.dubey001@example.com',
  role: 'subscriber',
  plan_amount: '$189.99/month',
  subscription_plan: 'professional',
  plan_start_date: '01-06-2026',
  plan_end_date: '01-07-2026',
  saved_aircraft: [
    { manufacturer: 'Gulfstream', model: 'G650' },
    { manufacturer: 'Cessna', model: 'Citation XLS' }
  ],
  iat: Math.floor(Date.now() / 1000)
};

const token = jwt.sign(payload, CLIENT_SECRET_KEY, { algorithm: 'HS256', expiresIn: '24h' });
console.log(token);