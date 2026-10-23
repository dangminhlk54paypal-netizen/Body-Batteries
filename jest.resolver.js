// Reanimated 4.7.1 (Expo SDK 58) crashes on import under Jest: its
// initializers.native.ts calls setCSSEventHandler, which the JS-only module
// Jest runs on throws for. Resolve just that one file to the plain
// initializers.ts (no native-only setup) and leave everything else untouched.
module.exports = (request, options) => {
  const { defaultResolver } = options;
  if (request === './initializers' && options.basedir.includes('react-native-reanimated')) {
    options = { ...options, extensions: options.extensions?.filter((ext) => !ext.includes('native')) };
  }
  return defaultResolver(request, options);
};
