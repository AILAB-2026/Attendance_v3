import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { Image } from 'expo-image';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

import { useAttendance } from '@/hooks/use-attendance-store';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import AttendanceCard from '@/components/AttendanceCard';
import DateRangePicker from '@/components/DateRangePicker';
import { AttendanceDay } from '@/types/attendance';
import { formatDateLocal } from '@/lib/date';

export default function HistoryScreen() {
  const { isLoading, isHistoryLoading, fetchAttendanceByDateRange, getAttendanceByDateRange, getTodayAttendance, getLeavesByDateRange, user, lastHistoryError } = useAttendance();

  const today = new Date();
  const thirtyDaysAgo = subDays(today, 29);

  const [dateRange, setDateRange] = useState({
    startDate: format(thirtyDaysAgo, 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  });
  const [rangePreset, setRangePreset] = useState<'today' | 'this-month' | 'last-month' | 'last-30'>('last-30');
  const [refreshing, setRefreshing] = useState(false);
  // Track which dates are expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (date: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const [activeFilter, setActiveFilter] = useState<AttendanceDay['status'] | 'all'>('all');

  // Quick presets for date range
  const applyPreset = (preset: 'today' | 'this-month' | 'last-month' | 'last-30') => {
    setRangePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = format(now, 'yyyy-MM-dd');
      setDateRange({ startDate: d, endDate: d });
      return;
    }
    if (preset === 'this-month') {
      setDateRange({ startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') });
      return;
    }
    if (preset === 'last-month') {
      const last = subMonths(now, 1);
      setDateRange({ startDate: format(startOfMonth(last), 'yyyy-MM-dd'), endDate: format(endOfMonth(last), 'yyyy-MM-dd') });
      return;
    }
    // last-30
    const start = subDays(now, 29);
    setDateRange({ startDate: format(start, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') });
  };

  // Fetch from backend whenever date range changes.
  // Guard against duplicate calls in dev (React StrictMode) and avoid function identity in deps.
  const lastFetchKeyRef = useRef<string>('');
  useEffect(() => {
    const key = `${dateRange.startDate}:${dateRange.endDate}`;
    if (lastFetchKeyRef.current === key) return;
    lastFetchKeyRef.current = key;
    fetchAttendanceByDateRange(dateRange.startDate, dateRange.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate]);

  const attendanceData = useMemo(() => {
    const list = getAttendanceByDateRange(dateRange.startDate, dateRange.endDate);
    // Merge today's live record into the list so filtering reflects latest times/status
    const todayStr = formatDateLocal(new Date());
    const todayRec = getTodayAttendance?.();
    if (!todayRec) return list;
    return list.map((d) => {
      if (d.date !== todayStr) return d;
      return {
        ...d,
        clockIn: todayRec.clockIn ?? d.clockIn,
        clockOut: todayRec.clockOut ?? d.clockOut,
        entries: Array.isArray(todayRec.entries) && todayRec.entries.length > 0 ? todayRec.entries : d.entries,
        normalHours: typeof todayRec.normalHours === 'number' ? todayRec.normalHours : d.normalHours,
        overtimeHours: typeof todayRec.overtimeHours === 'number' ? todayRec.overtimeHours : d.overtimeHours,
        status: todayRec.status || d.status,
      } as AttendanceDay;
    });
  }, [getAttendanceByDateRange, dateRange, getTodayAttendance]);

  // Local normalization to catch any backend strings that slipped through
  const normalizeStatusLocal = (s: any): AttendanceDay['status'] => {
    const raw = String(s || '').trim().toLowerCase();
    if (!raw) return 'absent';
    const x = raw.replace(/[_\s]+/g, '-');
    if (['present', 'absent', 'late', 'early-exit', 'leave'].includes(x)) return x as any;
    if (x === 'on-leave' || x === 'leave-day' || x === 'onleave') return 'leave' as any;
    if (x === 'early_exit' || x === 'earlyout' || x === 'early-out' || x === 'earlyexit' || x === 'early-departure') return 'early-exit' as any;
    if (x === 'no-show' || x === 'noshow' || x === 'not-attended' || x === 'not-attendance') return 'absent' as any;
    if (x.includes('leave')) return 'leave' as any;
    if (x.includes('early')) return 'early-exit' as any;
    if (x.includes('late')) return 'late' as any;
    if (x.includes('absent') || x.includes('no-show') || x.includes('noshow') || x.includes('not-attend')) return 'absent' as any;
    if (x.includes('present')) return 'present' as any;
    return x as any;
  };

  // Optional local policy for deriving late/early when backend doesn't tag it
  // Use per-employee schedule from authenticated user (fallback to sensible defaults)
  const WORK_START = (((user as any)?.workStartTime) || '09:00').toString();
  const WORK_END = (((user as any)?.workEndTime) || '18:00').toString();
  const GRACE_MIN = Number.isFinite(Number((user as any)?.graceMin)) ? Number((user as any)?.graceMin) : 5;

  const parseHHMM = (hhmm: string, baseDate: string) => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
    if (!m) return null;
    const [_, hh, mm] = m;
    const d = new Date(baseDate + 'T00:00:00');
    d.setHours(Number(hh), Number(mm), 0, 0);
    return d;
  };

  const minutesDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 60000);

  const attendanceNormalized = useMemo(() => {
    return attendanceData.map((d) => {
      const normalized = normalizeStatusLocal(d.status);
      let finalStatus = normalized;
      // Only derive when backend did not already classify as late/early/leave
      // and there is any attendance data (clockIn/clockOut/entries)
      const hasAnyAttendance = !!d.clockIn || !!d.clockOut || (Array.isArray(d.entries) && d.entries.length > 0);
      if (normalized !== 'leave' && hasAnyAttendance && WORK_START && WORK_END) {
        const startAt = parseHHMM(WORK_START, d.date);
        const endAt = parseHHMM(WORK_END, d.date);
        const grace = Number.isFinite(GRACE_MIN) ? GRACE_MIN : 0;
        // Use top-level times; if missing, derive from entries (earliest in / latest out)
        const toDate = (ts?: number | string) => {
          if (ts == null) return undefined;
          if (typeof ts === 'number') {
            const v = ts < 1e12 ? ts * 1000 : ts; // seconds vs ms
            return new Date(v);
          }
          const s = String(ts).trim();
          if (!s) return undefined;
          // numeric string epoch
          if (/^\d{9,}$/.test(s)) {
            const n = Number(s);
            const v = n < 1e12 ? n * 1000 : n;
            return new Date(v);
          }
          // fallback ISO/date string
          const dval = new Date(s);
          return isNaN(dval.getTime()) ? undefined : dval;
        };
        let ciTs = toDate(d.clockIn?.timestamp as any);
        let coTs = toDate(d.clockOut?.timestamp as any);
        if ((!ciTs || !coTs) && Array.isArray(d.entries) && d.entries.length > 0) {
          const ins = d.entries.map(e => e.clockIn?.timestamp).filter((v) => v != null) as Array<number | string>;
          const outs = d.entries.map(e => e.clockOut?.timestamp).filter((v) => v != null) as Array<number | string>;
          if (!ciTs && ins.length) {
            // choose earliest
            const dates = ins.map(toDate).filter((dt): dt is Date => !!dt);
            if (dates.length) ciTs = new Date(Math.min(...dates.map(dt => dt.getTime())));
          }
          if (!coTs && outs.length) {
            // choose latest
            const dates = outs.map(toDate).filter((dt): dt is Date => !!dt);
            if (dates.length) coTs = new Date(Math.max(...dates.map(dt => dt.getTime())));
          }
        }
        if (startAt && ciTs) {
          const lateBy = minutesDiff(ciTs, startAt);
          if (lateBy > grace) finalStatus = 'late';
        }
        if (endAt && coTs) {
          const leftEarlyBy = minutesDiff(endAt, coTs); // positive if left before end
          if (leftEarlyBy > grace) finalStatus = 'early-exit';
        }
      }
      return { ...d, status: finalStatus } as AttendanceDay;
    });
  }, [attendanceData, WORK_START, WORK_END, GRACE_MIN]);

  // Overlay leave ranges from DB onto attendance when appropriate
  const attendanceWithLeaves = useMemo(() => {
    const leaves = getLeavesByDateRange(dateRange.startDate, dateRange.endDate);
    if (!Array.isArray(leaves) || leaves.length === 0) return attendanceNormalized;
    const overlays = leaves
      .filter((lv: any) => lv.status === 'approved') // only approved reflect in History
      .map((lv: any) => ({ start: lv.startDate, end: lv.endDate }));
    if (overlays.length === 0) return attendanceNormalized;
    return attendanceNormalized.map((d: AttendanceDay) => {
      const inLeave = overlays.some(r => d.date >= r.start && d.date <= r.end);
      if (!inLeave) return d;
      // Only mark as leave if there's no positive attendance recorded
      const hasEntries = Array.isArray((d as any).entries) && (d as any).entries.length > 0;
      const hasTopLevel = !!d.clockIn || !!d.clockOut;
      if (hasEntries || hasTopLevel) return d; // keep present/late/etc.
      return { ...d, status: 'leave' as AttendanceDay['status'] };
    });
  }, [attendanceNormalized, getLeavesByDateRange, dateRange]);

  const filteredData = useMemo(() => {
    const list = attendanceWithLeaves;
    if (activeFilter === 'all') return list;
    return list.filter((item: AttendanceDay) => item.status === activeFilter);
  }, [attendanceWithLeaves, activeFilter]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchAttendanceByDateRange(dateRange.startDate, dateRange.endDate);
    } finally {
      setRefreshing(false);
    }
  };

  const getInitials = () => {
    return (user?.name || 'E')
      .split(' ')
      .filter(Boolean)
      .map((s: string) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Check if hours should be displayed (default to true if not set)
  const showHours = (user as any)?.enableHours !== false;

  const summary = attendanceWithLeaves.reduce(
    (acc: { normal: number; overtime: number; days: number }, curr: AttendanceDay) => {
      acc.normal += curr.normalHours;
      acc.overtime += curr.overtimeHours;
      acc.days += 1;
      return acc;
    },
    { normal: 0, overtime: 0, days: 0 }
  );

  const renderItem = ({ item }: { item: AttendanceDay }) => {
    // If this is today's date, merge live today entries so details match Clock screen
    const todayStr = formatDateLocal(new Date());
    let merged = item;
    if (item.date === todayStr) {
      const today = getTodayAttendance?.();
      if (today) {
        merged = {
          ...item,
          // prefer live top-level times if present
          clockIn: today.clockIn ?? item.clockIn,
          clockOut: today.clockOut ?? item.clockOut,
          // prefer live entries array when available
          entries: Array.isArray(today.entries) && today.entries.length > 0 ? today.entries : item.entries,
          normalHours: typeof today.normalHours === 'number' ? today.normalHours : item.normalHours,
          overtimeHours: typeof today.overtimeHours === 'number' ? today.overtimeHours : item.overtimeHours,
          status: today.status || item.status,
        } as AttendanceDay;
      }
    }
    return (
      <AttendanceCard
        attendance={merged}
        collapsed={!expanded.has(item.date)}
        onPress={() => toggleExpanded(item.date)}
        showHours={showHours}
      />
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No attendance records found</Text>
    </View>
  );

  if (isLoading || isHistoryLoading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoader size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <DateRangePicker value={dateRange} onChange={setDateRange} />
      {!!lastHistoryError && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            {lastHistoryError.status === 401
              ? 'Your session may have expired or is unauthorized. Showing today\'s attendance if available.'
              : 'Unable to load full history. Showing today\'s attendance if available.'}
          </Text>
        </View>
      )}
      <View style={{ marginBottom: spacing.md }}>
        <FlatList
          data={([
            { key: 'today', label: 'Today' },
            { key: 'this-month', label: 'This Month' },
            { key: 'last-month', label: 'Last Month' },
            { key: 'last-30', label: 'Last 30 Days' },
          ] as const) as any}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }: any) => (
            <TouchableOpacity
              onPress={() => applyPreset(item.key)}
              style={[styles.presetTab, rangePreset === item.key && styles.presetTabActive]}
            >
              <Text style={[styles.presetTabText, rangePreset === item.key && styles.presetTabTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.presetList}
        />
      </View>

      {showHours && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryContent}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.days}</Text>
              <Text style={styles.summaryLabel}>Days</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.normal.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Normal Hours</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.overtime.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Overtime</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.filterContainer}>
        <ScrollableFilter
          options={[
            { value: 'all', label: 'All' },
            { value: 'present', label: 'Present' },
            { value: 'absent', label: 'Absent' },
            { value: 'late', label: 'Late' },
            { value: 'early-exit', label: 'Early Exit' },
            { value: 'leave', label: 'Leave' },
          ]}
          activeValue={activeFilter}
          onChange={setActiveFilter}
        />
      </View>

      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
}

type FilterOption = {
  value: string;
  label: string;
};

type FilterValue = AttendanceDay['status'] | 'all';

type ScrollableFilterProps = {
  options: FilterOption[];
  activeValue: string;
  onChange: (value: FilterValue) => void;
};

const ScrollableFilter = ({ options, activeValue, onChange }: ScrollableFilterProps) => {
  return (
    <FlatList
      data={options}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.value}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeValue === item.value && styles.activeFilterButton,
          ]}
          onPress={() => onChange(item.value)}
        >
          <Text
            style={[
              styles.filterButtonText,
              activeValue === item.value && styles.activeFilterButtonText,
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.filterList}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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
  metaValue: {
    color: colors.text,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  summaryTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    ...typography.caption,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  filterContainer: {
    marginBottom: spacing.md,
  },
  filterList: {
    paddingVertical: spacing.sm,
  },
  presetList: {
    paddingVertical: 6,
  },
  // Preset chips (match Leave screen "typeTab" styles)
  presetTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetTabActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  presetTabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetTabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  activeFilterButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    color: colors.text,
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
  },
  infoBanner: {
    backgroundColor: '#FFF8E1',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  infoBannerText: {
    ...typography.caption,
    color: '#5D4037',
  },
});