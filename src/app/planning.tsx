import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Platform,
  Alert,
  Share
} from 'react-native';
import { useApp } from '../AppContext';
import { WeeklyCalendar } from '../components/weekly-calendar';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Save,
  Edit2,
  X,
  Share2,
  CheckCircle2,
  Coffee,
  Briefcase
} from 'lucide-react-native';
import {
  format,
  isSameDay,
  addDays,
  subDays,
  startOfDay
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { getBusinessDate, combineDateAndTime } from '../utils';
import { doc, collection, writeBatch, Timestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

export default function ShiftPlanningScreen() {
  const { user, activeProfile, staff, shifts, isLoading } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date>(getBusinessDate());
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [shiftData, setShiftData] = useState<Record<string, { tur: 'calisma' | 'izinli'; planliGiris: string }>>({});

  const activeWorkspaceId = useMemo(() => {
    return activeProfile?.isletmeId || 'default-isletme';
  }, [activeProfile]);

  const activeBranchId = useMemo(() => {
    return activeProfile?.subeId || 'merkez';
  }, [activeProfile]);

  const visibleStaff = useMemo(() => {
    if (!activeProfile || activeProfile.rol === 'calisan' || activeProfile.rol === 'bireysel') return [];
    return staff.filter(s => s.isletmeId === activeProfile.isletmeId && s.personelId !== activeProfile.profileId && s.aktif !== false);
  }, [activeProfile, staff]);

  const dailyShifts = useMemo(() => {
    const shiftsForDay = shifts.filter(s => s.tarih && isSameDay(new Date(s.tarih), selectedDate));
    const shiftMap = new Map<string, any>();
    shiftsForDay.forEach(s => shiftMap.set(s.personelId, s));
    return shiftMap;
  }, [shifts, selectedDate]);

  // Sync state from dailyShifts
  useEffect(() => {
    const newShiftData: typeof shiftData = {};
    visibleStaff.forEach(personel => {
      const shift = dailyShifts.get(personel.personelId);
      newShiftData[personel.personelId] = {
        tur: shift?.tur || 'calisma',
        planliGiris: shift?.planliGiris ? format(new Date(shift.planliGiris), 'HH:mm') : '09:00',
      };
    });
    setShiftData(newShiftData);
  }, [visibleStaff, dailyShifts, isEditing]);

  const handleShiftDataChange = (personelId: string, field: 'tur' | 'planliGiris', value: string) => {
    setShiftData(prev => ({
      ...prev,
      [personelId]: {
        ...prev[personelId],
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    if (!activeWorkspaceId) return;
    setIsSaving(true);
    const batch = writeBatch(db);

    for (const personel of visibleStaff) {
      const personelId = personel.personelId;
      const data = shiftData[personelId];
      if (!data) continue;

      const existingShift = dailyShifts.get(personelId);

      const shiftPayload: any = {
        isletmeId: activeWorkspaceId,
        subeId: activeBranchId,
        personelId: personel.personelId,
        personelAdi: personel.adi,
        tarih: Timestamp.fromDate(startOfDay(selectedDate)),
        tur: data.tur,
        planliSureDakika: (personel.tanimlananSaat || 8) * 60,
        durum: existingShift?.durum || 'beklemede',
      };

      if (data.tur === 'calisma') {
        const combinedDate = combineDateAndTime(selectedDate, data.planliGiris);
        if (!combinedDate) {
          Alert.alert('Hata', `${personel.adi} için geçersiz saat formatı.`);
          setIsSaving(false);
          return;
        }
        shiftPayload.planliGiris = Timestamp.fromDate(combinedDate);
      } else {
        shiftPayload.planliGiris = deleteField();
        shiftPayload.girisSaati = deleteField();
        shiftPayload.cikisSaati = deleteField();
      }

      if (existingShift) {
        const shiftRef = doc(db, 'shifts', existingShift.vardiyaId);
        batch.update(shiftRef, shiftPayload);
      } else {
        const newShiftRef = doc(collection(db, 'shifts'));
        shiftPayload.vardiyaId = newShiftRef.id;
        batch.set(newShiftRef, shiftPayload, { merge: true });
      }
    }

    try {
      await batch.commit();
      setIsEditing(false);
      Alert.alert('Başarılı', 'Günün vardiya planı başarıyla kaydedildi.');
    } catch (error) {
      console.error("Batch save failed:", error);
      Alert.alert('Hata', 'Vardiya planı kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    let text = `**Vardiya Planı - ${format(selectedDate, 'd MMMM yyyy, EEEE', { locale: tr })}**\n\n`;
    
    visibleStaff.forEach(personel => {
      const shift = dailyShifts.get(personel.personelId);
      text += `- ${personel.adi}: `;
      if (shift?.tur === 'izinli') {
        text += `İzinli\n`;
      } else if (shift?.planliGiris) {
        text += `${format(new Date(shift.planliGiris), 'HH:mm')}\n`;
      } else {
        text += `Tanımsız\n`;
      }
    });

    try {
      await Share.share({
        message: text,
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WeeklyCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <View style={styles.actionHeader}>
        {isEditing ? (
          <View style={styles.editingActions}>
            <TouchableOpacity
              onPress={handleSaveAll}
              disabled={isSaving}
              style={[styles.btn, styles.btnSave, isSaving && styles.btnDisabled]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Save size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.btnText}>Kaydet</ThemedText>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setIsEditing(false)}
              style={[styles.btn, styles.btnCancel]}
            >
              <X size={16} color="#fff" style={{ marginRight: 6 }} />
              <ThemedText style={styles.btnText}>Vazgeç</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.editingActions}>
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={[styles.btn, styles.btnEdit]}
            >
              <Edit2 size={16} color="#fff" style={{ marginRight: 6 }} />
              <ThemedText style={styles.btnText}>Planı Düzenle</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              style={[styles.btn, styles.btnShare]}
            >
              <Share2 size={16} color="#fff" style={{ marginRight: 6 }} />
              <ThemedText style={styles.btnText}>Planı Paylaş</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {visibleStaff.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>Planlanacak aktif personel bulunamadı.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={visibleStaff}
          keyExtractor={item => item.personelId}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const currentData = shiftData[item.personelId] || { tur: 'calisma', planliGiris: '09:00' };
            const existingShift = dailyShifts.get(item.personelId);

            return (
              <View style={styles.plannerCard}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.staffName}>{item.adi}</ThemedText>
                  <ThemedText style={styles.staffMeta}>Haftalık T.: {item.tanimlananSaat} saat</ThemedText>
                </View>

                {isEditing ? (
                  <View style={styles.editSection}>
                    <View style={styles.toggleGroup}>
                      <TouchableOpacity
                        onPress={() => handleShiftDataChange(item.personelId, 'tur', 'calisma')}
                        style={[
                          styles.toggleButton,
                          currentData.tur === 'calisma' && styles.toggleButtonActive
                        ]}
                      >
                        <Briefcase size={14} color={currentData.tur === 'calisma' ? '#fff' : '#64748B'} style={{ marginRight: 4 }} />
                        <Text style={[styles.toggleText, currentData.tur === 'calisma' && styles.toggleTextActive]}>
                          Çalışıyor
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleShiftDataChange(item.personelId, 'tur', 'izinli')}
                        style={[
                          styles.toggleButton,
                          currentData.tur === 'izinli' && styles.toggleButtonActiveLeave
                        ]}
                      >
                        <Coffee size={14} color={currentData.tur === 'izinli' ? '#fff' : '#64748B'} style={{ marginRight: 4 }} />
                        <Text style={[styles.toggleText, currentData.tur === 'izinli' && styles.toggleTextActive]}>
                          İzinli
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {currentData.tur === 'calisma' && (
                      <View style={styles.timeInputContainer}>
                        <Clock size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                        <TextInput
                          style={styles.timeInput}
                          value={currentData.planliGiris}
                          onChangeText={(val) => handleShiftDataChange(item.personelId, 'planliGiris', val)}
                          placeholder="09:00"
                          placeholderTextColor="#64748B"
                          maxLength={5}
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.displaySection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {currentData.tur === 'izinli' ? (
                        <View style={[styles.badge, styles.badgeOff]}>
                          <Coffee size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                          <Text style={styles.badgeTextOff}>İzinli</Text>
                        </View>
                      ) : (
                        <View style={[styles.badge, styles.badgeWork]}>
                          <Clock size={12} color="#818CF8" style={{ marginRight: 4 }} />
                          <Text style={styles.badgeTextWork}>Giriş: {currentData.planliGiris}</Text>
                        </View>
                      )}

                      {existingShift && (
                        <View style={[
                          styles.statusBadge,
                          existingShift.durum === 'onaylandi' && styles.statusBadgeApproved,
                          existingShift.durum === 'reddedildi' && styles.statusBadgeRejected,
                          existingShift.durum === 'beklemede' && styles.statusBadgePending
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            existingShift.durum === 'onaylandi' && styles.statusBadgeTextApproved,
                            existingShift.durum === 'reddedildi' && styles.statusBadgeTextRejected,
                            existingShift.durum === 'beklemede' && styles.statusBadgeTextPending
                          ]}>
                            {existingShift.durum === 'onaylandi' ? 'Onaylandı' : existingShift.durum === 'reddedildi' ? 'Reddedildi' : 'Beklemede'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
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
  actionHeader: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  editingActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnEdit: {
    backgroundColor: '#6366F1',
  },
  btnSave: {
    backgroundColor: '#10B981',
  },
  btnCancel: {
    backgroundColor: '#EF4444',
  },
  btnShare: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  btnDisabled: {
    backgroundColor: 'rgba(71, 85, 105, 0.5)',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.six,
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  plannerCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  staffName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  staffMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  editSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 10,
    padding: 3,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#6366F1',
  },
  toggleButtonActiveLeave: {
    backgroundColor: '#EF4444',
  },
  toggleText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    width: 90,
    height: 36,
  },
  timeInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    textAlign: 'center',
  },
  noShiftsText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusBadgeTextApproved: {
    color: '#10B981',
  },
  statusBadgeRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusBadgeTextRejected: {
    color: '#EF4444',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  statusBadgeTextPending: {
    color: '#FBBF24',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  displaySection: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  badgeWork: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  badgeTextOff: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextWork: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '600',
  },
});
