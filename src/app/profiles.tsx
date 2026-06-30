import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch
} from 'react-native';
import { useApp } from '../AppContext';
import { useRouter } from 'expo-router';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  User,
  Briefcase,
  Users,
  Plus,
  ToggleLeft,
  ToggleRight,
  Settings,
  TrendingUp,
  ArrowLeft,
  Check,
  Award
} from 'lucide-react-native';
import { doc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

export default function ProfilesScreen() {
  const { firebaseUser, profiles, activeProfile, setActiveProfile, refreshProfiles } = useApp();
  const router = useRouter();

  // Switch to show/hide inactive profiles
  const [showInactive, setShowInactive] = useState(true);

  // Profile creation states
  const [createMode, setCreateMode] = useState<'choose' | 'business' | 'employee' | 'individual' | null>(null);
  const [newProfileTitle, setNewProfileTitle] = useState('');
  const [newProfileCode, setNewProfileCode] = useState('');
  const [newProfileBizName, setNewProfileBizName] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter profiles based on showInactive toggle
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => showInactive || p.aktif);
  }, [profiles, showInactive]);

  const handleToggleProfileActive = async (profile: UserProfile) => {
    if (activeProfile && profile.profileId === activeProfile.profileId && profile.aktif) {
      Alert.alert('Hata', 'Aktif çalıştığınız profil devre dışı bırakılamaz. Önce başka bir profile geçiş yapın.');
      return;
    }
    
    try {
      const profileRef = doc(db, 'profiles', profile.profileId);
      await updateDoc(profileRef, { aktif: !profile.aktif });
      await refreshProfiles();
    } catch (e: any) {
      Alert.alert('Hata', 'Profil durumu güncellenemedi: ' + e.message);
    }
  };

  const handleSelectProfile = (profile: UserProfile) => {
    if (!profile.aktif) {
      Alert.alert('Hata', 'Devre dışı bırakılmış bir profile geçiş yapılamaz. Lütfen önce profili aktif hale getirin.');
      return;
    }
    setActiveProfile(profile);
    router.push('/');
  };

  const handleCreateProfile = async (type: 'business' | 'employee' | 'individual') => {
    if (!firebaseUser) return;
    
    if (type === 'business' && !newProfileBizName) {
      Alert.alert('Hata', 'Lütfen işletme adını giriniz.');
      return;
    }
    if (type === 'employee' && !newProfileCode) {
      Alert.alert('Hata', 'Lütfen katılım kodunu giriniz.');
      return;
    }
    if (type !== 'business' && !newProfileTitle) {
      Alert.alert('Hata', 'Lütfen profil başlığını giriniz.');
      return;
    }

    setLoading(true);
    try {
      let isletmeId = 'bireysel-isletme';
      let subeId = 'merkez';
      
      if (type === 'employee') {
        const workspacesRef = collection(db, 'workspaces');
        const q = query(workspacesRef, where("davetKodu", "==", newProfileCode.trim().toUpperCase()));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          Alert.alert('Hata', 'Geçersiz katılım kodu.');
          setLoading(false);
          return;
        }
        isletmeId = querySnapshot.docs[0].id;
        subeId = 'merkez';
      } else if (type === 'business') {
        const newIsletmeId = 'isl-' + Math.random().toString(36).substring(2, 9);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let generatedCode = '';
        for (let i = 0; i < 6; i++) {
          generatedCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        await setDoc(doc(db, 'workspaces', newIsletmeId), {
          isletmeId: newIsletmeId,
          adi: newProfileBizName,
          davetKodu: generatedCode,
          cokSubeli: false
        });
        isletmeId = newIsletmeId;
        subeId = 'merkez';
      }

      const newProfileId = 'prof-' + Math.random().toString(36).substring(2, 9);
      const newProfile: UserProfile = {
        profileId: newProfileId,
        ownerUid: firebaseUser.uid,
        title: type === 'business' ? newProfileBizName : newProfileTitle,
        rol: type === 'business' ? 'genel-mudur' : type === 'employee' ? 'calisan' : 'bireysel',
        isletmeId: isletmeId,
        subeId: subeId,
        aktif: true
      };

      await setDoc(doc(db, 'profiles', newProfileId), newProfile);
      Alert.alert('Başarılı', 'Profil başarıyla oluşturuldu.');
      await refreshProfiles();
      setActiveProfile(newProfile);
      
      // Clear forms and exit creation mode
      setCreateMode(null);
      setNewProfileTitle('');
      setNewProfileCode('');
      setNewProfileBizName('');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Hata', 'Profil oluşturulamadı: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Header Back Navigation */}
      <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton}>
        <ArrowLeft size={16} color="#94A3B8" />
        <ThemedText style={styles.backButtonText}>Panele Dön</ThemedText>
      </TouchableOpacity>

      <ThemedText style={styles.screenTitle}>Profillerimi Yönet</ThemedText>

      {createMode === null ? (
        <>
          {/* Active status filter switch */}
          <View style={styles.filterRow}>
            <ThemedText style={styles.filterLabel}>Pasif Profilleri Göster</ThemedText>
            <Switch
              value={showInactive}
              onValueChange={setShowInactive}
              trackColor={{ false: '#334155', true: '#818CF8' }}
              thumbColor={showInactive ? '#6366F1' : '#94A3B8'}
            />
          </View>

          {/* List of profiles */}
          <View style={styles.listWrapper}>
            {filteredProfiles.map((p) => {
              const isActive = activeProfile?.profileId === p.profileId;
              return (
                <ThemedView
                  key={p.profileId}
                  style={[
                    styles.profileCard,
                    isActive && styles.profileCardActive,
                    !p.aktif && styles.profileCardPassive
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleSelectProfile(p)}
                    style={styles.profileDetailsTouch}
                  >
                    <View style={styles.avatarMini}>
                      {p.rol === 'genel-mudur' ? (
                        <Briefcase size={20} color="#F59E0B" />
                      ) : p.rol === 'calisan' ? (
                        <Users size={20} color="#10B981" />
                      ) : (
                        <User size={20} color="#6366F1" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ThemedText style={[styles.profileTitle, isActive && styles.profileTitleActive]}>
                          {p.title}
                        </ThemedText>
                        {isActive && (
                          <View style={styles.activeBadge}>
                            <Award size={10} color="#FFF" style={{ marginRight: 2 }} />
                            <ThemedText style={styles.activeBadgeText}>Çalışılan</ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={styles.profileRole}>
                        {p.rol === 'genel-mudur' ? 'İşletme Sahibi' : p.rol === 'calisan' ? 'Çalışan' : 'Bireysel Takip'}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>

                  {/* Actions column */}
                  <View style={styles.profileActions}>
                    {/* Active toggle */}
                    <TouchableOpacity
                      onPress={() => handleToggleProfileActive(p)}
                      style={styles.actionIconButton}
                    >
                      {p.aktif ? (
                        <ToggleRight size={24} color="#10B981" />
                      ) : (
                        <ToggleLeft size={24} color="#64748B" />
                      )}
                    </TouchableOpacity>

                    {/* Settings Gear */}
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/profile-settings' as any, params: { id: p.profileId } })}
                      style={styles.actionIconButton}
                    >
                      <Settings size={18} color="#818CF8" />
                    </TouchableOpacity>

                    {/* Reports Icon */}
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/profile-reports' as any, params: { id: p.profileId } })}
                      style={styles.actionIconButton}
                    >
                      <TrendingUp size={18} color="#34D399" />
                    </TouchableOpacity>
                  </View>
                </ThemedView>
              );
            })}
          </View>

          {/* Add profile trigger */}
          <TouchableOpacity
            onPress={() => setCreateMode('choose')}
            style={styles.addProfileButton}
          >
            <Plus size={18} color="#FFF" style={{ marginRight: 6 }} />
            <ThemedText style={styles.addProfileButtonText}>Yeni Profil Ekle</ThemedText>
          </TouchableOpacity>
        </>
      ) : (
        /* Create Profile Onboarding flow */
        <ThemedView style={styles.formContainer}>
          <TouchableOpacity
            onPress={() => {
              setCreateMode(null);
              setNewProfileTitle('');
              setNewProfileCode('');
              setNewProfileBizName('');
            }}
            style={styles.formBackButton}
          >
            <ArrowLeft size={14} color="#94A3B8" />
            <ThemedText style={styles.formBackText}>Listeye Geri Dön</ThemedText>
          </TouchableOpacity>

          {createMode === 'choose' ? (
            <View style={styles.chooseWrapper}>
              <ThemedText style={styles.chooseLabel}>Eklenecek profil türünü seçin:</ThemedText>

              <TouchableOpacity
                onPress={() => {
                  setNewProfileTitle('Kişisel Takip');
                  setCreateMode('individual');
                }}
                style={styles.chooseOption}
              >
                <User size={22} color="#6366F1" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <ThemedText style={styles.chooseOptionTitle}>Bireysel Profil</ThemedText>
                  <ThemedText style={styles.chooseOptionDesc}>Kendi çalışma vardiyalarınızı takip edin.</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCreateMode('employee')}
                style={styles.chooseOption}
              >
                <Users size={22} color="#10B981" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <ThemedText style={styles.chooseOptionTitle}>Çalışan Profili</ThemedText>
                  <ThemedText style={styles.chooseOptionDesc}>Katılım kodu girerek bir ekibe dahil olun.</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCreateMode('business')}
                style={styles.chooseOption}
              >
                <Briefcase size={22} color="#F59E0B" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <ThemedText style={styles.chooseOptionTitle}>İşletme Sahibi</ThemedText>
                  <ThemedText style={styles.chooseOptionDesc}>Kendi ekibinizi ve vardiyalarınızı yönetin.</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.fieldsWrapper}>
              {createMode === 'individual' && (
                <>
                  <ThemedText style={styles.fieldLabel}>Profil Başlığı</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    value={newProfileTitle}
                    onChangeText={setNewProfileTitle}
                    placeholder="Örn: Kişisel Takip / Freelance A"
                    placeholderTextColor="#64748B"
                  />
                  <TouchableOpacity
                    onPress={() => handleCreateProfile('individual')}
                    disabled={loading}
                    style={styles.submitButton}
                  >
                    {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.submitText}>Profil Oluştur</ThemedText>}
                  </TouchableOpacity>
                </>
              )}

              {createMode === 'employee' && (
                <>
                  <ThemedText style={styles.fieldLabel}>Profil Başlığı (Adınız Soyadınız)</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    value={newProfileTitle}
                    onChangeText={setNewProfileTitle}
                    placeholder="Örn: Ali Yılmaz"
                    placeholderTextColor="#64748B"
                  />

                  <ThemedText style={styles.fieldLabel}>Katılım Kodu (Join Code)</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    value={newProfileCode}
                    onChangeText={setNewProfileCode}
                    placeholder="Örn: NP-XXXX"
                    placeholderTextColor="#64748B"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    onPress={() => handleCreateProfile('employee')}
                    disabled={loading}
                    style={styles.submitButton}
                  >
                    {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.submitText}>Koda Katıl</ThemedText>}
                  </TouchableOpacity>
                </>
              )}

              {createMode === 'business' && (
                <>
                  <ThemedText style={styles.fieldLabel}>İşletme Adı</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    value={newProfileBizName}
                    onChangeText={setNewProfileBizName}
                    placeholder="Örn: Big Chef Burgers"
                    placeholderTextColor="#64748B"
                  />
                  <TouchableOpacity
                    onPress={() => handleCreateProfile('business')}
                    disabled={loading}
                    style={styles.submitButton}
                  >
                    {loading ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.submitText}>İşletme Kur</ThemedText>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ThemedView>
      )}
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
    paddingBottom: 60,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  backButtonText: {
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
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: Spacing.five,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  filterLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  listWrapper: {
    gap: Spacing.three,
    marginBottom: Spacing.six,
  },
  profileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: Spacing.four,
  },
  profileCardActive: {
    borderColor: 'rgba(99, 102, 241, 0.4)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  profileCardPassive: {
    opacity: 0.6,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
  },
  profileDetailsTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarMini: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  profileTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#E2E8F0',
  },
  profileTitleActive: {
    color: '#818CF8',
  },
  profileRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  addProfileButton: {
    backgroundColor: '#6366F1',
    borderRadius: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProfileButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  formContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: Spacing.five,
  },
  formBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  formBackText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  chooseWrapper: {
    gap: Spacing.three,
  },
  chooseLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: Spacing.two,
  },
  chooseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  chooseOptionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  chooseOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  fieldsWrapper: {
    gap: Spacing.three,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: Spacing.one,
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 14,
    marginBottom: Spacing.three,
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  submitText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
