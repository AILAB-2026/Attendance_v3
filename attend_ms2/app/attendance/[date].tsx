import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';

import { useAttendance } from '@/hooks/use-attendance-store';
import { AttendanceDay } from '@/types/attendance';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import { formatDateLocal } from '@/lib/date';

const formatTime = (ts?: number) => (ts ? format(new Date(ts), 'h:mm a') : '—');
const formatDateLong = (dateString: string) => format(new Date(dateString), 'EEEE, MMMM d, yyyy');

export default function AttendanceDetail() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { getTodayAttendance, getAttendanceByDateRange } = useAttendance();

  const record: AttendanceDay | null = useMemo(() => {
    if (!date) return null;
    const today = formatDateLocal(new Date());
    if (date === today) {
      return getTodayAttendance();
    }
    // Look up this single date from the store history window if available
    const list = getAttendanceByDateRange(date as string, date as string);
    return list && list.length ? list[0] : null;
  }, [date, getTodayAttendance, getAttendanceByDateRange]);

  if (!date) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No date provided.</Text>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No attendance found for {date}.</Text>
      </View>
    );
  }

  const entries = Array.isArray((record as any).entries) ? (record as any).entries : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.dateText}>{formatDateLong(record.date)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.attendance[record.status] || colors.textSecondary }]}>
          <Text style={styles.statusText}>{record.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
        </View>
      </View>

      {entries.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {entries.map((e: any, idx: number) => (
            <View key={`${e.siteName || 'default'}-${e.projectName || 'default'}-${idx}`} style={styles.entryCard}>
              <Text style={styles.entryTitle}>
                {(e.siteName || e.projectName) ? `${e.siteName || ''}${e.siteName && e.projectName ? ' · ' : ''}${e.projectName || ''}` : 'Default'}
              </Text>
              <View style={styles.row}>
                <View style={styles.block}>
                  <Text style={styles.label}>Clock In</Text>
                  <Text style={styles.value}>{formatTime(e.clockIn?.timestamp)}</Text>
                  {e.clockIn?.location?.address ? <Text style={styles.addr}>{e.clockIn.location.address}</Text> : null}
                </View>
                <View style={styles.vrule} />
                <View style={styles.block}>
                  <Text style={styles.label}>Clock Out</Text>
                  <Text style={styles.value}>{formatTime(e.clockOut?.timestamp)}</Text>
                  {e.clockOut?.location?.address ? <Text style={styles.addr}>{e.clockOut.location.address}</Text> : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.entryCard}>
          <Text style={styles.entryTitle}>Clock Sessions</Text>
          <View style={styles.row}>
            <View style={styles.block}>
              <Text style={styles.label}>Clock In</Text>
              <Text style={styles.value}>{formatTime(record.clockIn?.timestamp)}</Text>
              {record.clockIn?.location?.address ? <Text style={styles.addr}>{record.clockIn.location.address}</Text> : null}
            </View>
            <View style={styles.vrule} />
            <View style={styles.block}>
              <Text style={styles.label}>Clock Out</Text>
              <Text style={styles.value}>{formatTime(record.clockOut?.timestamp)}</Text>
              {record.clockOut?.location?.address ? <Text style={styles.addr}>{record.clockOut.location.address}</Text> : null}
            </View>
          </View>
        </View>
      )}

      <View style={styles.hoursRow}>
        <View style={styles.hoursBlock}>
          <Text style={styles.label}>Normal Hours</Text>
          <Text style={styles.hours}>{record.normalHours.toFixed(1)}h</Text>
        </View>
        <View style={styles.hoursBlock}>
          <Text style={styles.label}>Overtime</Text>
          <Text style={[styles.hours, { color: colors.secondary }]}>{record.overtimeHours.toFixed(1)}h</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screen },
  content: { padding: spacing.lg, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: colors.textSecondary },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { ...typography.h3 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill },
  statusText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  entryCard: { backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.lg, ...shadows.card },
  entryTitle: { ...typography.subtitle, marginBottom: spacing.md },
  row: { flexDirection: 'row' },
  block: { flex: 1, alignItems: 'center' },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  value: { ...typography.h3 },
  addr: { ...typography.caption, marginTop: spacing.xs },
  vrule: { width: 1, backgroundColor: colors.border },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hoursBlock: { alignItems: 'center', flex: 1 },
  hours: { fontSize: 18, fontWeight: '700', color: colors.text },
});
