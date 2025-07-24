// config/index.js - Configuration Loader
const path = require('path');
const fs = require('fs');

const defaultConfig = require('./default');
const env = process.env.NODE_ENV || 'development';
let envConfig = {};

if (env === 'production' && fs.existsSync(path.join(__dirname, 'production.js'))) {
  envConfig = require('./production');
} else if (env === 'test' && fs.existsSync(path.join(__dirname, 'test.js'))) {
  envConfig = require('./test');
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

module.exports = deepMerge(defaultConfig, envConfig); 