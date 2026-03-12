// mobile/app/_layout.tsx
/**
 * Root layout — самый верхний файл приложения.
 * Здесь:
 * 1. Загружаем шрифты
 * 2. Инициализируем auth state
 * 3. Редиректим на (auth) или (tabs) в зависимости от isLoggedIn
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

import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/theme';

// Не скрываем splash пока не загрузимся
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isLoggedIn, isLoading, init } = useAuthStore();
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

  // Скрываем splash когда шрифты загружены и auth проверен
  useEffect(() => {
    if ((fontsLoaded || fontError) && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  // ── Auth guard ───────────────────────────────────────────────
  // Следим за изменением isLoggedIn и редиректим
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isLoggedIn && !inAuthGroup) {
      // Не авторизован — на логин
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      // Авторизован — в приложение
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, isLoading, segments]);

  // Ждём загрузки шрифтов и auth проверки
  if (!fontsLoaded && !fontError) return null;
  if (isLoading) return null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.s1 }}>
      <StatusBar style="light" backgroundColor={Colors.s1}/>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"  options={{ animation: 'fade' }}/>
        <Stack.Screen name="(tabs)"  options={{ animation: 'fade' }}/>
      </Stack>
    </View>
  );
}