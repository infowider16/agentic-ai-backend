const jwt = require('jsonwebtoken');

/**
 * Sign a JWT token with the given payload and secret
 */
function signUserToken(payload, secret, options = {}) {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: options.expiresIn || '10m', // default 10 minutes
    ...options
  });
}

/**
 * Verify a JWT token and return the decoded payload
 */
function verifyUserToken(token, secret) {
  try {
    const version = require('jsonwebtoken/package.json').version;
    console.log('jsonwebtoken version:', version);
    const trimmedToken = typeof token === 'string' ? token.trim() : token;
    return jwt.verify(trimmedToken, secret, { algorithms: ['HS256'] });
  } catch (err) {
    console.error('JWT verify error:', err);
    return null;
  }
}

module.exports = {
  signUserToken,
  verifyUserToken
};
