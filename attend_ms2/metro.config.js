// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Metro configuration
const config = getDefaultConfig(__dirname);

// Ensure asset extensions are properly configured
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'tiff',
  'ico'
];

// Add support for the assets directory with proper resolution
config.watchFolders = [
  path.resolve(__dirname, './assets'),
  path.resolve(__dirname, './assets/images')
];

// Asset transformer configuration
config.transformer = {
  ...config.transformer,
  assetPlugins: ['expo-asset/tools/hashAssetFiles'],
};

module.exports = config;
