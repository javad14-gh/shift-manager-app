import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
  Image
} from 'react-native';
import { useApp } from '../AppContext';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  Clock,
  User,
  Calendar,
  LogIn,
  LogOut,
  MapPin,
  Users,
  Award,
  ArrowRight,
  TrendingUp
} from 'lucide-react-native';
import {
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  differenceInMinutes,
  addDays,
  format,
  isSameDay
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { getBusinessDate } from '../utils';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useRouter } from 'expo-router';

// Calculate overtime helper
const calculateOvertimeForShifts = (shifts: any[]): string => {
  let totalOvertimeMinutes = 0;
  shifts.forEach(shift => {
    if (shift.tur === 'calisma' && shift.girisSaati && shift.cikisSaati && shift.planliSureDakika) {
      let giris = new Date(shift.girisSaati);
      let cikis = new Date(shift.cikisSaati);
      if (cikis < giris) cikis = addDays(cikis, 1);
      const durationMinutes = differenceInMinutes(cikis, giris);
      totalOvertimeMinutes += durationMinutes - shift.planliSureDakika;
    }
  });

  const sign = totalOvertimeMinutes < 0 ? '-' : '+';
  const absMins = Math.abs(totalOvertimeMinutes);
  const hours = Math.floor(absMins / 60);
  const minutes = absMins % 60;
  return `${sign}${hours} sa ${minutes} dk`;
};

