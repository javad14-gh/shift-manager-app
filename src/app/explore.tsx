import React, { useMemo, useState } from 'react';
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
import { useApp } from '../AppContext';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  User,
  Briefcase,
  Key,
  Clock,
  Share2,
  Check,
  Settings,
  Mail,
  ToggleLeft,
  ToggleRight,
  LogOut,
  MapPin
} from 'lucide-react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function SettingsScreen() {
  const { user, firebaseUser, activeProfile, workspaces, refreshProfiles, logout } = useApp();
  const [loading, setLoading] = useState(false);

  // Manager settings states
  const activeWorkspace = useMemo(() => {
    if (!activeProfile || activeProfile.rol !== 'genel-mudur') return null;
    return workspaces.find(w => w.isletmeId === activeProfile.isletmeId);
  }, [workspaces, activeProfile]);

  const [bizName, setBizName] = useState(activeWorkspace?.adi || '');
  const [cokSubeli, setCokSubeli] = useState(activeWorkspace?.cokSubeli || false);
  
  // Profile target hours state
  const [targetHours, setTargetHours] = useState(activeProfile?.tanimlananSaat?.toString() || '8');

  const isChanged = useMemo(() => {
    if (activeProfile?.rol === 'genel-mudur') {
      return (
        bizName !== (activeWorkspace?.adi || '') ||
        cokSubeli !== (activeWorkspace?.cokSubeli || false) ||
        targetHours !== (activeProfile?.tanimlananSaat?.toString() || '8')
      );
    }
    return targetHours !== (activeProfile?.tanimlananSaat?.toString() || '8');
  }, [bizName, cokSubeli, targetHours, activeWorkspace, activeProfile]);

  const handleShareCode = async () => {
    if (!activeWorkspace) return;
    try {
      await Share.share({
        message: `${activeWorkspace.adi} ekibine katılmak için kayıt esnasında bu katılım kodunu giriniz:\n\n${activeWorkspace.davetKodu}`
      });
    } catch (error: any) {
      Alert.alert('Hata', 'Paylaşılamadı: ' + error.message);
    }
  };

  const handleSaveSettings = async () => {
    if (!activeProfile) return;
    setLoading(true);
    try {
      // 1. Update Profile defined hours
      const profileRef = doc(db, 'profiles', activeProfile.profileId);
      const parsedHours = parseInt(targetHours, 10);
      await updateDoc(profileRef, {
        tanimlananSaat: isNaN(parsedHours) ? 8 : parsedHours
      });

      // 2. If General Manager, update workspace settings
      if (activeProfile.rol === 'genel-mudur' && activeWorkspace) {
        const workspaceRef = doc(db, 'workspaces', activeWorkspace.isletmeId);
        await updateDoc(workspaceRef, {
          adi: bizName,
          cokSubeli: cokSubeli
        });
      }

      await refreshProfiles();
      Alert.alert('Başarılı', 'Ayarlar başarıyla kaydedildi.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Hata', 'Ayarlar kaydedilemedi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const roleText = useMemo(() => {
    if (!activeProfile) return '';
    switch (activeProfile.rol) {
      case 'genel-mudur': return 'İşletme Sahibi';
      case 'calisan': return 'Çalışan';
      case 'bireysel': return 'Kişisel Takip';
      default: return 'Üye';
    }
  }, [activeProfile]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Profile Info Header */}
      <ThemedView style={styles.profileHeaderCard}>
        <View style={styles.avatarPlaceholder}>
          <User size={32} color="#818CF8" />
        </View>
        <View style={styles.headerDetails}>
          <ThemedText style={styles.profileName}>{activeProfile?.title}</ThemedText>
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <ThemedText style={styles.roleText}>{roleText}</ThemedText>
            </View>
            <View style={[styles.statusBadge, activeProfile?.aktif ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
              <ThemedText style={styles.statusBadgeText}>
                {activeProfile?.aktif ? 'Aktif' : 'Pasif'}
              </ThemedText>
            </View>
          </View>
        </View>
      </ThemedView>

      {/* Target Hours Settings Card (For all profiles) */}
      <ThemedView style={styles.settingsCard}>
        <View style={styles.cardHeader}>
          <Clock size={20} color="#818CF8" />
          <ThemedText style={styles.cardTitle}>Profil Ayarları</ThemedText>
        </View>
        
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
      </ThemedView>

      {/* Business Specific Settings Card */}
      {activeProfile?.rol === 'genel-mudur' && activeWorkspace && (
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

          {/* Join Code Visual and Share */}
          <View style={styles.joinCodeContainer}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.inputLabel}>Personel Davet Kodu</ThemedText>
              <ThemedText style={styles.joinCodeText}>{activeWorkspace.davetKodu}</ThemedText>
            </View>
            <TouchableOpacity onPress={handleShareCode} style={styles.shareBtn}>
              <Share2 size={18} color="#FFF" />
              <ThemedText style={styles.shareBtnText}>Paylaş</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Multi-Branch Toggle */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: Spacing.four }}>
              <ThemedText style={styles.switchLabel}>Çok Şubeli Yönetim</ThemedText>
              <ThemedText style={styles.switchDesc}>Müşterilerinizi veya farklı mağazalarınızı ayrı ayrı yönetmek için.</ThemedText>
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

      {/* Workspace Display for Employees */}
      {activeProfile?.rol === 'calisan' && (
        <ThemedView style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <MapPin size={20} color="#10B981" />
            <ThemedText style={styles.cardTitle}>Bağlı Olunan İşletme</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Mevcut Ekip:</ThemedText>
            <ThemedText style={styles.infoValue}>
              {workspaces.find(w => w.isletmeId === activeProfile.isletmeId)?.adi || 'Bilinmeyen İşletme'}
            </ThemedText>
          </View>
        </ThemedView>
      )}

      {/* Account Info Card */}
      <ThemedView style={styles.settingsCard}>
        <View style={styles.cardHeader}>
          <Mail size={20} color="#10B981" />
          <ThemedText style={styles.cardTitle}>Hesap Bilgileri</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>Hesap Sahibi:</ThemedText>
          <ThemedText style={styles.infoValue}>{user?.name}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.infoLabel}>E-posta adresi:</ThemedText>
          <ThemedText style={styles.infoValue}>{firebaseUser?.email}</ThemedText>
        </View>
      </ThemedView>

      {/* Save Settings Button */}
      {isChanged && (
        <TouchableOpacity
          onPress={handleSaveSettings}
          disabled={loading}
          style={styles.saveButton}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Check size={18} color="#FFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.saveText}>Ayarları Kaydet</ThemedText>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Logout Action */}
      <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
        <LogOut size={18} color="#EF4444" style={{ marginRight: Spacing.two }} />
        <ThemedText style={styles.logoutBtnText}>Çıkış Yap</ThemedText>
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
  profileHeaderCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    marginRight: Spacing.four,
  },
  headerDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  roleBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusBadgeInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  infoValue: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  saveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    marginTop: Spacing.four,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
