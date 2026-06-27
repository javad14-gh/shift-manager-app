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
import { LogIn, Mail, Lock, User, Briefcase, UserPlus } from 'lucide-react-native';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export function LoginScreen() {
  const { login } = useApp();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'business' | 'individual'>('individual');
  const [businessName, setBusinessName] = useState('');
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

  const handleRegister = async () => {
    if (!email || !password || !name) {
      setError('Lütfen tüm alanları doldurunuz.');
      return;
    }
    if (accountType === 'business' && !businessName) {
      setError('Lütfen işletme adını giriniz.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;

      if (accountType === 'business') {
        const branchId = 'sube-' + Math.random().toString(36).substring(2, 9);
        await setDoc(doc(db, 'branches', branchId), {
          subeId: branchId,
          adi: businessName
        });

        await setDoc(doc(db, 'users', uid), {
          personelId: uid,
          uid: uid,
          subeId: branchId,
          adi: name,
          rol: 'genel-mudur',
          tanimlananSaat: 8,
          email: email.trim().toLowerCase(),
          aktif: true
        });
      } else {
        await setDoc(doc(db, 'users', uid), {
          personelId: uid,
          uid: uid,
          subeId: 'bireysel-sube',
          adi: name,
          rol: 'bireysel',
          tanimlananSaat: 8,
          email: email.trim().toLowerCase(),
          aktif: true
        });
      }

      alert('Kayıt başarıyla tamamlandı!');
      await login(email.trim(), password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Bu e-posta adresi zaten kullanımda.');
      } else if (err.code === 'auth/weak-password') {
        setError('Şifre en az 6 karakter olmalıdır.');
      } else {
        setError('Kayıt oluşturulurken bir hata oluştu: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDevSeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const email = 'pouriya798@gmail.com';
      const password = 'password123';
      
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        } else {
          throw err;
        }
      }
      
      const uid = userCredential.user.uid;
      
      await setDoc(doc(db, 'branches', 'sube-1'), {
        subeId: 'sube-1',
        adi: 'Merkez Şube'
      });
      
      await setDoc(doc(db, 'users', uid), {
        personelId: uid,
        uid: uid,
        subeId: 'sube-1',
        adi: 'Pouriya',
        rol: 'genel-mudur',
        tanimlananSaat: 8,
        email: email,
        aktif: true
      });
      
      alert('Geliştirici veri tabanı başarıyla kuruldu! Otomatik giriş yapılıyor...');
      await login(email, password);
    } catch (err: any) {
      console.error(err);
      setError('Veri tabanı kurulumu başarısız: ' + err.message);
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
          <ThemedText type="title" style={styles.title}>NpManger</ThemedText>
          <ThemedText style={styles.subtitle}>Vardiya ve Shift Takip Sistemi</ThemedText>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {isRegistering && (
          <View style={styles.inputContainer}>
            <User size={20} color="#888" style={styles.inputIcon} />
            <TextInput
              placeholder="Ad Soyad"
              placeholderTextColor="#888"
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
          </View>
        )}

        {isRegistering && (
          <View style={styles.typeSelectorContainer}>
            <TouchableOpacity
              onPress={() => setAccountType('individual')}
              style={[
                styles.typeOption,
                accountType === 'individual' && styles.typeOptionActive,
              ]}
            >
              <User size={18} color={accountType === 'individual' ? '#6366F1' : '#94A3B8'} style={{ marginRight: 6 }} />
              <ThemedText style={[
                styles.typeText,
                accountType === 'individual' && styles.typeTextActive
              ]}>Bireysel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setAccountType('business')}
              style={[
                styles.typeOption,
                accountType === 'business' && styles.typeOptionActive,
              ]}
            >
              <Briefcase size={18} color={accountType === 'business' ? '#6366F1' : '#94A3B8'} style={{ marginRight: 6 }} />
              <ThemedText style={[
                styles.typeText,
                accountType === 'business' && styles.typeTextActive
              ]}>İşletme</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {isRegistering && accountType === 'business' && (
          <View style={styles.inputContainer}>
            <Briefcase size={20} color="#888" style={styles.inputIcon} />
            <TextInput
              placeholder="İşletme / Restoran Adı"
              placeholderTextColor="#888"
              value={businessName}
              onChangeText={setBusinessName}
              style={styles.input}
            />
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
          onPress={isRegistering ? handleRegister : handleLogin}
          disabled={loading}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonInner}>
              {isRegistering ? (
                <>
                  <UserPlus size={20} color="#fff" style={{ marginRight: 8 }} />
                  <ThemedText style={styles.buttonText}>Kayıt Ol</ThemedText>
                </>
              ) : (
                <>
                  <LogIn size={20} color="#fff" style={{ marginRight: 8 }} />
                  <ThemedText style={styles.buttonText}>Giriş Yap</ThemedText>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setIsRegistering(!isRegistering);
            setError(null);
          }}
          style={styles.toggleButton}
        >
          <ThemedText style={styles.toggleButtonText}>
            {isRegistering ? 'Zaten bir hesabınız var mı? Giriş yapın' : 'Hesabınız yok mu? Kayıt olun'}
          </ThemedText>
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity
            onPress={handleDevSeed}
            disabled={loading}
            style={[styles.seedButton, { marginTop: 12 }]}
          >
            <ThemedText style={styles.seedButtonText}>Geliştirici Datanı Kur (Seed)</ThemedText>
          </TouchableOpacity>
        )}
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
  seedButton: {
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  seedButtonText: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: Spacing.four,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  toggleButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  typeSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    marginHorizontal: Spacing.one,
  },
  typeOptionActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  typeText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#F8FAFC',
  },
});
