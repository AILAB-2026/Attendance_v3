import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';
import DateRangePicker from '@/components/DateRangePicker';
import Chip from '@/components/manage/shared/Chip';
import StickyHeader from '@/components/manage/shared/StickyHeader';
import { formatDateLocal } from '@/lib/date';

interface ScheduleViewProps {
  schedLoading: boolean;
  schedRefreshing: boolean;
  setSchedRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  loadSchedules: () => Promise<void>;
  schedItems: Array<any>;
  schedRange: { startDate: string; endDate: string };
  setSchedRange: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string }>>;
  setSchedPage: React.Dispatch<React.SetStateAction<number>>;
  schedQuery: string;
  setSchedQuery: React.Dispatch<React.SetStateAction<string>>;
  schedTotal: number;
  compact: boolean;
  schedPage: number;
  setBulkModal: React.Dispatch<React.SetStateAction<boolean>>;
  setCsvModal: React.Dispatch<React.SetStateAction<boolean>>;
  today: Date;
  styles: any;
  SkeletonRow: React.FC;
  setCompact: React.Dispatch<React.SetStateAction<boolean>>;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({
  schedLoading,
  schedRefreshing,
  setSchedRefreshing,
  loadSchedules,
  schedItems,
  schedRange,
  setSchedRange,
  setSchedPage,
  schedQuery,
  setSchedQuery,
  schedTotal,
  compact,
  schedPage,
  setBulkModal,
  setCsvModal,
  today,
  styles,
  SkeletonRow,
  setCompact
}) => {
  const handleReset = () => {
    setSchedQuery('');
    setSchedRange({
      startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: formatDateLocal(today)
    });
    setSchedPage(1);
  };

  if (schedLoading) {
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </>
    );
  }

  return (
    <>
      <FlatList
        data={schedItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        ListHeaderComponentStyle={{ marginBottom: 0, paddingBottom: 0, zIndex: 2, marginTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={schedRefreshing}
            onRefresh={async () => {
              setSchedRefreshing(true);
              await loadSchedules();
              setSchedRefreshing(false);
            }}
          />
        }
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <StickyHeader 
            accessibilityLabel="Schedule filters and controls"
            style={{ marginTop: 0, paddingTop: spacing.xs }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <TouchableOpacity onPress={() => setCompact(c => !c)} style={[styles.compactChip, compact && styles.compactChipActive]} accessibilityRole="button" accessibilityLabel={`Toggle compact mode, currently ${compact ? 'on' : 'off'}`}>
                <Text style={[styles.compactChipText, compact && styles.compactChipTextActive]}>{compact ? 'Compact: On' : 'Compact: Off'}</Text>
              </TouchableOpacity>
            </View>
            <DateRangePicker
              value={schedRange}
              onChange={(v) => {
                setSchedRange(v);
                setSchedPage(1);
              }}
            />
            <View style={{ position: 'relative' }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or Emp No"
                placeholderTextColor={colors.textSecondary}
                value={schedQuery}
                onChangeText={(t) => {
                  setSchedQuery(t);
                  setSchedPage(1);
                }}
                accessibilityRole="search"
                accessibilityLabel="Search schedules by employee name or number"
                accessibilityHint="Type to filter schedule list"
              />
              {!!schedQuery && (
                <TouchableOpacity
                  onPress={() => { setSchedQuery(''); setSchedPage(1); }}
                  style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  accessibilityHint="Clears the search input"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
              accessibilityRole="toolbar"
              accessibilityLabel="Schedule management actions"
            >
              <View style={styles.filterChips}>
                <Chip 
                  label="Bulk Assign" 
                  onPress={() => setBulkModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Bulk assign schedules"
                />
                <Chip 
                  label="Import CSV" 
                  onPress={() => setCsvModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Import schedules from CSV"
                />
                <Chip 
                  label="Reset" 
                  onPress={handleReset}
                  accessibilityRole="button"
                  accessibilityLabel="Reset filters"
                />
              </View>
            </ScrollView>
            <Text 
              style={styles.subTitle}
              accessibilityRole="text"
              accessibilityLabel={`Showing ${schedItems.length} of ${schedTotal} schedules`}
            >
              Showing {schedItems.length} of {schedTotal}
            </Text>
          </StickyHeader>
        }
        renderItem={({ item }) => (
          <View 
            style={[styles.row, compact && styles.rowCompact]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Schedule for ${item.name}, employee number ${item.empNo}, date ${String(item.date).slice(0, 10)}, site ${item.site || 'none'}, project ${item.project || 'none'}, clock in ${item.clockIn || 'not set'}, clock out ${item.clockOut || 'not set'}`}
          >
            <View style={enhancedStyles.scheduleCard}>
              <View style={enhancedStyles.scheduleHeader}>
                <View style={enhancedStyles.scheduleInfo}>
                  <Text style={styles.name}>
                    {item.name} <Text style={styles.muted}>({item.empNo})</Text>
                  </Text>
                  <View style={enhancedStyles.scheduleDateIndicator}>
                    <View style={[
                      enhancedStyles.scheduleDateDot,
                      { backgroundColor: colors.primary }
                    ]} />
                    <Text style={[styles.meta, { fontWeight: '700', color: colors.primary }]}>
                      📅 {String(item.date).slice(0, 10)}
                    </Text>
                  </View>
                </View>
                
                <View style={enhancedStyles.scheduleStatusBadgeContainer}>
                  <Text
                    style={[
                      styles.badge,
                      item.status === 'present'
                        ? styles.badgeSuccess
                        : item.status === 'absent'
                        ? styles.badgeError
                        : item.status === 'late'
                        ? styles.badgeWarning
                        : styles.badgeSecondary
                    ]}
                  >
                    {item.status || 'scheduled'}
                  </Text>
                </View>
              </View>

              <View style={enhancedStyles.scheduleDetails}>
                <View style={enhancedStyles.scheduleLocationContainer}>
                  <View style={enhancedStyles.locationItem}>
                    <Text style={[styles.meta, { fontWeight: '600' }]}>Site:</Text>
                    <Text style={[styles.meta, { 
                      color: colors.secondary,
                      fontWeight: '700',
                      flex: 1,
                      textAlign: 'right'
                    }]}>
                      {item.site}
                    </Text>
                  </View>
                  <View style={enhancedStyles.locationItem}>
                    <Text style={[styles.meta, { fontWeight: '600' }]}>Project:</Text>
                    <Text style={[styles.meta, { 
                      color: colors.primary,
                      fontWeight: '700',
                      flex: 1,
                      textAlign: 'right'
                    }]}>
                      {item.project}
                    </Text>
                  </View>
                </View>

                <View style={enhancedStyles.scheduleTimeContainer}>
                  <View style={enhancedStyles.timeSlot}>
                    <Text style={[styles.meta, { fontWeight: '600', color: colors.success }]}>
                      🕐 Clock In
                    </Text>
                    <Text style={[styles.meta, { 
                      fontWeight: '700',
                      color: item.clockIn ? colors.success : colors.textSecondary
                    }]}>
                      {item.clockIn || 'Not set'}
                    </Text>
                  </View>
                  <View style={enhancedStyles.timeSlot}>
                    <Text style={[styles.meta, { fontWeight: '600', color: colors.error }]}>
                      🕐 Clock Out
                    </Text>
                    <Text style={[styles.meta, { 
                      fontWeight: '700',
                      color: item.clockOut ? colors.error : colors.textSecondary
                    }]}>
                      {item.clockOut || 'Not set'}
                    </Text>
                  </View>
                </View>

                {!!item.notes && (
                  <View style={enhancedStyles.scheduleNotesContainer}>
                    <Text style={[styles.meta, { fontWeight: '600', marginBottom: spacing.xs }]}>
                      📝 Notes:
                    </Text>
                    <Text style={[styles.meta, { 
                      fontStyle: 'italic', 
                      color: colors.textSecondary,
                      backgroundColor: colors.background,
                      padding: spacing.sm,
                      borderRadius: radii.sm,
                      borderLeftWidth: 3,
                      borderLeftColor: colors.warning
                    }]}>
                      {item.notes}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View 
            style={styles.center}
            accessible
            accessibilityRole="text"
            accessibilityLabel="No schedules found. Adjust filters or import via CSV"
          >
            <Text style={styles.emptyTitle}>No schedules</Text>
            <Text style={styles.emptySub}>Adjust filters or import via CSV</Text>
          </View>
        }
      />
      <View 
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}
        accessibilityRole="toolbar"
        accessibilityLabel="Pagination controls"
      >
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (schedPage > 1) {
              setSchedPage(schedPage - 1);
            }
          }}
          disabled={schedPage <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityHint="Go to previous page of schedules"
          accessibilityState={{ disabled: schedPage <= 1 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Prev</Text>
        </TouchableOpacity>
        <Text 
          style={styles.meta}
          accessibilityRole="text"
          accessibilityLabel={`Page ${schedPage} of schedules, showing ${schedTotal} total entries`}
        >
          Page {schedPage} • Total {schedTotal}
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (schedItems.length >= 50) {
              setSchedPage(schedPage + 1);
            }
          }}
          disabled={schedItems.length < 50}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityHint="Go to next page of schedules"
          accessibilityState={{ disabled: schedItems.length < 50 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

// Enhanced styles for better schedule card layout with calendar-like interface
const enhancedStyles = StyleSheet.create({
  scheduleCard: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleDateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  scheduleDateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  scheduleStatusBadgeContainer: {
    marginLeft: spacing.sm,
  },
  scheduleDetails: {
    marginBottom: spacing.sm,
  },
  scheduleLocationContainer: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  locationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  scheduleTimeContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timeSlot: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  scheduleNotesContainer: {
    marginTop: spacing.sm,
  },
});

export default ScheduleView;
