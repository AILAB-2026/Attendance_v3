import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, RefreshControl, Linking, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import colors from '@/constants/colors';
import { spacing } from '@/constants/theme';
import DateRangePicker from '@/components/DateRangePicker';
import { apiService } from '@/lib/api';
import { format, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import Chip from '@/components/manage/shared/Chip';
import StickyHeader from '@/components/manage/shared/StickyHeader';
import { formatDateLocal } from '@/lib/date';

interface ReportsViewProps {
  reportsLoading: boolean;
  reportsRefreshing: boolean;
  setReportsRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  loadReports: () => Promise<void>;
  sortedReportsItems: Array<any>;
  reportsRange: { startDate: string; endDate: string };
  setReportsRange: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string }>>;
  setReportsPage: React.Dispatch<React.SetStateAction<number>>;
  reportsQuery: string;
  setReportsQuery: React.Dispatch<React.SetStateAction<string>>;
  reportsGroupBy: 'employee' | 'department';
  setReportsGroupBy: React.Dispatch<React.SetStateAction<'employee' | 'department'>>;
  reportsSort: 'lates' | 'absents';
  setReportsSort: React.Dispatch<React.SetStateAction<'lates' | 'absents'>>;
  reportsThreshold: number;
  setReportsThreshold: React.Dispatch<React.SetStateAction<number>>;
  reportsTotal: number;
  reportsPageTotals: { lates: number; absents: number };
  debouncedReportsQuery: string;
  reportsPage: number;
  reportsItems: Array<any>;
  compact: boolean;
  today: Date;
  user: any;
  styles: any;
  SkeletonRow: React.FC;
  setCompact: React.Dispatch<React.SetStateAction<boolean>>;
}

