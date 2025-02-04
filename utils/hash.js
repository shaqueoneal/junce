const crypto = require('crypto');

function generateMD5(text) {
    if (!text) return null;
    return crypto.createHash('md5').update(text).digest('hex');
}

module.exports = { generateMD5 };