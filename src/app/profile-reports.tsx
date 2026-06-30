import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  ArrowLeft,
  TrendingUp,
  Clock,
  Calendar,
  Users,
  Award,
  BarChart2,
  FileText
} from 'lucide-react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Vardiya, Personel } from '../types';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function ProfileReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [shifts, setShifts] = useState<Vardiya[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    async function loadReports() {
      if (!id) return;
      try {
        setLoading(true);
        // 1. Fetch profile
        const profileRef = doc(db, 'profiles', id);
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          Alert.alert('Hata', 'Profil bulunamadı.');
          router.push('/profiles' as any);
          return;
        }
        const profileData = profileSnap.data() as UserProfile;
        setProfile(profileData);

        // 2. Fetch shifts linked to workspace
        const shiftsRef = collection(db, 'shifts');
        const q = query(shiftsRef, where('isletmeId', '==', profileData.isletmeId));
        const snap = await getDocs(q);
        const fetchedShifts = snap.docs.map(d => d.data() as Vardiya);

        // Filter based on role
        if (profileData.rol === 'genel-mudur') {
          // Managers see all workspace shifts
          setShifts(fetchedShifts);

          // Also fetch all staff profiles of this workspace
          const profilesRef = collection(db, 'profiles');
          const pQuery = query(profilesRef, where('isletmeId', '==', profileData.isletmeId));
          const pSnap = await getDocs(pQuery);
          setAllProfiles(pSnap.docs.map(d => d.data() as UserProfile));
        } else {
          // Employees / Individuals only see their own shifts
          const personalShifts = fetchedShifts.filter(s => s.personelId === id);
          setShifts(personalShifts);
        }
      } catch (e: any) {
        console.error(e);
        Alert.alert('Hata', 'Rapor verileri yüklenemedi: ' + e.message);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [id]);

  // Calculations for employee/individual
  const personalStats = useMemo(() => {
    if (!profile || profile.rol === 'genel-mudur') return null;

    const completed = shifts.filter(s => s.girisSaati && s.cikisSaati);
    let totalMinutes = 0;
    completed.forEach(s => {
      if (s.girisSaati && s.cikisSaati) {
        const diff = new Date(s.cikisSaati).getTime() - new Date(s.girisSaati).getTime();
        totalMinutes += Math.max(0, Math.floor(diff / 60000));
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const avgMins = completed.length > 0 ? Math.floor(totalMinutes / completed.length) : 0;
    const avgHours = Math.floor(avgMins / 60);
    const avgMinsRem = avgMins % 60;

    return {
      totalShifts: shifts.length,
      completedShifts: completed.length,
      totalTime: `${hours} sa ${mins} dk`,
      avgTime: `${avgHours} sa ${avgMinsRem} dk`,
      rawShifts: shifts.sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 15)
    };
  }, [profile, shifts]);

  // Calculations for Workspace manager
  const managerStats = useMemo(() => {
    if (!profile || profile.rol !== 'genel-mudur') return null;

    const activeStaff = allProfiles.filter(p => p.aktif);
    const totalScheduled = shifts.length;
    const completed = shifts.filter(s => s.girisSaati && s.cikisSaati);

    // Calculate sum of actual worked hours grouped by employee profileId
    const staffHoursMap: { [profileId: string]: { name: string; mins: number } } = {};
    allProfiles.forEach(p => {
      staffHoursMap[p.profileId] = { name: p.title || 'İsimsiz', mins: 0 };
    });

    completed.forEach(s => {
      if (s.personelId && staffHoursMap[s.personelId]) {
        if (s.girisSaati && s.cikisSaati) {
          const diff = new Date(s.cikisSaati).getTime() - new Date(s.girisSaati).getTime();
          staffHoursMap[s.personelId].mins += Math.max(0, Math.floor(diff / 60000));
        }
      }
    });

    const staffList = Object.keys(staffHoursMap).map(pid => {
      const h = Math.floor(staffHoursMap[pid].mins / 60);
      const m = staffHoursMap[pid].mins % 60;
      return {
        profileId: pid,
        name: staffHoursMap[pid].name,
        timeStr: `${h} sa ${m} dk`,
        rawMins: staffHoursMap[pid].mins
      };
    }).sort((a, b) => b.rawMins - a.rawMins);

    return {
      staffCount: allProfiles.length,
      activeStaffCount: activeStaff.length,
      totalShifts: totalScheduled,
      completedShifts: completed.length,
      staffList
    };
  }, [profile, shifts, allProfiles]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Back to Profiles */}
      <TouchableOpacity onPress={() => router.push('/profiles' as any)} style={styles.backBtn}>
        <ArrowLeft size={16} color="#94A3B8" />
        <ThemedText style={styles.backBtnText}>Profillere Dön</ThemedText>
      </TouchableOpacity>

      <ThemedText style={styles.screenTitle}>{profile?.title} Raporları</ThemedText>

      {/* Employee / Individual Reports */}
      {personalStats && (
        <View style={styles.statsWrapper}>
          {/* Key Metrics cards */}
          <View style={styles.metricsGrid}>
            <ThemedView style={styles.metricCard}>
              <Calendar size={20} color="#6366F1" />
              <ThemedText style={styles.metricValue}>{personalStats.totalShifts}</ThemedText>
              <ThemedText style={styles.metricLabel}>Planlanan Vardiya</ThemedText>
            </ThemedView>

            <ThemedView style={styles.metricCard}>
              <Award size={20} color="#10B981" />
              <ThemedText style={styles.metricValue}>{personalStats.completedShifts}</ThemedText>
              <ThemedText style={styles.metricLabel}>Gerçekleşen</ThemedText>
            </ThemedView>

            <ThemedView style={styles.metricCard}>
              <Clock size={20} color="#F59E0B" />
              <ThemedText style={styles.metricValue}>{personalStats.totalTime}</ThemedText>
              <ThemedText style={styles.metricLabel}>Toplam Çalışma Süresi</ThemedText>
            </ThemedView>
          </View>

          <ThemedView style={styles.infoCard}>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Ortalama Vardiya Süresi:</ThemedText>
              <ThemedText style={styles.infoValue}>{personalStats.avgTime}</ThemedText>
            </View>
          </ThemedView>

          {/* Recent Shifts list */}
          <ThemedText style={styles.subTitle}>Son Vardiyalar</ThemedText>
          <View style={styles.shiftsList}>
            {personalStats.rawShifts.map((s) => {
              const dateObj = parseISO(s.tarih);
              const worked = s.girisSaati && s.cikisSaati;
              let diffStr = '--';
              if (worked) {
                const diff = new Date(s.cikisSaati!).getTime() - new Date(s.girisSaati!).getTime();
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                diffStr = `${h} sa ${m} dk`;
              }
              return (
                <ThemedView key={s.vardiyaId} style={styles.shiftReportRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.shiftDateText}>
                      {format(dateObj, 'd MMMM yyyy, EEEE', { locale: tr })}
                    </ThemedText>
                    <ThemedText style={styles.shiftTimeRange}>
                      {worked
                        ? `${format(new Date(s.girisSaati!), 'HH:mm')} - ${format(new Date(s.cikisSaati!), 'HH:mm')}`
                        : 'Giriş Yapılmadı'}
                    </ThemedText>
                  </View>
                  <View>
                    <View style={[styles.timeBadge, worked ? styles.timeBadgeWork : styles.timeBadgeOff]}>
                      <ThemedText style={styles.timeBadgeText}>{diffStr}</ThemedText>
                    </View>
                  </View>
                </ThemedView>
              );
            })}
          </View>
        </View>
      )}

      {/* General Manager Workspace Reports */}
      {managerStats && (
        <View style={styles.statsWrapper}>
          <View style={styles.metricsGrid}>
            <ThemedView style={styles.metricCard}>
              <Users size={20} color="#6366F1" />
              <ThemedText style={styles.metricValue}>
                {managerStats.activeStaffCount} / {managerStats.staffCount}
              </ThemedText>
              <ThemedText style={styles.metricLabel}>Aktif Personel</ThemedText>
            </ThemedView>

            <ThemedView style={styles.metricCard}>
              <Calendar size={20} color="#10B981" />
              <ThemedText style={styles.metricValue}>{managerStats.totalShifts}</ThemedText>
              <ThemedText style={styles.metricLabel}>Planlanan Vardiya</ThemedText>
            </ThemedView>

            <ThemedView style={styles.metricCard}>
              <Award size={20} color="#F59E0B" />
              <ThemedText style={styles.metricValue}>{managerStats.completedShifts}</ThemedText>
              <ThemedText style={styles.metricLabel}>Gerçekleşen Vardiya</ThemedText>
            </ThemedView>
          </View>

          <ThemedText style={styles.subTitle}>Personel Çalışma Saatleri (Bu Ay)</ThemedText>
          <View style={styles.staffHoursList}>
            {managerStats.staffList.map((st) => (
              <ThemedView key={st.profileId} style={styles.staffHoursRow}>
                <View style={styles.avatarMini}>
                  <Users size={16} color="#818CF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.staffNameText}>{st.name}</ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.staffHoursText}>{st.timeStr}</ThemedText>
                </View>
              </ThemedView>
            ))}
          </View>
        </View>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: Spacing.five,
  },
  statsWrapper: {
    gap: Spacing.four,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  infoValue: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  shiftsList: {
    gap: Spacing.three,
  },
  shiftReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  shiftDateText: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  shiftTimeRange: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  timeBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeBadgeWork: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  timeBadgeOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#34D399',
  },
  staffHoursList: {
    gap: Spacing.two,
  },
  staffHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  staffNameText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 13,
  },
  staffHoursText: {
    color: '#F59E0B',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
