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
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (err) {
    return null;
  }
}

module.exports = {
  signUserToken,
  verifyUserToken
};
