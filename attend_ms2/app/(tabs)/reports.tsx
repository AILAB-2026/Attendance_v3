import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,

  RefreshControl,
} from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { Image } from 'expo-image';
import { Linking } from 'react-native';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { BarChart3, Calendar, Clock, FileText } from 'lucide-react-native';

import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import DateRangePicker from '@/components/DateRangePicker';
import { useAuth } from '@/hooks/use-auth';
import { apiService } from '@/lib/api';
import SimpleDonut from '@/components/SimpleDonut';
import { formatDateLocal } from '@/lib/date';

type Status = 'present' | 'absent' | 'late' | 'early-exit' | 'leave';

type BreakdownBucket = {
  bucketStart: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyExitDays: number;
  leaveDays: number;
  totalNormalHours: number;
  totalOvertimeHours: number;
};

type Policy = {
  workStartTime: string;
  workEndTime: string;
  workHoursPerDay: number;
};

type Stats = {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyExitDays: number;
  leaveDays: number;
  totalNormalHours: number;
  totalOvertimeHours: number;
  averageHoursPerDay: number;
  presentPercentage: number;
  policy?: Policy;
  totalLateMinutes?: number;
  avgLateMinutes?: number;
  weekly?: BreakdownBucket[];
  monthly?: BreakdownBucket[];
};

