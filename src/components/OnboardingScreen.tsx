import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useApp } from '../AppContext';
import { User, Briefcase, UserPlus, ArrowLeft } from 'lucide-react-native';
import { db } from '../firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export function OnboardingScreen() {
  const { firebaseUser, refreshProfiles, logout } = useApp();
  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [profileType, setProfileType] = useState<'individual' | 'business' | 'employee'>('individual');
  
  // Form states
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [bizName, setBizName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChooseType = (type: 'individual' | 'business' | 'employee') => {
    setProfileType(type);
    if (type === 'individual') {
      setTitle('Kişisel Profil');
    } else {
      setTitle('');
    }
    setStep('form');
  };

  const handleBack = () => {
    setStep('choose');
    setTitle('');
    setCode('');
    setBizName('');
  };

  const handleCreateProfile = async () => {
    if (!firebaseUser) return;
    
    if (profileType === 'business' && !bizName) {
      Alert.alert('Hata', 'Lütfen işletme adını giriniz.');
      return;
    }
    if (profileType === 'employee' && !code) {
      Alert.alert('Hata', 'Lütfen katılım kodunu giriniz.');
      return;
    }
    if (!title && profileType !== 'business') {
      Alert.alert('Hata', 'Lütfen profil başlığını giriniz.');
      return;
    }

    setLoading(true);
    try {
      let isletmeId = 'bireysel-isletme';
      let subeId = 'merkez';

      if (profileType === 'employee') {
        const workspacesRef = collection(db, 'workspaces');
        const q = query(workspacesRef, where("davetKodu", "==", code.trim().toUpperCase()));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          Alert.alert('Hata', 'Geçersiz katılım kodu. Lütfen tekrar deneyiniz.');
          setLoading(false);
          return;
        }
        isletmeId = querySnapshot.docs[0].id;
        subeId = 'merkez';
      } else if (profileType === 'business') {
        const newIsletmeId = 'isl-' + Math.random().toString(36).substring(2, 9);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let generatedCode = '';
        for (let i = 0; i < 6; i++) {
          generatedCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        await setDoc(doc(db, 'workspaces', newIsletmeId), {
          isletmeId: newIsletmeId,
          adi: bizName,
          davetKodu: generatedCode,
          cokSubeli: false
        });
        isletmeId = newIsletmeId;
        subeId = 'merkez';
      }

      const newProfileId = 'prof-' + Math.random().toString(36).substring(2, 9);
      const newProfile = {
        profileId: newProfileId,
        ownerUid: firebaseUser.uid,
        title: profileType === 'business' ? bizName : title,
        rol: profileType === 'business' ? 'genel-mudur' : profileType === 'employee' ? 'calisan' : 'bireysel',
        isletmeId: isletmeId,
        subeId: subeId,
        aktif: true,
        email: firebaseUser.email || ''
      };

      await setDoc(doc(db, 'profiles', newProfileId), newProfile);
      await refreshProfiles();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Hata', 'Profil oluşturulurken bir hata oluştu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedView style={styles.card}>
          <ThemedText style={styles.welcomeText}>Hoş Geldiniz!</ThemedText>
          <ThemedText style={styles.descText}>
            Uygulamayı kullanmaya başlamak için ilk profilinizi oluşturmanız gerekmektedir.
          </ThemedText>

          {step === 'choose' ? (
            <View style={styles.optionsWrapper}>
              <TouchableOpacity
                onPress={() => handleChooseType('individual')}
                style={styles.optionButton}
              >
                <User size={28} color="#6366F1" />
                <View style={styles.optionDetails}>
                  <ThemedText style={styles.optionTitle}>Bireysel Profil</ThemedText>
                  <ThemedText style={styles.optionDesc}>Kendi vardiyalarınızı ve çalışma saatlerinizi takip edin.</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleChooseType('employee')}
                style={styles.optionButton}
              >
                <UserPlus size={28} color="#10B981" />
                <View style={styles.optionDetails}>
                  <ThemedText style={styles.optionTitle}>Çalışan Profili</ThemedText>
                  <ThemedText style={styles.optionDesc}>Bir işletmenin kodunu girerek ekibe dahil olun.</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleChooseType('business')}
                style={styles.optionButton}
              >
                <Briefcase size={28} color="#F59E0B" />
                <View style={styles.optionDetails}>
                  <ThemedText style={styles.optionTitle}>İşletme Sahibi</ThemedText>
                  <ThemedText style={styles.optionDesc}>Kendi işletmenizi kurun, ekibinizi ve vardiyaları yönetin.</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formWrapper}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <ArrowLeft size={16} color="#94A3B8" />
                <ThemedText style={styles.backText}>Geri Dön</ThemedText>
              </TouchableOpacity>

              {profileType === 'individual' && (
                <>
                  <ThemedText style={styles.label}>Profil Başlığı</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: Kişisel Takip / Freelance A"
                    placeholderTextColor="#64748B"
                    value={title}
                    onChangeText={setTitle}
                  />
                </>
              )}

              {profileType === 'employee' && (
                <>
                  <ThemedText style={styles.label}>Profil Başlığı (Adınız Soyadınız)</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: Ali Yılmaz"
                    placeholderTextColor="#64748B"
                    value={title}
                    onChangeText={setTitle}
                  />

                  <ThemedText style={styles.label}>Katılım Kodu (Join Code)</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: NP-XXXX"
                    placeholderTextColor="#64748B"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                  />
                </>
              )}

              {profileType === 'business' && (
                <>
                  <ThemedText style={styles.label}>İşletme / Restoran Adı</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: Napoli Pizzeria"
                    placeholderTextColor="#64748B"
                    value={bizName}
                    onChangeText={setBizName}
                  />
                </>
              )}

              <TouchableOpacity
                onPress={handleCreateProfile}
                disabled={loading}
                style={styles.submitButton}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <ThemedText style={styles.submitText}>Profili Oluştur</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <ThemedText style={styles.logoutText}>Çıkış Yap</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.five,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    padding: Spacing.six,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  descText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: Spacing.six,
    lineHeight: 20,
  },
  optionsWrapper: {
    gap: Spacing.four,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    padding: Spacing.four,
  },
  optionDetails: {
    flex: 1,
    marginLeft: Spacing.four,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  formWrapper: {
    marginTop: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  backText: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: Spacing.two,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: Spacing.two,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: Spacing.four,
    color: '#FFF',
    fontSize: 14,
    marginBottom: Spacing.five,
  },
  submitButton: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  submitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  logoutButton: {
    alignItems: 'center',
    marginTop: Spacing.six,
    paddingVertical: Spacing.two,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
