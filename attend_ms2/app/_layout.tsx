import { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Text, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import CustomSplashScreen from '@/components/CustomSplashScreen';
import CustomLoader from '@/components/CustomLoader';

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { AttendanceContext } from '@/hooks/use-attendance-store';
import colors from '@/constants/colors';
import OfflineBanner from '@/components/OfflineBanner';
import { apiService } from '@/lib/api';
import { secureStorage } from '@/lib/secure-storage';

SplashScreen.preventAutoHideAsync();

// Suppress noisy deprecation warning until we migrate to ImagePicker.MediaType in our SDK
try {
  LogBox.ignoreLogs([
    '[expo-image-picker] `ImagePicker.MediaTypeOptions` have been deprecated',
  ]);
} catch { }

function AuthNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inTabs = segments[0] === '(tabs)';
    const onLoginPage = segments[0] === 'login';

    if (isAuthenticated && onLoginPage) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !onLoginPage) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Handle Splash Screen Visibility
  const [isSplashAnimationFinished, setIsSplashAnimationFinished] = useState(false);

  useEffect(() => {
    // Hide native splash screen immediately when component mounts
    // Our CustomSplashScreen will take over visually
    SplashScreen.hideAsync().catch(() => { });
  }, []);

  // While splash animation is running, we show it on top.
  // We prioritize showing the app 'background' (Stack) as soon as isLoading is false,
  // so the splash can fade out to reveal it.

  const showSplash = !isSplashAnimationFinished;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 
        Main App Content (Stack)
        Rendered only when loading is done (so generic loading spinner doesn't flash)
        If splash is still visible, this sits BEHIND it, ready to be revealed. 
      */}
      {!isLoading && (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" />
        </Stack>
      )}

      {/* Loading Fallback (if splash done but auth still loading - rare) */}
      {isLoading && isSplashAnimationFinished && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <CustomLoader size="large" color={colors.primary} />
        </View>
      )}

      {/* Custom Splash Overlay */}
      {showSplash && (
        <CustomSplashScreen
          onFinish={() => setIsSplashAnimationFinished(true)}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          ...MaterialIcons.font,
          ...MaterialCommunityIcons.font,
          ...FontAwesome5.font,
        });
        setFontsLoaded(true);
      } catch (e) {
        console.warn('Error loading fonts:', e);
        // Still set to true so app doesn't hang
        setFontsLoaded(true);
      }
    }
    loadFonts();

    // Global Error Handler for App Crashes
    const defaultErrorHandler = (global as any).ErrorUtils?.getGlobalHandler();
    if (defaultErrorHandler) {
      (global as any).ErrorUtils.setGlobalHandler(async (error: any, isFatal?: boolean) => {
        try {
          // Attempt to log the crash to the server
          const userData = await secureStorage.getUserData();
          if (userData?.companyCode && userData?.employeeNo) {
            await apiService.logClientError(
              userData.companyCode,
              userData.employeeNo,
              'app-crash',
              error?.message || 'Unknown fatal error',
              'fatal',
              {
                stack: error?.stack,
                isFatal: !!isFatal,
                deviceTime: new Date().toISOString(),
              }
            );
          }
        } catch (e) {
          console.error('Failed to log crash to server:', e);
        }

        // Call the original handler (shows RedBox in dev, or crashes in prod)
        defaultErrorHandler(error, isFatal);
      });
    }
  }, []);

  // Show loading while fonts are loading
  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
          <CustomLoader size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AuthProvider>
        <AttendanceContext>
          {/* Global offline status banner */}
          <OfflineBanner />
          <AuthNavigator />
        </AttendanceContext>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
