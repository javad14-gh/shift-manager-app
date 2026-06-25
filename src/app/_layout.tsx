import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme, ActivityIndicator, View, StyleSheet } from 'react-native';
import { AppProvider, useApp } from '../AppContext';
import { LoginScreen } from '../components/LoginScreen';
import AppTabs from '@/components/app-tabs';

function MainLayout() {
  const { user, isLoading } = useApp();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AppTabs />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AppProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <MainLayout />
      </ThemeProvider>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});
