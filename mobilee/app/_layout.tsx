// mobile/app/_layout.tsx
/**
 * Root layout — самый верхний файл приложения.
 * 1. Загружаем шрифты
 * 2. Инициализируем auth state
 * 3. Синкаем exercise library при первом входе
 * 4. Редиректим: onboarding → (tabs) | (auth)
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import {
  Outfit_700Bold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';

import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { useAuthStore }         from '../store/authStore';
import { syncExerciseLibrary }  from '../services/exerciseSync';
import { Colors }               from '../constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isLoggedIn, isLoading, user, init } = useAuthStore();
  const router   = useRouter();
  const segments = useSegments();

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Outfit_700Bold,
    Outfit_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  // Инициализируем auth при старте
  useEffect(() => {
    init();
  }, []);

  // Скрываем splash когда шрифты + auth готовы
  useEffect(() => {
    if ((fontsLoaded || fontError) && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  // Синкаем exercise library при логине
  useEffect(() => {
    if (isLoggedIn) {
      syncExerciseLibrary().catch(() => {});
    }
  }, [isLoggedIn]);

  // ── Auth guard ─────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;

    const seg0 = segments[0] as string | undefined;
    const inAuthGroup  = seg0 === '(auth)';
    const inOnboarding = seg0 === 'onboarding';

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn) {
      if (inAuthGroup || inOnboarding) {
        // Новый юзер — показываем онбординг
        if (user && !user.onboarding_done) {
          router.replace('/onboarding' as any);
        } else {
          router.replace('/(tabs)');
        }
      }
    }
  }, [isLoggedIn, isLoading, user, segments]);

  if (!fontsLoaded && !fontError) return null;
  if (isLoading) return null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.s1 }}>
      <StatusBar style="light" backgroundColor={Colors.s1}/>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"      options={{ animation: 'fade' }}/>
        <Stack.Screen name="(tabs)"      options={{ animation: 'fade' }}/>
        <Stack.Screen name="onboarding"  options={{ animation: 'fade', gestureEnabled: false }}/>
        <Stack.Screen name="history"     options={{ animation: 'slide_from_right' }}/>
        <Stack.Screen name="profile"     options={{ animation: 'slide_from_right' }}/>
      </Stack>
    </View>
  );
}
