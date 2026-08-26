const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Push '.mjs' and '.cjs' extensions to resolve Firebase SDK modular subpaths correctly
config.resolver.sourceExts = Array.from(new Set([...config.resolver.sourceExts, 'mjs', 'cjs']));

module.exports = config;
