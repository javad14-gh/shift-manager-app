import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { useApp } from '../AppContext';
import { useRouter } from 'expo-router';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  User,
  Users,
  LogOut,
  Mail,
  ArrowRight
} from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, firebaseUser, activeProfile, logout } = useApp();
  const router = useRouter();

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
          <ThemedText style={styles.profileName}>{activeProfile?.title || 'Profil Yok'}</ThemedText>
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

      {/* Profile Management Navigation Button (Requested) */}
      <TouchableOpacity
        onPress={() => router.push('/profiles' as any)}
        style={styles.manageProfilesBtn}
      >
        <View style={styles.manageProfilesLeft}>
          <Users size={20} color="#FFF" style={{ marginRight: 10 }} />
          <ThemedText style={styles.manageProfilesText}>Profilleri Yönet</ThemedText>
        </View>
        <ArrowRight size={20} color="#FFF" />
      </TouchableOpacity>

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
  manageProfilesBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 20,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.five,
    marginBottom: Spacing.four,
  },
  manageProfilesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageProfilesText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
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
