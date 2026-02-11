import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useConnectivity } from '@/hooks/use-connectivity';
import colors from '@/constants/colors';

export default function OfflineBanner() {
  const show = String(process.env.EXPO_PUBLIC_SHOW_OFFLINE_BANNER || 'true').toLowerCase() !== 'false';
  const { online, checking } = useConnectivity({ intervalMs: 15000, timeoutMs: 6000 });

  if (!show) return null;
  if (online) return null;

  const message = checking
    ? 'Reconnecting… data will sync once connection is restored.'
    : 'Offline mode: Data will sync to the database once the connection is restored.';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={message}
      style={{
        width: '100%',
        backgroundColor: '#FFF3CD',
        borderBottomWidth: 1,
        borderBottomColor: '#FFECB5',
        paddingTop: Platform.select({ ios: 8, android: 8, default: 6 }),
        paddingBottom: Platform.select({ ios: 8, android: 8, default: 6 }),
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#D97706',
          marginRight: 8,
        }}
      />
      <Text
        style={{
          color: '#8A6D3B',
          fontSize: 13,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
