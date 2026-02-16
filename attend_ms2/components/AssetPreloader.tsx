import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';

interface AssetPreloaderProps {
  children: React.ReactNode;
}

export default function AssetPreloader({ children }: AssetPreloaderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResourcesAsync() {
      try {
        // Preload images
        const imageAssets = [
          require('../assets/images/icon.png'),
          require('../assets/images/adaptive-icon.png'),
          require('../assets/images/favicon.png'),
          require('../assets/images/splash-icon.png'),
          require('../assets/images/company-logo.png'),
        ];

        const cacheImages = imageAssets.map(image => {
          return Asset.fromModule(image).downloadAsync();
        });

        // Preload fonts (if any custom fonts are used)
        const cacheFonts = Font.loadAsync({
          // Add any custom fonts here if needed
        });

        await Promise.all([...cacheImages, cacheFonts]);
        setIsReady(true);
      } catch (e) {
        console.warn('Asset preloading failed:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
        // Continue anyway - assets might still work
        setIsReady(true);
      }
    }

    loadResourcesAsync();
  }, []);

  if (!isReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#ffffff'
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ 
          marginTop: 16, 
          fontSize: 16, 
          color: '#666',
          textAlign: 'center'
        }}>
          Loading assets...
        </Text>
        {error && (
          <Text style={{ 
            marginTop: 8, 
            fontSize: 12, 
            color: '#ff6b6b',
            textAlign: 'center',
            paddingHorizontal: 20
          }}>
            Warning: {error}
          </Text>
        )}
      </View>
    );
  }

  return <>{children}</>;
}
