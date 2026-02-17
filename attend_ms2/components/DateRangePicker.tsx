import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import { Calendar, ChevronDown } from 'lucide-react-native';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import { formatDateLocal, parseDateLocal } from '@/lib/date';

type DateRange = {
  startDate: string;
  endDate: string;
};

type DateRangePickerProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabledDates?: string[];
  publicHolidays?: string[];
};

const DateRangePicker = ({ value, onChange, disabledDates = [], publicHolidays = [] }: DateRangePickerProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value.endDate ? parseDateLocal(value.endDate) : new Date());
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [tempStart, setTempStart] = useState<Date>(parseDateLocal(value.startDate));
  const [tempEnd, setTempEnd] = useState<Date>(parseDateLocal(value.endDate));

  const formatDateRange = (range: DateRange) => {
    const start = format(parseDateLocal(range.startDate), 'MMM d, yyyy');
    const end = format(parseDateLocal(range.endDate), 'MMM d, yyyy');
    return `${start} - ${end}`;
  };

  const startOfGrid = (date: Date) => startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const endOfGrid = (date: Date) => endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const buildCalendarDays = (date: Date) => {
    const start = startOfGrid(date);
    const end = endOfGrid(date);
    const days: Date[] = [];
    let cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };

  const applyTempRange = () => {
    const s = tempStart <= tempEnd ? tempStart : tempEnd;
    const e = tempEnd >= tempStart ? tempEnd : tempStart;
    onChange({ startDate: formatDateLocal(s), endDate: formatDateLocal(e) });
    setModalVisible(false);
  };

  const isSameYMD = (a: Date, b: Date) => formatDateLocal(a) === formatDateLocal(b);
  const isInRange = (d: Date, s: Date, e: Date) => d >= (s <= e ? s : e) && d <= (e >= s ? e : s);

  // Quick preset options removed per new spec. Calendar-only selection remains.

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
        testID="date-range-selector"
      >
        <Calendar size={18} color={colors.primary} />
        <Text style={styles.selectorText}>{formatDateRange(value)}</Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            {/* Calendar selector */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setCurrentMonth(prev => subMonths(prev, 1))} style={styles.monthNavBtn}>
                <Text style={styles.monthNavText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, 1))} style={styles.monthNavBtn}>
                <Text style={styles.monthNavText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekdayRow}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <Text key={d} style={styles.weekdayText}>{d}</Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {buildCalendarDays(currentMonth).map((d) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dayDate = new Date(d);
                dayDate.setHours(0, 0, 0, 0);
                const isPastDate = dayDate < today;
                const isRestricted = disabledDates.includes(format(d, 'yyyy-MM-dd'));
                const isPublicHoliday = publicHolidays.includes(format(d, 'yyyy-MM-dd'));
                const isDisabled = isPastDate || isRestricted;

                const inCurrentMonth = d.getMonth() === currentMonth.getMonth();
                const selectedStart = isSameYMD(d, tempStart);
                const selectedEnd = isSameYMD(d, tempEnd);
                const inSelectedRange = isInRange(d, tempStart, tempEnd);

                // Allow interaction only if not disabled and not a public holiday
                const isInteractable = !isDisabled && !isPublicHoliday;

                const dayStyle = [
                  styles.dayCell,
                  !inCurrentMonth && styles.dayCellMuted,
                  // Generic disabled style only if NOT a holiday
                  isDisabled && !isPublicHoliday && styles.dayCellDisabled,
                  // Holiday style takes precedence for background
                  isPublicHoliday && styles.dayCellHoliday,
                  // Selected/Range styles should probably override holiday background if user somehow selected it 
                  // (but helper prevents that). 
                  // However, if we want to show range going *through* a holiday, maybe mix?
                  // For now, let's let holiday background show, but if it's in a range, allow range color?
                  // The user asked for holidays to be light red.

                  inSelectedRange && isInteractable && styles.dayCellInRange,
                  (selectedStart || selectedEnd) && isInteractable && styles.dayCellSelected,
                ];
                const textStyle = [
                  styles.dayText,
                  isDisabled && !isPublicHoliday && styles.dayTextDisabled,
                  isPublicHoliday && styles.dayTextHoliday,
                  (selectedStart || selectedEnd) && isInteractable && styles.dayTextSelected,
                ];
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={dayStyle}
                    onPress={() => {
                      if (!isInteractable) return; // Prevent selection of past, disabled, or holiday dates
                      if (selecting === 'start') {
                        setTempStart(d);
                        setSelecting('end');
                      } else {
                        setTempEnd(d);
                        setSelecting('start');
                      }
                    }}
                    disabled={!isInteractable}
                  >
                    <Text style={textStyle}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.selectorRow}>
              <TouchableOpacity style={[styles.rangeBtn, selecting === 'start' && styles.rangeBtnActive]} onPress={() => setSelecting('start')}>
                <Text style={[styles.rangeBtnText, selecting === 'start' && styles.rangeBtnTextActive]}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rangeBtn, selecting === 'end' && styles.rangeBtnActive]} onPress={() => setSelecting('end')}>
                <Text style={[styles.rangeBtnText, selecting === 'end' && styles.rangeBtnTextActive]}>End</Text>
              </TouchableOpacity>
            </View>
            {/* Selected range summary */}
            <Text style={{ textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.sm, color: colors.textSecondary }}>
              {format(tempStart <= tempEnd ? tempStart : tempEnd, 'MMM d, yyyy')} — {format(tempEnd >= tempStart ? tempEnd : tempStart, 'MMM d, yyyy')}
            </Text>

            {/* Footer buttons */}
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnSecondary]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.footerBtnText, styles.footerBtnTextSecondary]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnPrimary]}
                onPress={applyTempRange}
              >
                <Text style={styles.footerBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  selectorText: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  monthNavBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthNavText: {
    ...typography.body,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...typography.caption,
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  dayCell: {
    width: `${100 / 7}%`,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  dayCellMuted: {
    opacity: 0.4,
  },
  dayCellInRange: {
    backgroundColor: colors.primaryLight,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellHoliday: {
    backgroundColor: '#ffcccc', // Light red for public holidays
  },
  dayCellDisabled: {
    opacity: 0.3,
    backgroundColor: colors.border,
  },
  dayText: {
    color: colors.text,
  },
  dayTextHoliday: {
    color: '#d32f2f', // Dark red text for better contrast
    fontWeight: '600',
  },
  dayTextDisabled: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rangeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  rangeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  rangeBtnText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rangeBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  footerBtn: {
    flex: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  footerBtnPrimary: {
    backgroundColor: colors.primary,
  },
  footerBtnSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  footerBtnTextSecondary: {
    color: colors.text,
  },
});

export default DateRangePicker;