export default function HomeScreen() {
  const { user, staff, shifts, branches, isLoading } = useApp();
  const [clockLoading, setClockLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Durum kontrol ediliyor...');
  const router = useRouter();

  const today = getBusinessDate();

  // Find user's employee record
  const self = useMemo(() => {
    if (!user) return null;
    return staff.find(s => s.email.toLowerCase() === user.email.toLowerCase());
  }, [staff, user]);

  // Find user's branch
  const userBranchName = useMemo(() => {
    if (!user?.branchId) return 'Genel Merkez';
    const branch = branches.find(b => b.subeId === user.branchId);
    return branch ? branch.adi : 'Şube Bilgisi Yok';
  }, [branches, user]);

  // Today's shift for this employee
  const todaysShift = useMemo(() => {
    if (!self) return undefined;
    return shifts.find(s => 
      s.personelId === self.personelId && 
      isSameDay(new Date(s.tarih), today)
    );
  }, [shifts, self, today]);

  const canClockIn = todaysShift && todaysShift.tur === 'calisma' && !todaysShift.girisSaati;
  const canClockOut = todaysShift && todaysShift.girisSaati && !todaysShift.cikisSaati;

  useEffect(() => {
    if (todaysShift) {
      if (todaysShift.tur === 'izinli') {
        setStatusMessage('Bugün izinlisiniz.');
      } else if (todaysShift.girisSaati && !todaysShift.cikisSaati) {
        setStatusMessage(`Giriş yapıldı: ${format(new Date(todaysShift.girisSaati), 'HH:mm')}`);
      } else if (todaysShift.girisSaati && todaysShift.cikisSaati) {
        setStatusMessage('Bugünkü vardiyanız tamamlandı.');
      } else {
        if (todaysShift.planliGiris) {
          setStatusMessage(`Vardiyanız saat ${format(new Date(todaysShift.planliGiris), 'HH:mm')}'da başlıyor. Giriş yapabilirsiniz.`);
        } else {
          setStatusMessage('Bugün için giriş yapmaya hazırsınız.');
        }
      }
    } else {
      setStatusMessage('Bugün için planlanmış bir vardiyanız yok.');
    }
  }, [todaysShift]);

  // Handles clock in/out action
  const handleClockAction = async (action: 'in' | 'out') => {
    if (!todaysShift) return;
    setClockLoading(true);
    try {
      const shiftRef = doc(db, 'shifts', todaysShift.vardiyaId);
      const now = new Date();
      if (action === 'in') {
        await updateDoc(shiftRef, { girisSaati: Timestamp.fromDate(now) });
      } else {
        await updateDoc(shiftRef, { cikisSaati: Timestamp.fromDate(now) });
      }
    } catch (error) {
      console.error("Giriş/Çıkış kaydedilemedi:", error);
    } finally {
      setClockLoading(false);
    }
  };

  // Monthly Overtime calculation
  const monthlyOvertime = useMemo(() => {
    if (!self) return '0 sa';
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const userShifts = shifts.filter(s => 
      s.personelId === self.personelId && 
      s.tarih && 
      isWithinInterval(new Date(s.tarih), { start: monthStart, end: monthEnd })
    );

    return calculateOvertimeForShifts(userShifts);
  }, [shifts, self]);

  // Upcoming shifts for employee
  const upcomingShifts = useMemo(() => {
    if (!self) return [];
    return shifts
      .filter(s => s.personelId === self.personelId && new Date(s.tarih) >= today)
      .sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime())
      .slice(0, 5);
  }, [shifts, self, today]);

  // Branch statistics for manager
  const branchStats = useMemo(() => {
    if (user?.role !== 'sube-muduru' && user?.role !== 'genel-mudur') return null;
    
    // Scheduled today
    const todaysBranchShifts = shifts.filter(s => isSameDay(new Date(s.tarih), today));
    const workingToday = todaysBranchShifts.filter(s => s.tur === 'calisma');
    const offToday = todaysBranchShifts.filter(s => s.tur === 'izinli');
    const checkedInToday = workingToday.filter(s => s.girisSaati);
    const completedToday = workingToday.filter(s => s.girisSaati && s.cikisSaati);

    return {
      scheduled: workingToday.length,
      active: checkedInToday.length - completedToday.length,
      off: offToday.length,
      completed: completedToday.length
    };
  }, [shifts, today, user]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.container}>
      {/* Header Profile Greeting */}
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: user?.avatar || 'https://picsum.photos/seed/restaurant/100/100' }}
            style={styles.avatar}
          />
          <View style={styles.profileDetails}>
            <ThemedText style={styles.userName}>{user?.name}</ThemedText>
            <ThemedText style={styles.userRole}>
              {user?.role === 'genel-mudur' ? 'Genel Müdür' : user?.role === 'sube-muduru' ? 'Şube Müdürü' : user?.role === 'bireysel' ? 'Bireysel Kullanıcı' : 'Çalışan'}
            </ThemedText>
            <ThemedText style={styles.userBranch}>{userBranchName}</ThemedText>
          </View>
        </View>
      </View>

      {/* Overtime Statistic Box */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <TrendingUp size={24} color="#6366F1" style={styles.statIcon} />
          <View>
            <ThemedText style={styles.statLabel}>Bu Ayki Fazla Mesai</ThemedText>
            <ThemedText style={styles.statValue}>{monthlyOvertime}</ThemedText>
          </View>
        </View>
      </View>

      {/* Clock In / Out Area */}
      {self && self.rol === 'calisan' && (
        <View style={styles.clockCard}>
          <View style={styles.clockCardHeader}>
            <MapPin size={20} color="#818CF8" />
            <ThemedText style={styles.clockCardTitle}>Hızlı Giriş / Çıkış</ThemedText>
          </View>
          <ThemedText style={styles.clockStatusText}>{statusMessage}</ThemedText>
          <View style={styles.clockButtons}>
            <TouchableOpacity
              onPress={() => handleClockAction('in')}
              disabled={!canClockIn || clockLoading}
              style={[styles.clockButton, styles.clockInButton, !canClockIn && styles.buttonDisabled]}
            >
              <LogIn size={20} color="#fff" style={{ marginRight: 8 }} />
              <ThemedText style={styles.clockButtonText}>Giriş Yap</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClockAction('out')}
              disabled={!canClockOut || clockLoading}
              style={[styles.clockButton, styles.clockOutButton, !canClockOut && styles.buttonDisabled]}
            >
              <LogOut size={20} color="#fff" style={{ marginRight: 8 }} />
              <ThemedText style={styles.clockButtonText}>Çıkış Yap</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Manager Branch Stats Panel */}
      {branchStats && (
        <View style={styles.managerPanel}>
          <ThemedText style={styles.sectionTitle}>Bugünkü Şube Durumu</ThemedText>
          <View style={styles.statsGrid}>
            <View style={styles.gridItem}>
              <Users size={24} color="#60A5FA" />
              <ThemedText style={styles.gridValue}>{branchStats.scheduled}</ThemedText>
              <ThemedText style={styles.gridLabel}>Planlanan</ThemedText>
            </View>
            <View style={styles.gridItem}>
              <Clock size={24} color="#34D399" />
              <ThemedText style={styles.gridValue}>{branchStats.active}</ThemedText>
              <ThemedText style={styles.gridLabel}>Aktif Çalışan</ThemedText>
            </View>
            <View style={styles.gridItem}>
              <Calendar size={24} color="#FB923C" />
              <ThemedText style={styles.gridValue}>{branchStats.off}</ThemedText>
              <ThemedText style={styles.gridLabel}>İzinli</ThemedText>
            </View>
          </View>

          {/* Quick Manager Navigation Links */}
          <TouchableOpacity
            style={styles.navLink}
            onPress={() => router.push('/daily-tracking')}
          >
            <View style={styles.navLinkLeft}>
              <Clock size={20} color="#6366F1" />
              <ThemedText style={styles.navLinkText}>Günlük Takip Sayfasına Git</ThemedText>
            </View>
            <ArrowRight size={20} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navLink}
            onPress={() => router.push('/planning')}
          >
            <View style={styles.navLinkLeft}>
              <Calendar size={20} color="#6366F1" />
              <ThemedText style={styles.navLinkText}>Vardiya Planlama Sayfasına Git</ThemedText>
            </View>
            <ArrowRight size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {/* Upcoming Shifts List for Employee */}
      {self && self.rol === 'calisan' && (
        <View style={styles.shiftsPanel}>
          <ThemedText style={styles.sectionTitle}>Vardiyalarım</ThemedText>
          {upcomingShifts.length === 0 ? (
            <ThemedText style={styles.noShiftsText}>Planlanmış gelecek vardiyanız bulunmuyor.</ThemedText>
          ) : (
            <FlatList
              data={upcomingShifts}
              scrollEnabled={false}
              keyExtractor={item => item.vardiyaId}
              renderItem={({ item }) => {
                const shiftDate = new Date(item.tarih);
                const isToday = isSameDay(shiftDate, today);
                return (
                  <View style={[styles.shiftItem, isToday && styles.shiftItemToday]}>
                    <View style={styles.shiftItemLeft}>
                      <Calendar size={18} color={isToday ? '#6366F1' : '#94A3B8'} style={{ marginRight: 8 }} />
                      <ThemedText style={styles.shiftItemDate}>
                        {format(shiftDate, 'd MMMM yyyy, EEEE', { locale: tr })}
                      </ThemedText>
                    </View>
                    <View style={styles.shiftItemRight}>
                      {item.tur === 'izinli' ? (
                        <View style={[styles.badge, styles.badgeOff]}>
                          <ThemedText style={styles.badgeText}>İzinli</ThemedText>
                        </View>
                      ) : (
                        <View style={[styles.badge, styles.badgeWork]}>
                          <ThemedText style={styles.badgeText}>
                            {item.planliGiris ? format(new Date(item.planliGiris), 'HH:mm') : '--:--'}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    padding: Spacing.four,
    paddingBottom: 80,
  },
  profileCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: Spacing.four,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.four,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  userRole: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 2,
  },
  userBranch: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statRow: {
    marginBottom: Spacing.four,
  },
  statCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: Spacing.four,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginTop: 2,
  },
  clockCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 20,
    padding: Spacing.five,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    marginBottom: Spacing.five,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  clockCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  clockCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginLeft: Spacing.two,
  },
  clockStatusText: {
    fontSize: 16,
    color: '#F8FAFC',
    textAlign: 'center',
    paddingVertical: Spacing.three,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 12,
    marginBottom: Spacing.four,
  },
  clockButtons: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  clockButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockInButton: {
    backgroundColor: '#34D399', // Green
  },
  clockOutButton: {
    backgroundColor: '#6366F1', // Indigo
  },
  buttonDisabled: {
    backgroundColor: 'rgba(71, 85, 105, 0.5)',
  },
  clockButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  managerPanel: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: Spacing.three,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  gridItem: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderRadius: 14,
    padding: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  gridValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginTop: Spacing.two,
  },
  gridLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  navLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  navLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navLinkText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: Spacing.two,
  },
  shiftsPanel: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  noShiftsText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  shiftItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  shiftItemToday: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  shiftItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftItemDate: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  shiftItemRight: {},
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  badgeWork: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
});