export default function ReportsScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<Stats>({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    earlyExitDays: 0,
    leaveDays: 0,
    totalNormalHours: 0,
    totalOvertimeHours: 0,
    averageHoursPerDay: 0,
    presentPercentage: 0,
  });

  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);
  const endOfCurrentMonth = endOfMonth(today);

  const [dateRange, setDateRange] = useState({
    startDate: format(startOfCurrentMonth, 'yyyy-MM-dd'),
    endDate: format(endOfCurrentMonth, 'yyyy-MM-dd'),
  });
  const [rangePreset, setRangePreset] = useState<'today' | 'this-month' | 'last-month' | 'last-30'>('this-month');

  const initials = useMemo(() => {
    const name = user?.name || (user as any)?.employeeNo || (user as any)?.empNo || '';
    if (!name) return 'U';
    const parts = String(name).trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '';
    return (first + last).toUpperCase();
  }, [user]);

  const fetchStats = useCallback(async (opts?: { force?: boolean }) => {
    if (!user) return;
    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
    if (!companyCode || !employeeNo) return;
    try {
      if (!opts?.force) setIsLoading(true);
      setError(null);
      const resp = await apiService.getAttendanceStats(
        String(companyCode),
        String(employeeNo),
        dateRange.startDate,
        dateRange.endDate
      );
      const data = (resp as any)?.data ?? resp;
      setStatistics(data as Stats);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load attendance stats.';
      setError(msg);
      // suppressed logging
    } finally {
      if (!opts?.force) setIsLoading(false);
    }
  }, [user, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchStats({ force: true }); } finally { setRefreshing(false); }
  }, [fetchStats]);

  const getStatusDistribution = () => {
    const total = statistics.totalDays;
    if (total === 0) return [];

    return [
      {
        status: 'present',
        count: statistics.presentDays,
        percentage: (statistics.presentDays / total) * 100,
        color: colors.attendance.present,
      },
      {
        status: 'absent',
        count: statistics.absentDays,
        percentage: (statistics.absentDays / total) * 100,
        color: colors.attendance.absent,
      },
      {
        status: 'late',
        count: statistics.lateDays,
        percentage: (statistics.lateDays / total) * 100,
        color: colors.attendance.late,
      },
      {
        status: 'early-exit',
        count: statistics.earlyExitDays,
        percentage: (statistics.earlyExitDays / total) * 100,
        color: colors.attendance['early-exit'],
      },
      {
        status: 'leave',
        count: statistics.leaveDays,
        percentage: (statistics.leaveDays / total) * 100,
        color: colors.attendance.leave,
      },
    ];
  };

  const statusDistribution = getStatusDistribution();

  const getStatusText = (status: Status) => {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'late': return 'Late';
      case 'early-exit': return 'Early Exit';
      case 'leave': return 'On Leave';
      default: return status;
    }
  };

  const exportReport = () => {
    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
    if (!companyCode || !employeeNo) return;
    const url = apiService.getAttendanceExportPdfUrl(companyCode, employeeNo, dateRange.startDate, dateRange.endDate);
    Linking.openURL(url);
  };
  const exportCsv = () => {
    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
    if (!companyCode || !employeeNo) return;
    const url = apiService.getAttendanceExportUrl(companyCode, employeeNo, dateRange.startDate, dateRange.endDate);
    Linking.openURL(url);
  };

  const applyPreset = (preset: 'today' | 'this-month' | 'last-month' | 'last-30') => {
    setRangePreset(preset);
    const today = new Date();
    if (preset === 'today') {
      const d = format(today, 'yyyy-MM-dd');
      setDateRange({ startDate: d, endDate: d });
    } else if (preset === 'this-month') {
      setDateRange({
        startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
      });
    } else if (preset === 'last-month') {
      const last = subMonths(today, 1);
      setDateRange({
        startDate: format(startOfMonth(last), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(last), 'yyyy-MM-dd'),
      });
    } else if (preset === 'last-30') {
      const start = subDays(today, 29);
      setDateRange({
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      });
    }
  };

  const presencePct = useMemo(() => {
    return statistics.totalDays ? Math.round((statistics.presentDays / statistics.totalDays) * 100) : 0;
  }, [statistics.presentDays, statistics.totalDays]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoader size="large" color={colors.primary} />
        <Text style={[styles.meta, { marginTop: 12 }]}>Loading report…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.title, { marginBottom: 8 }]}>Unable to load reports</Text>
        <Text style={[styles.meta, { textAlign: 'center', marginBottom: 16 }]}>{error}</Text>
        <TouchableOpacity style={styles.exportButton} onPress={() => fetchStats({ force: true })}>
          <Text style={styles.exportButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.profileHeader}>
        {(user as any)?.profileImageUri ? (
          <Image
            source={{ uri: (user as any).profileImageUri }}
            style={styles.profileImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
            {!!(user as any)?.companyCode && (
              <Text style={styles.companyBadge} numberOfLines={1}>{(user as any).companyCode}</Text>
            )}
          </View>
          {!!(user as any)?.empNo && (
            <Text style={styles.meta}>Emp No: <Text style={styles.metaValue}>{(user as any).empNo}</Text></Text>
          )}
        </View>
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <DateRangePicker value={dateRange} onChange={(v) => { setDateRange(v); }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
          {(
            [
              { key: 'today', label: 'Today' },
              { key: 'this-month', label: 'This Month' },
              { key: 'last-month', label: 'Last Month' },
              { key: 'last-30', label: 'Last 30 Days' },
            ] as const
          ).map((p) => (
            <TouchableOpacity key={p.key} onPress={() => applyPreset(p.key)} style={[styles.presetChip, rangePreset === p.key ? styles.presetChipActive : null]}>
              <Text style={rangePreset === p.key ? styles.presetChipTextActive : styles.presetChipText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FileText size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Policy & Lateness</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.policy?.workStartTime || '-'}</Text>
            <Text style={styles.statLabel}>Work Start</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.policy?.workEndTime || '-'}</Text>
            <Text style={styles.statLabel}>Work End</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.policy?.workHoursPerDay ?? '-'}</Text>
            <Text style={styles.statLabel}>Hours/Day</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Number(statistics.totalLateMinutes || 0).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Late (min)</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Number(statistics.avgLateMinutes || 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Late (min)</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Calendar size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Attendance Overview</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.totalDays}</Text>
            <Text style={styles.statLabel}>Total Days</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.presentDays}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.absentDays}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <Text style={styles.meta}>Presence</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${presencePct}%` }]} />
          </View>
          <Text style={[styles.metaValue, { marginTop: 4 }]}>{presencePct}% present</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Clock size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Hours Summary</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.totalNormalHours.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Normal Hours</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.totalOvertimeHours.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Overtime</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{statistics.averageHoursPerDay.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg. Hours/Day</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <BarChart3 size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Attendance Distribution</Text>
        </View>
        {statistics.totalDays === 0 ? (
          <Text style={[styles.meta, { textAlign: 'center' }]}>No attendance data for the selected range.</Text>
        ) : (
          <>
            <View style={styles.donutRow}>
              <SimpleDonut
                size={180}
                stroke={18}
                slices={[
                  { label: 'Present', value: statistics.presentDays, color: colors.attendance.present },
                  { label: 'Absent', value: statistics.absentDays, color: colors.attendance.absent },
                  { label: 'Late', value: statistics.lateDays, color: colors.attendance.late },
                  { label: 'Early Exit', value: statistics.earlyExitDays, color: colors.attendance['early-exit'] },
                  { label: 'Leave', value: statistics.leaveDays, color: colors.attendance.leave },
                ]}
              />
              <View style={styles.legend}>
                {[
                  { key: 'Present', color: colors.attendance.present, val: statistics.presentDays },
                  { key: 'Absent', color: colors.attendance.absent, val: statistics.absentDays },
                  { key: 'Late', color: colors.attendance.late, val: statistics.lateDays },
                  { key: 'Early Exit', color: colors.attendance['early-exit'], val: statistics.earlyExitDays },
                  { key: 'Leave', color: colors.attendance.leave, val: statistics.leaveDays },
                ].map((l) => (
                  <View key={l.key} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                    <Text style={styles.legendText}>{l.key}</Text>
                    <Text style={styles.legendValue}>{l.val}</Text>
                  </View>
                ))}
              </View>
            </View>
            {statusDistribution.map((item) => (
              <View key={item.status} style={styles.distributionItem}>
                <View style={styles.distributionLabelContainer}>
                  <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                  <Text style={styles.distributionLabel}>{getStatusText(item.status as Status)}</Text>
                </View>

                <View style={styles.distributionBarContainer}>
                  <View
                    style={[
                      styles.distributionBar,
                      { width: `${item.percentage}%`, backgroundColor: item.color }
                    ]}
                  />
                </View>

                <View style={styles.distributionValues}>
                  <Text style={styles.distributionCount}>{item.count}</Text>
                  <Text style={styles.distributionPercentage}>{item.percentage.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      {!!statistics.weekly?.length && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BarChart3 size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Weekly Breakdown</Text>
          </View>
          {statistics.weekly.map((w) => {
            const pct = w.totalDays ? (w.presentDays / w.totalDays) * 100 : 0;
            const label = formatDateLocal(new Date(w.bucketStart));
            return (
              <View key={`w-${w.bucketStart}`} style={styles.distributionItem}>
                <View style={styles.distributionLabelContainer}>
                  <View style={[styles.statusDot, { backgroundColor: colors.attendance.present }]} />
                  <Text style={styles.distributionLabel}>{label}</Text>
                </View>
                <View style={styles.distributionBarContainer}>
                  <View style={[styles.distributionBar, { width: `${pct}%`, backgroundColor: colors.attendance.present }]} />
                </View>
                <View style={styles.distributionValues}>
                  <Text style={styles.distributionCount}>{w.presentDays}/{w.totalDays} present</Text>
                  <Text style={styles.distributionPercentage}>{pct.toFixed(1)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {!!statistics.monthly?.length && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BarChart3 size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Monthly Breakdown</Text>
          </View>
          {statistics.monthly.map((m) => {
            const pct = m.totalDays ? (m.presentDays / m.totalDays) * 100 : 0;
            const d = new Date(m.bucketStart);
            const label = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return (
              <View key={`m-${m.bucketStart}`} style={styles.distributionItem}>
                <View style={styles.distributionLabelContainer}>
                  <View style={[styles.statusDot, { backgroundColor: colors.attendance.present }]} />
                  <Text style={styles.distributionLabel}>{label}</Text>
                </View>
                <View style={styles.distributionBarContainer}>
                  <View style={[styles.distributionBar, { width: `${pct}%`, backgroundColor: colors.attendance.present }]} />
                </View>
                <View style={styles.distributionValues}>
                  <Text style={styles.distributionCount}>{m.presentDays}/{m.totalDays} present</Text>
                  <Text style={styles.distributionPercentage}>{pct.toFixed(1)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={[styles.actionsContainer, { flexDirection: 'row', gap: 12 }]}>
        <TouchableOpacity style={[styles.exportButton, { flex: 1 }]} onPress={exportReport}>
          <FileText size={20} color="#fff" />
          <Text style={styles.exportButtonText}>Export PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.exportButton, { flex: 1, backgroundColor: colors.text }]} onPress={exportCsv}>
          <FileText size={20} color="#fff" />
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetChipTextActive: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaValue: {
    color: colors.text,
    fontWeight: '600',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  companyBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.badge.companyBg,
    borderWidth: 1,
    borderColor: colors.badge.companyBorder,
    color: colors.badge.companyText,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 100,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statItem: {
    width: '33%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  distributionItem: {
    marginBottom: spacing.sm,
  },
  distributionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  distributionLabel: {
    fontSize: 14,
    color: colors.text,
  },
  distributionBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  distributionBar: {
    height: '100%',
    borderRadius: 4,
  },
  distributionValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distributionCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  distributionPercentage: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  donutRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
  },
  legendValue: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionsContainer: {
    marginBottom: spacing.lg,
  },
  exportButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: spacing.sm,
  },
});