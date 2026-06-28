import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  Alert
} from 'react-native';
import { useApp } from '../AppContext';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
  User,
  Plus
} from 'lucide-react-native';
import {
  format,
  isSameDay,
  addDays,
  subDays,
  differenceInMinutes
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { getBusinessDate, combineDateAndTime } from '../utils';
import { doc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function DailyTrackingScreen() {
  const { user, activeProfile, staff, shifts, isLoading } = useApp();
  const [selectedDate, setSelectedDate] = useState<Date>(getBusinessDate());
  const [editingRow, setEditingRow] = useState<string | null>(null);
  
  // Local input values for editing
  const [girisSaatiInput, setGirisSaatiInput] = useState('');
  const [cikisSaatiInput, setCikisSaatiInput] = useState('');
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

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

  const handlePrevDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
    setEditingRow(null);
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
    setEditingRow(null);
  };

  const startEditing = (personelId: string) => {
    const shift = dailyShifts.get(personelId);
    setEditingRow(personelId);
    setGirisSaatiInput(shift?.girisSaati ? format(new Date(shift.girisSaati), 'HH:mm') : '');
    setCikisSaatiInput(shift?.cikisSaati ? format(new Date(shift.cikisSaati), 'HH:mm') : '');
  };

  const cancelEditing = () => {
    setEditingRow(null);
  };

  const handleSave = async (personelId: string) => {
    const existingShift = dailyShifts.get(personelId);
    const activeWorkspaceId = activeProfile?.isletmeId;
    const activeBranchId = activeProfile?.subeId || 'merkez';
    if (!activeWorkspaceId) return;

    setSavingStates(prev => ({ ...prev, [personelId]: true }));

    try {
      const parsedGiris = combineDateAndTime(selectedDate, girisSaatiInput);
      const parsedCikis = combineDateAndTime(selectedDate, cikisSaatiInput);

      if (girisSaatiInput && !parsedGiris) {
        Alert.alert('Hata', 'Giriş saati formatı geçersiz (SS:DD olmalı).');
        setSavingStates(prev => ({ ...prev, [personelId]: false }));
        return;
      }
      if (cikisSaatiInput && !parsedCikis) {
        Alert.alert('Hata', 'Çıkış saati formatı geçersiz (SS:DD olmalı).');
        setSavingStates(prev => ({ ...prev, [personelId]: false }));
        return;
      }

      const updateData: any = {};
      if (parsedGiris) {
        updateData.girisSaati = Timestamp.fromDate(parsedGiris);
      } else {
        updateData.girisSaati = null;
      }
      
      if (parsedCikis) {
        updateData.cikisSaati = Timestamp.fromDate(parsedCikis);
      } else {
        updateData.cikisSaati = null;
      }

      if (existingShift) {
        // Update existing shift
        const shiftRef = doc(db, 'shifts', existingShift.vardiyaId);
        await updateDoc(shiftRef, updateData);
      } else {
        // Create new shift record for clock in/out if it didn't exist
        const personnel = staff.find(s => s.personelId === personelId);
        const newShiftPayload = {
          isletmeId: activeWorkspaceId,
          subeId: activeBranchId,
          personelId,
          personelAdi: personnel?.adi || 'Bilinmeyen Personel',
          tarih: Timestamp.fromDate(selectedDate),
          tur: 'calisma',
          planliSureDakika: (personnel?.tanimlananSaat || 8) * 60,
          ...updateData
        };
        await addDoc(collection(db, 'shifts'), newShiftPayload);
      }

      setEditingRow(null);
      Alert.alert('Başarılı', 'Saat değişiklikleri kaydedildi.');
    } catch (error) {
      console.error("Shift update failed:", error);
      Alert.alert('Hata', 'Kayıt yapılırken bir hata oluştu.');
    } finally {
      setSavingStates(prev => ({ ...prev, [personelId]: false }));
    }
  };

  const renderOvertime = (personelId: string) => {
    const shift = dailyShifts.get(personelId);
    if (!shift || shift.tur === 'izinli') return null;

    const giris = shift.girisSaati ? new Date(shift.girisSaati) : undefined;
    let cikis = shift.cikisSaati ? new Date(shift.cikisSaati) : undefined;

    if (!giris || !cikis || !shift.planliSureDakika) {
      return (
        <View style={[styles.badge, styles.badgeOutline]}>
          <Text style={styles.badgeOutlineText}>Eksik Kayıt</Text>
        </View>
      );
    }

    if (cikis < giris) {
      cikis = addDays(cikis, 1);
    }

    const actualDuration = differenceInMinutes(cikis, giris);
    const overtime = actualDuration - shift.planliSureDakika;

    const sign = overtime < 0 ? '-' : '+';
    const absMins = Math.abs(overtime);
    const hours = Math.floor(absMins / 60);
    const minutes = absMins % 60;
    const formatted = `${sign}${hours}s ${minutes}d`;

    if (overtime === 0) {
      return (
        <View style={[styles.badge, styles.badgeSuccess]}>
          <Text style={styles.badgeText}>Zamanında</Text>
        </View>
      );
    }

    return (
      <View style={[styles.badge, overtime > 0 ? styles.badgeWarning : styles.badgeDanger]}>
        <Text style={styles.badgeText}>{formatted}</Text>
      </View>
    );
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
      {/* Date Navigation Stepper */}
      <View style={styles.dateStepper}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.stepperButton}>
          <ChevronLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        
        <View style={styles.dateLabelContainer}>
          <Calendar size={18} color="#6366F1" style={{ marginRight: 8 }} />
          <ThemedText style={styles.dateText}>
            {format(selectedDate, 'd MMMM yyyy, EEEE', { locale: tr })}
          </ThemedText>
        </View>

        <TouchableOpacity onPress={handleNextDay} style={styles.stepperButton}>
          <ChevronRight size={24} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      {/* Staff Shift Tracking List */}
      {visibleStaff.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>Şubenizde aktif personel bulunamadı.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={visibleStaff}
          keyExtractor={item => item.personelId}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const shift = dailyShifts.get(item.personelId);
            const isEditing = editingRow === item.personelId;
            const isSaving = savingStates[item.personelId] || false;

            return (
              <View style={styles.staffCard}>
                {/* Employee Row info */}
                <View style={styles.cardHeader}>
                  <View style={styles.avatarPlaceholder}>
                    <User size={20} color="#94A3B8" />
                  </View>
                  <View style={styles.staffDetails}>
                    <ThemedText style={styles.staffName}>{item.adi}</ThemedText>
                    <ThemedText style={styles.staffRole}>
                      {shift?.tur === 'izinli' ? 'İzin günü' : `Planlanan: ${shift?.planliGiris ? format(new Date(shift.planliGiris), 'HH:mm') : 'Girilmemiş'} (${item.tanimlananSaat} saat)`}
                    </ThemedText>
                  </View>
                  <View>
                    {renderOvertime(item.personelId)}
                  </View>
                </View>

                {/* Edit Form or Display Hours */}
                {isEditing ? (
                  <View style={styles.editForm}>
                    <View style={styles.inputGroup}>
                      <View style={styles.inputField}>
                        <ThemedText style={styles.inputLabel}>Giriş</ThemedText>
                        <TextInput
                          style={styles.timeInput}
                          placeholder="09:00"
                          placeholderTextColor="#64748B"
                          value={girisSaatiInput}
                          onChangeText={setGirisSaatiInput}
                          maxLength={5}
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                      <View style={styles.inputField}>
                        <ThemedText style={styles.inputLabel}>Çıkış</ThemedText>
                        <TextInput
                          style={styles.timeInput}
                          placeholder="17:00"
                          placeholderTextColor="#64748B"
                          value={cikisSaatiInput}
                          onChangeText={setCikisSaatiInput}
                          maxLength={5}
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                    </View>

                    {/* Actions buttons */}
                    <View style={styles.formActions}>
                      <TouchableOpacity
                        onPress={() => handleSave(item.personelId)}
                        disabled={isSaving}
                        style={[styles.actionButton, styles.saveButton]}
                      >
                        {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Check size={18} color="#fff" />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={cancelEditing}
                        style={[styles.actionButton, styles.cancelButton]}
                      >
                        <X size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.hoursDisplay}>
                    <View style={styles.hourItem}>
                      <Clock size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.hourValue}>
                        Giriş: {shift?.girisSaati ? format(new Date(shift.girisSaati), 'HH:mm') : '--:--'}
                      </ThemedText>
                    </View>
                    <View style={styles.hourItem}>
                      <Clock size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                      <ThemedText style={styles.hourValue}>
                        Çıkış: {shift?.cikisSaati ? format(new Date(shift.cikisSaati), 'HH:mm') : '--:--'}
                      </ThemedText>
                    </View>
                    
                    {shift?.tur !== 'izinli' && (
                      <TouchableOpacity
                        onPress={() => startEditing(item.personelId)}
                        style={styles.editButton}
                      >
                        <Pencil size={16} color="#6366F1" />
                      </TouchableOpacity>
                    )}
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
  dateStepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    margin: Spacing.four,
    borderRadius: 16,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  dateLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 14,
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
  staffCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 18,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: Spacing.three,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.three,
  },
  staffDetails: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  staffRole: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
  },
  badgeDanger: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  },
  badgeOutline: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  badgeOutlineText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  badgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: 'bold',
  },
  hoursDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
  hourItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.six,
  },
  hourValue: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  editButton: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editForm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: Spacing.four,
    flex: 1,
  },
  inputField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: Spacing.two,
    height: 36,
    fontSize: 13,
    textAlign: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginLeft: Spacing.four,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
});
