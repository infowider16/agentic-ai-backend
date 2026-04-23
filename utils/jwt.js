// Utility to generate JWT for widget integration (for host backend)
const jwt = require('jsonwebtoken');

function generateUserToken(user, clientSecretKey) {
  // user: { user_id, user_name, user_email, role }
  // clientSecretKey: string
  const payload = {
    user_id: user.user_id,
    user_name: user.user_name,
    user_email: user.user_email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000)
  };
  return jwt.sign(payload, clientSecretKey, { algorithm: 'HS256', expiresIn: '15m' });
}

module.exports = { generateUserToken };