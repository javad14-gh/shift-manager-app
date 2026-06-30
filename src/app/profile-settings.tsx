import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  ScrollView,
  Switch
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../AppContext';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  ArrowLeft,
  Check,
  Clock,
  Briefcase,
  Share2,
  Settings,
  Mail,
  User
} from 'lucide-react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Workspace } from '../types';

export default function ProfileSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refreshProfiles } = useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [targetHours, setTargetHours] = useState('8');
  const [bizName, setBizName] = useState('');
  const [cokSubeli, setCokSubeli] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        // Load profile doc
        const profileRef = doc(db, 'profiles', id);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const profileData = profileSnap.data() as UserProfile;
          setProfile(profileData);
          setTitle(profileData.title || '');
          setTargetHours(profileData.tanimlananSaat?.toString() || '8');

          // Load workspace if manager
          if (profileData.rol === 'genel-mudur' && profileData.isletmeId) {
            const workspaceRef = doc(db, 'workspaces', profileData.isletmeId);
            const workspaceSnap = await getDoc(workspaceRef);
            if (workspaceSnap.exists()) {
              const workspaceData = workspaceSnap.data() as Workspace;
              setWorkspace(workspaceData);
              setBizName(workspaceData.adi || '');
              setCokSubeli(workspaceData.cokSubeli || false);
            }
          }
        } else {
          Alert.alert('Hata', 'Profil bulunamadı.');
          router.push('/profiles' as any);
        }
      } catch (e: any) {
        console.error(e);
        Alert.alert('Hata', 'Veriler yüklenemedi: ' + e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleShareCode = async () => {
    if (!workspace) return;
    try {
      await Share.share({
        message: `${workspace.adi} ekibine katılmak için kayıt esnasında bu katılım kodunu giriniz:\n\n${workspace.davetKodu}`
      });
    } catch (error: any) {
      Alert.alert('Hata', 'Paylaşılamadı: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // 1. Update Profile title and defined hours
      const profileRef = doc(db, 'profiles', profile.profileId);
      const parsedHours = parseInt(targetHours, 10);
      await updateDoc(profileRef, {
        title: title,
        tanimlananSaat: isNaN(parsedHours) ? 8 : parsedHours
      });

      // 2. If general manager, update workspace settings
      if (profile.rol === 'genel-mudur' && profile.isletmeId) {
        const workspaceRef = doc(db, 'workspaces', profile.isletmeId);
        await updateDoc(workspaceRef, {
          adi: bizName,
          cokSubeli: cokSubeli
        });
      }

      await refreshProfiles();
      Alert.alert('Başarılı', 'Ayarlar başarıyla kaydedildi.', [
        { text: 'Tamam', onPress: () => router.push('/profiles' as any) }
      ]);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Hata', 'Ayarlar kaydedilemedi: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Back button */}
      <TouchableOpacity onPress={() => router.push('/profiles' as any)} style={styles.backBtn}>
        <ArrowLeft size={16} color="#94A3B8" />
        <ThemedText style={styles.backBtnText}>Profillere Dön</ThemedText>
      </TouchableOpacity>

      <ThemedText style={styles.screenTitle}>Profil Ayarları</ThemedText>

      {/* Main settings card */}
      <ThemedView style={styles.settingsCard}>
        <View style={styles.cardHeader}>
          <Settings size={20} color="#818CF8" />
          <ThemedText style={styles.cardTitle}>Genel Bilgiler</ThemedText>
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Profil Başlığı</ThemedText>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Profil Başlığı"
            placeholderTextColor="#64748B"
          />
        </View>

        {(profile?.rol === 'calisan' || profile?.rol === 'bireysel') && (
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Günlük Hedef Çalışma Saati</ThemedText>
            <TextInput
              keyboardType="numeric"
              style={styles.textInput}
              value={targetHours}
              onChangeText={setTargetHours}
              placeholder="Örn: 8"
              placeholderTextColor="#64748B"
            />
          </View>
        )}
      </ThemedView>

      {/* Business Owner settings card */}
      {profile?.rol === 'genel-mudur' && workspace && (
        <ThemedView style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Briefcase size={20} color="#F59E0B" />
            <ThemedText style={styles.cardTitle}>İşletme Ayarları</ThemedText>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>İşletme Adı</ThemedText>
            <TextInput
              style={styles.textInput}
              value={bizName}
              onChangeText={setBizName}
              placeholder="Örn: Napoli Pizzeria"
              placeholderTextColor="#64748B"
            />
          </View>

          {/* Join Code and share */}
          <View style={styles.joinCodeContainer}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.inputLabel}>Personel Davet Kodu</ThemedText>
              <ThemedText style={styles.joinCodeText}>{workspace.davetKodu}</ThemedText>
            </View>
            <TouchableOpacity onPress={handleShareCode} style={styles.shareBtn}>
              <Share2 size={18} color="#FFF" />
              <ThemedText style={styles.shareBtnText}>Paylaş</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Multi-Branch toggle */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: Spacing.four }}>
              <ThemedText style={styles.switchLabel}>Çok Şubeli Yönetim</ThemedText>
              <ThemedText style={styles.switchDesc}>
                Farklı şube veya mağazalarınızı ayrı ayrı yönetmek için.
              </ThemedText>
            </View>
            <Switch
              value={cokSubeli}
              onValueChange={setCokSubeli}
              trackColor={{ false: '#334155', true: '#818CF8' }}
              thumbColor={cokSubeli ? '#6366F1' : '#94A3B8'}
            />
          </View>
        </ThemedView>
      )}

      {/* Save Button */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={styles.saveBtn}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Check size={18} color="#FFF" style={{ marginRight: 6 }} />
            <ThemedText style={styles.saveText}>Değişiklikleri Kaydet</ThemedText>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: Spacing.five,
  },
  settingsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: Spacing.five,
    marginBottom: Spacing.four,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: Spacing.two,
  },
  inputGroup: {
    marginBottom: Spacing.three,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: Spacing.two,
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 14,
  },
  joinCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  joinCodeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#818CF8',
    marginTop: Spacing.one,
  },
  shareBtn: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    height: 38,
    borderRadius: 10,
  },
  shareBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: Spacing.four,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  switchDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 14,
  },
  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  saveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
