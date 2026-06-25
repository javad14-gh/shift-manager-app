import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions
} from 'react-native';
import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useApp } from '../AppContext';
import { LogIn, Mail, Lock } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export function LoginScreen() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Lütfen e-posta ve şifrenizi giriniz.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-posta veya şifre hatalı.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi.');
      } else {
        setError('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.backgroundAccent} />
      <View style={styles.backgroundAccent2} />
      
      <ThemedView type="background" style={styles.card}>
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: 'https://picsum.photos/seed/restaurant/200/200' }}
            style={styles.logo}
          />
          <ThemedText type="title" style={styles.title}>RedManger</ThemedText>
          <ThemedText style={styles.subtitle}>Vardiya ve Shift Takip Sistemi</ThemedText>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Mail size={20} color="#888" style={styles.inputIcon} />
          <TextInput
            placeholder="E-posta"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>

        <View style={styles.inputContainer}>
          <Lock size={20} color="#888" style={styles.inputIcon} />
          <TextInput
            placeholder="Şifre"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonInner}>
              <LogIn size={20} color="#fff" style={{ marginRight: 8 }} />
              <ThemedText style={styles.buttonText}>Giriş Yap</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: '#0F172A', // Sleek dark blue slate
  },
  backgroundAccent: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // Indigo
    filter: Platform.OS === 'web' ? 'blur(40px)' : undefined,
  },
  backgroundAccent2: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(236, 72, 153, 0.15)', // Pink
    filter: Platform.OS === 'web' ? 'blur(40px)' : undefined,
  },
  card: {
    width: Platform.OS === 'web' ? Math.min(width * 0.9, 420) : '100%',
    padding: Spacing.six,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.7)', // Slate 800 with transparency
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  inputIcon: {
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#6366F1', // Indigo 500
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.5)',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
