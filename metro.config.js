const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Push '.mjs' and '.cjs' extensions to resolve Firebase SDK modular subpaths correctly
config.resolver.sourceExts = Array.from(new Set([...config.resolver.sourceExts, 'mjs', 'cjs']));

// Ignore Android native Gradle build outputs from Metro file watcher
const extraBlockList = [
  /[/\\]node_modules[/\\]expo-modules-autolinking[/\\]android[/\\]/,
  /[/\\]android[/\\]app[/\\]build[/\\]/,
  /[/\\]android[/\\]build[/\\]/,
];

const existingBlockList = config.resolver.blockList;
if (Array.isArray(existingBlockList)) {
  config.resolver.blockList = [...existingBlockList, ...extraBlockList];
} else if (existingBlockList) {
  config.resolver.blockList = [existingBlockList, ...extraBlockList];
} else {
  config.resolver.blockList = extraBlockList;
}

module.exports = config;