const ReportsView: React.FC<ReportsViewProps> = ({
  reportsLoading,
  reportsRefreshing,
  setReportsRefreshing,
  loadReports,
  sortedReportsItems,
  reportsRange,
  setReportsRange,
  setReportsPage,
  reportsQuery,
  setReportsQuery,
  reportsGroupBy,
  setReportsGroupBy,
  reportsSort,
  setReportsSort,
  reportsThreshold,
  setReportsThreshold,
  reportsTotal,
  reportsPageTotals,
  debouncedReportsQuery,
  reportsPage,
  reportsItems,
  compact,
  today,
  user,
  styles,
  SkeletonRow,
  setCompact
}) => {
  const [rangePreset, setRangePreset] = useState<'today'|'this-month'|'last-month'|'last-30' | null>(null);

  const handleExportCSV = async () => {
    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
    const url = (apiService as any).getAdminReportsExportUrl(companyCode, employeeNo, {
      startDate: reportsRange.startDate,
      endDate: reportsRange.endDate,
      groupBy: reportsGroupBy,
      thresholdMinutes: reportsThreshold,
      query: debouncedReportsQuery,
      format: 'csv'
    });
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        Linking.openURL(url).catch(() => {});
      }
    }
  };

  const handleExportPDF = async () => {
    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
    const url = (apiService as any).getAdminReportsExportUrl(companyCode, employeeNo, {
      startDate: reportsRange.startDate,
      endDate: reportsRange.endDate,
      groupBy: reportsGroupBy,
      thresholdMinutes: reportsThreshold,
      query: debouncedReportsQuery,
      format: 'pdf'
    });
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        Linking.openURL(url).catch(() => {});
      }
    }
  };

  const handleReset = () => {
    setReportsQuery('');
    setReportsThreshold(5);
    setReportsPage(1);
    setReportsRange({
      startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: formatDateLocal(today)
    });
    setRangePreset('this-month');
  };

  const applyPreset = (preset: 'today'|'this-month'|'last-month'|'last-30') => {
    setRangePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = format(now, 'yyyy-MM-dd');
      setReportsRange({ startDate: d, endDate: d });
      setReportsPage(1);
      return;
    }
    if (preset === 'this-month') {
      setReportsRange({ startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') });
      setReportsPage(1);
      return;
    }
    if (preset === 'last-month') {
      const last = subMonths(now, 1);
      setReportsRange({ startDate: format(startOfMonth(last), 'yyyy-MM-dd'), endDate: format(endOfMonth(last), 'yyyy-MM-dd') });
      setReportsPage(1);
      return;
    }
    // last-30
    const start = subDays(now, 29);
    setReportsRange({ startDate: format(start, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') });
    setReportsPage(1);
  };

  if (reportsLoading) {
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        data={sortedReportsItems}
        keyExtractor={(item, i) => (item.emp_no ? String(item.emp_no) : String(item.department || 'dep')) + ':' + i}
        contentContainerStyle={{ paddingBottom: spacing.md, paddingTop: 0 }}
        ListHeaderComponentStyle={{ marginBottom: 0, paddingBottom: 0, zIndex: 2 }}
        accessibilityLabel="Team reports list"
        accessibilityRole="list"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={reportsRefreshing}
            onRefresh={async () => {
              setReportsRefreshing(true);
              await loadReports();
              setReportsRefreshing(false);
            }}
          />
        }
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <StickyHeader
            accessibilityLabel="Team Reports filters"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <TouchableOpacity onPress={() => setCompact(c => !c)} style={[styles.compactChip, compact && styles.compactChipActive]} accessibilityRole="button" accessibilityLabel={`Toggle compact mode, currently ${compact ? 'on' : 'off'}`}>
                <Text style={[styles.compactChipText, compact && styles.compactChipTextActive]}>{compact ? 'Compact: On' : 'Compact: Off'}</Text>
              </TouchableOpacity>
            </View>
            <DateRangePicker
              value={reportsRange}
              onChange={(v) => {
                setReportsRange(v);
                setReportsPage(1);
              }}
            />
            {/* Date presets synced with History screen */}
            <View style={{ marginBottom: spacing.sm }}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
                accessibilityRole="tablist"
                accessibilityLabel="Date range presets"
              >
                <View style={{ flexDirection: 'row' }}>
                  {([
                  { key: 'today', label: 'Today' },
                  { key: 'this-month', label: 'This Month' },
                  { key: 'last-month', label: 'Last Month' },
                  { key: 'last-30', label: 'Last 30 Days' },
                  ] as const).map((item) => (
                    <Chip
                      key={item.key}
                      label={item.label}
                      selected={rangePreset === item.key}
                      onPress={() => applyPreset(item.key)}
                      accessibilityRole="tab"
                      accessibilityLabel={`Set date range to ${item.label}`}
                      style={{ marginRight: spacing.xs } as any}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or Emp No"
              placeholderTextColor={colors.textSecondary}
              value={reportsQuery}
              accessibilityLabel="Search team reports"
              accessibilityHint="Type employee name or employee number to filter results"
              returnKeyType="search"
              clearButtonMode="while-editing"
              onChangeText={(t) => {
                setReportsQuery(t);
                setReportsPage(1);
              }}
            />
            <View style={styles.filterChips}>
              <Chip
                label="Group: Employee"
                selected={reportsGroupBy === 'employee'}
                onPress={() => { setReportsGroupBy('employee'); setReportsPage(1); }}
                accessibilityLabel="Group by employee"
              />
              <Chip
                label="Group: Department"
                selected={reportsGroupBy === 'department'}
                onPress={() => { setReportsGroupBy('department'); setReportsPage(1); }}
                accessibilityLabel="Group by department"
              />
              <Chip
                label="Sort: Lates"
                selected={reportsSort === 'lates'}
                onPress={() => setReportsSort('lates')}
                accessibilityLabel="Sort by lates"
              />
              <Chip
                label="Sort: Absents"
                selected={reportsSort === 'absents'}
                onPress={() => setReportsSort('absents')}
                accessibilityLabel="Sort by absents"
              />
              <Chip
                label="Threshold -5"
                onPress={() => { setReportsThreshold(Math.max(0, reportsThreshold - 5)); setReportsPage(1); }}
                accessibilityLabel="Decrease late threshold by 5 minutes"
              />
              <Chip
                label="Threshold +5"
                onPress={() => { setReportsThreshold(reportsThreshold + 5); setReportsPage(1); }}
                accessibilityLabel="Increase late threshold by 5 minutes"
              />
              <Chip
                label="Reset"
                onPress={handleReset}
                accessibilityLabel="Reset filters"
              />
              <Chip
                label="Export CSV"
                onPress={handleExportCSV}
                accessibilityLabel="Export CSV"
              />
              <Chip
                label="Export PDF"
                onPress={handleExportPDF}
                accessibilityLabel="Export PDF"
              />
            </View>
            <Text style={styles.subTitle}>
              Showing {sortedReportsItems.length} of {reportsTotal} • Group: {reportsGroupBy[0].toUpperCase() + reportsGroupBy.slice(1)} • Late threshold: {reportsThreshold}m
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
              accessibilityRole="radiogroup"
              accessibilityLabel="Group by options"
            >
              <View style={styles.filterChips}>
                {(['employee', 'department'] as const).map(k => (
                <TouchableOpacity
                  key={`grp-${k}`}
                  style={[styles.presetTab, reportsGroupBy === k && styles.presetTabActive]}
                  onPress={() => {
                    setReportsGroupBy(k);
                    setReportsPage(1);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Group by ${k}`}
                  accessibilityState={{ selected: reportsGroupBy === k }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.presetTabText, reportsGroupBy === k && styles.presetTabTextActive]}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
              {(['lates', 'absents'] as const).map(k => (
                <TouchableOpacity
                  key={`sort-${k}`}
                  style={[styles.presetTab, reportsSort === k && styles.presetTabActive]}
                  onPress={() => setReportsSort(k)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Sort by ${k}`}
                  accessibilityState={{ selected: reportsSort === k }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.presetTabText, reportsSort === k && styles.presetTabTextActive]}>
                    Sort: {k[0].toUpperCase() + k.slice(1)}
                  </Text>
                </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.presetTab}
                  onPress={handleReset}
                  accessibilityRole="button"
                  accessibilityLabel="Reset filters"
                  accessibilityHint="Resets date range, search, and threshold to defaults"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.presetTabText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View 
              style={[styles.sectionCard, { marginTop: spacing.xs }]}
              accessibilityRole="summary"
              accessibilityLabel="Report summary statistics"
            > 
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                <View 
                  style={[styles.kpiCard, { flex: 1, marginRight: spacing.sm }]}
                  accessibilityRole="text"
                  accessibilityLabel={`Total late arrivals: ${reportsPageTotals.lates}`}
                > 
                  <Text style={styles.kpiLabel}>Total Lates</Text>
                  <Text style={styles.kpiValue}>{reportsPageTotals.lates}</Text>
                </View>
                <View 
                  style={[styles.kpiCard, { flex: 1 }]}
                  accessibilityRole="text"
                  accessibilityLabel={`Total absences: ${reportsPageTotals.absents}`}
                > 
                  <Text style={styles.kpiLabel}>Total Absents</Text>
                  <Text style={styles.kpiValue}>{reportsPageTotals.absents}</Text>
                </View>
              </View>
              <View 
                style={[styles.legendRow, { marginTop: spacing.sm }]}
                accessibilityRole="text"
                accessibilityLabel="Legend: Yellow indicates lates, red indicates absents"
              > 
                <View style={[styles.legendDot, { backgroundColor: '#fde68a' }]} />
                <Text style={styles.muted}>Lates</Text>
                <View style={[styles.legendDot, { backgroundColor: '#fecaca', marginLeft: spacing.md }]} />
                <Text style={styles.muted}>Absents</Text>
              </View>
            </View>
          </StickyHeader>
        }
        renderItem={({ item }) => (
          <View
            style={[styles.row, compact && styles.rowCompact]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={
              reportsGroupBy === 'employee'
                ? `Employee: ${item.name}, Employee number ${item.emp_no}, Late arrivals: ${item.lates}, Absences: ${item.absents}`
                : `Department: ${String(item.department || 'Unassigned').toUpperCase()}, Late arrivals: ${item.lates}, Absences: ${item.absents}`
            }
          >
            <View style={{ flex: 1 }}>
              {reportsGroupBy === 'employee' ? (
                <>
                  <Text style={styles.name}>
                    {item.name} <Text style={styles.muted}>({item.emp_no})</Text>
                  </Text>
                  <Text style={styles.meta}>
                    Lates: <Text style={[styles.badge, styles.badgeEmployee]}>{item.lates}</Text>  
                    Absents: <Text style={[styles.badge, styles.badgeAdmin]}>{item.absents}</Text>
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.name}>
                    {String(item.department || 'Unassigned').toUpperCase()}
                  </Text>
                  <Text style={styles.meta}>
                    Lates: <Text style={[styles.badge, styles.badgeEmployee]}>{item.lates}</Text>  
                    Absents: <Text style={[styles.badge, styles.badgeAdmin]}>{item.absents}</Text>
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.center, { paddingVertical: spacing.lg }]}> 
            <Text style={styles.emptyTitle}>No report data 😕</Text>
            <Text style={styles.emptySub}>Try another date range, search, or lower the threshold</Text>
          </View>
        }
      />
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}
        accessible
        accessibilityRole="toolbar"
        accessibilityLabel="Pagination controls"
      >
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (reportsPage > 1) {
              setReportsPage(reportsPage - 1);
            }
          }}
          disabled={reportsPage <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityState={{ disabled: reportsPage <= 1 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Prev</Text>
        </TouchableOpacity>
        <Text style={styles.meta}>Page {reportsPage} • Total {reportsTotal}</Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (reportsItems.length >= 20) {
              setReportsPage(reportsPage + 1);
            }
          }}
          disabled={reportsItems.length < 20}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityState={{ disabled: reportsItems.length < 20 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ReportsView;
