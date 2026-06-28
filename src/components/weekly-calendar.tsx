import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, startOfWeek, addDays, isSameDay, subWeeks, addWeeks } from 'date-fns';
import { tr } from 'date-fns/locale';

interface WeeklyCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function WeeklyCalendar({ selectedDate, onSelectDate }: WeeklyCalendarProps) {
  // Get start of the week for the selectedDate (Monday as first day of week)
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

  // Generate 7 days of the week
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handlePrevWeek = () => {
    onSelectDate(subWeeks(selectedDate, 1));
  };

  const handleNextWeek = () => {
    onSelectDate(addWeeks(selectedDate, 1));
  };

  return (
    <View style={styles.container}>
      {/* Month & Year header with navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevWeek} style={styles.navButton}>
          <ChevronLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        
        <ThemedText style={styles.monthText}>
          {format(selectedDate, 'LLLL yyyy', { locale: tr }).toUpperCase()}
        </ThemedText>

        <TouchableOpacity onPress={handleNextWeek} style={styles.navButton}>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* 7-day strip */}
      <View style={styles.daysRow}>
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const dayName = format(day, 'E', { locale: tr }); // Short day name (Pzt, Sal, etc.)
          const dayNumber = format(day, 'd');

          return (
            <TouchableOpacity
              key={day.toString()}
              onPress={() => onSelectDate(day)}
              style={[
                styles.dayButton,
                isSelected && styles.dayButtonSelected
              ]}
            >
              <ThemedText style={[
                styles.dayNameText,
                isSelected && styles.dayNameTextSelected
              ]}>
                {dayName}
              </ThemedText>
              <ThemedText style={[
                styles.dayNumberText,
                isSelected && styles.dayNumberTextSelected
              ]}>
                {dayNumber}
              </ThemedText>
              {isSelected && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  navButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  monthText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
  },
  dayButtonSelected: {
    backgroundColor: '#6366F1', // Indigo 500
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dayNameTextSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dayNumberText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  dayNumberTextSelected: {
    color: '#FFFFFF',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  }
});
