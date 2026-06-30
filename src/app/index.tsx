import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
  Image,
  Alert,
  Modal,
  TextInput,
  Share
} from 'react-native';
import { useApp } from '../AppContext';
import { WeeklyCalendar } from '../components/weekly-calendar';
import { UserProfile } from '../types';
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
  TrendingUp,
  Settings,
  Plus,
  ToggleLeft,
  ToggleRight,
  Briefcase,
  Share2,
  ChevronDown
} from 'lucide-react-native';
import {
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  differenceInMinutes,
  addDays,
  format,
  isSameDay,
  startOfDay
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { getBusinessDate } from '../utils';
import { doc, updateDoc, Timestamp, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
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
  const { user, firebaseUser, profiles, activeProfile, setActiveProfile, refreshProfiles, staff, shifts, workspaces, branches, isLoading } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date>(getBusinessDate());
  const [clockLoading, setClockLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Durum kontrol ediliyor...');
  // Switcher states removed (profile lists are now on their own screen)
  const router = useRouter();

  const today = getBusinessDate();

  // Find user's employee record
  const self = useMemo(() => {
    if (!user) return null;
    return staff.find(s => s.email.toLowerCase() === user.email.toLowerCase());
  }, [staff, user]);

  // Find user's workspace/branch name
  const userBranchName = useMemo(() => {
    if (!activeProfile) return 'Profil Yok';
    const workspace = workspaces.find(w => w.isletmeId === activeProfile.isletmeId);
    const workspaceName = workspace ? workspace.adi : 'Kişisel';
    
    if (activeProfile.rol === 'bireysel') {
      return workspaceName;
    }
    
    if (workspace?.cokSubeli && activeProfile.subeId) {
      const branch = branches.find(b => b.subeId === activeProfile.subeId);
      return `${workspaceName} - ${branch ? branch.adi : 'Genel'}`;
    }
    
    return workspaceName;
  }, [workspaces, branches, activeProfile]);

  // Join code display and share moved to Settings Screen (explore.tsx)

  // Selected day's shift for this employee
  const todaysShift = useMemo(() => {
    if (!self) return undefined;
    return shifts.find(s => 
      s.personelId === self.personelId && 
      isSameDay(new Date(s.tarih), selectedDate)
    );
  }, [shifts, self, selectedDate]);

  const isActualToday = isSameDay(selectedDate, getBusinessDate());
  const canClockIn = isActualToday && todaysShift && todaysShift.tur === 'calisma' && !todaysShift.girisSaati;
  const canClockOut = isActualToday && todaysShift && todaysShift.girisSaati && !todaysShift.cikisSaati;

  useEffect(() => {
    const isActualToday = isSameDay(selectedDate, getBusinessDate());
    const dayLabel = isActualToday ? 'Bugün' : format(selectedDate, 'EEEE', { locale: tr });

    if (todaysShift) {
      if (todaysShift.tur === 'izinli') {
        setStatusMessage(`${dayLabel} izinlisiniz.`);
      } else if (todaysShift.girisSaati && !todaysShift.cikisSaati) {
        setStatusMessage(`Giriş yapıldı: ${format(new Date(todaysShift.girisSaati), 'HH:mm')}`);
      } else if (todaysShift.girisSaati && todaysShift.cikisSaati) {
        setStatusMessage(`${dayLabel}ki vardiyanız tamamlandı.`);
      } else {
        if (todaysShift.planliGiris) {
          setStatusMessage(`Vardiyanız saat ${format(new Date(todaysShift.planliGiris), 'HH:mm')}'da başlıyor. Giriş yapabilirsiniz.`);
        } else {
          setStatusMessage(`${dayLabel} için giriş yapmaya hazırsınız.`);
        }
      }
    } else {
      setStatusMessage(`${dayLabel} için planlanmış bir vardiyanız yok.`);
    }
  }, [todaysShift, selectedDate]);

  const pendingShifts = useMemo(() => {
    if (!self) return [];
    return shifts.filter(s => 
      s.personelId === self.personelId && 
      s.durum === 'beklemede' &&
      new Date(s.tarih) >= startOfDay(getBusinessDate())
    );
  }, [shifts, self]);

  const handleShiftApproval = async (shiftId: string, status: 'onaylandi' | 'reddedildi') => {
    try {
      const shiftRef = doc(db, 'shifts', shiftId);
      await updateDoc(shiftRef, { durum: status });
      Alert.alert('Başarılı', status === 'onaylandi' ? 'Vardiya onaylandı.' : 'Vardiya reddedildi.');
    } catch (error) {
      console.error("Vardiya onay durumu güncellenemedi:", error);
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
    }
  };

  // Profile switcher active toggles and profile creation handlers moved to profiles.tsx screen

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
    
    // Scheduled for selected date
    const todaysBranchShifts = shifts.filter(s => isSameDay(new Date(s.tarih), selectedDate));
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
  }, [shifts, selectedDate, user]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const branchStatsTitle = useMemo(() => {
    if (isActualToday) return 'Bugünkü Şube Durumu';
    return `${format(selectedDate, 'd MMMM', { locale: tr })} Şube Durumu`;
  }, [selectedDate, isActualToday]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.container}>
      {/* Header Profile Greeting */}
      <TouchableOpacity onPress={() => router.push('/profiles' as any)} style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: user?.avatar || 'https://picsum.photos/seed/restaurant/100/100' }}
            style={styles.avatar}
          />
          <View style={styles.profileDetails}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ThemedText style={styles.userName}>{user?.name}</ThemedText>
              <ChevronDown size={16} color="#94A3B8" style={{ marginLeft: 6 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <ThemedText style={styles.userRole}>
                {activeProfile?.title || 'Profil Seçilmedi'}
              </ThemedText>
              <View style={[
                styles.roleLabelBadge,
                activeProfile?.rol === 'genel-mudur' ? styles.roleBadgeManager : activeProfile?.rol === 'calisan' ? styles.roleBadgeEmployee : styles.roleBadgePersonal
              ]}>
                <ThemedText style={styles.roleLabelText}>
                  {activeProfile?.rol === 'genel-mudur' ? 'İşletme' : activeProfile?.rol === 'calisan' ? 'Çalışan' : 'Bireysel'}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.userBranch}>{userBranchName}</ThemedText>
          </View>
        </View>
      </TouchableOpacity>

      {/* Weekly Visual Calendar Strip */}
      <WeeklyCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Shift Approval Card */}
      {self && pendingShifts.length > 0 && (
        <View style={styles.approvalCard}>
          <View style={styles.approvalHeader}>
            <Calendar size={20} color="#FBBF24" />
            <ThemedText style={styles.approvalTitle}>Yeni Vardiya Talebi</ThemedText>
          </View>
          <ThemedText style={styles.approvalText}>
            {format(new Date(pendingShifts[0].tarih), 'd MMMM yyyy, EEEE', { locale: tr })} tarihindeki vardiyanız onayınızı bekliyor.
          </ThemedText>
          <View style={styles.approvalButtons}>
            <TouchableOpacity
              onPress={() => handleShiftApproval(pendingShifts[0].vardiyaId, 'onaylandi')}
              style={[styles.approvalBtn, styles.approveBtn]}
            >
              <ThemedText style={styles.approvalBtnText}>Onayla</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleShiftApproval(pendingShifts[0].vardiyaId, 'reddedildi')}
              style={[styles.approvalBtn, styles.rejectBtn]}
            >
              <ThemedText style={styles.approvalBtnText}>Reddet</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
      {self && (self.rol === 'calisan' || self.rol === 'bireysel') && (
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

      {/* Join code display moved to Settings tab */}

      {/* Manager Branch Stats Panel */}
      {branchStats && (
        <View style={styles.managerPanel}>
          <ThemedText style={styles.sectionTitle}>{branchStatsTitle}</ThemedText>
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
  roleLabelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  roleBadgeManager: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  roleBadgeEmployee: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  roleBadgePersonal: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  roleLabelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  switchProfileButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  codeCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    padding: Spacing.six,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing.four,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  codeCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginLeft: 8,
  },
  codeDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: Spacing.three,
    lineHeight: 18,
  },
  codeContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#818CF8',
    letterSpacing: 2,
  },
  approvalCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 24,
    padding: Spacing.five,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    marginBottom: Spacing.four,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FBBF24',
    marginLeft: 8,
  },
  approvalText: {
    fontSize: 14,
    color: '#F8FAFC',
    marginBottom: Spacing.four,
    lineHeight: 20,
  },
  approvalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  approvalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: Spacing.one,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  approvalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  modalCloseButton: {
    padding: 4,
  },
  profilesList: {
    marginBottom: 16,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  profileItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  profileItemPressable: {
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  profileItemTitleActive: {
    color: '#818CF8',
    fontWeight: 'bold',
  },
  profileItemSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  profileItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleActiveButton: {
    padding: 8,
  },
  addProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 14,
    height: 48,
    marginTop: 8,
  },
  addProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chooseContainer: {
    paddingVertical: 8,
  },
  chooseLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  chooseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  chooseOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  chooseOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  formContainer: {
    paddingVertical: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 14,
    marginBottom: 16,
  },
  saveProfileBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveProfileBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  shareCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 40,
    marginTop: 12,
  },
  shareCodeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
