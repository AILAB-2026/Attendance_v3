import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';
import DateRangePicker from '@/components/DateRangePicker';
import Chip from '@/components/manage/shared/Chip';
import StickyHeader from '@/components/manage/shared/StickyHeader';
import { formatDateLocal } from '@/lib/date';

interface LogsViewProps {
  logsLoading: boolean;
  logsRefreshing: boolean;
  setLogsRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  loadLogs: () => Promise<void>;
  logsItems: Array<any>;
  logsRange: { startDate: string; endDate: string };
  setLogsRange: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string }>>;
  setLogsPage: React.Dispatch<React.SetStateAction<number>>;
  logsQuery: string;
  setLogsQuery: React.Dispatch<React.SetStateAction<string>>;
  logsAction: string;
  setLogsAction: React.Dispatch<React.SetStateAction<string>>;
  logsTarget: string;
  setLogsTarget: React.Dispatch<React.SetStateAction<string>>;
  logsTotal: number;
  compact: boolean;
  logsPage: number;
  today: Date;
  styles: any;
  SkeletonRow: React.FC;
  setCompact: React.Dispatch<React.SetStateAction<boolean>>;
}

const LogsView: React.FC<LogsViewProps> = ({
  logsLoading,
  logsRefreshing,
  setLogsRefreshing,
  loadLogs,
  logsItems,
  logsRange,
  setLogsRange,
  setLogsPage,
  logsQuery,
  setLogsQuery,
  logsAction,
  setLogsAction,
  logsTarget,
  setLogsTarget,
  logsTotal,
  compact,
  logsPage,
  today,
  styles,
  SkeletonRow,
  setCompact
}) => {
  const handleReset = () => {
    setLogsQuery('');
    setLogsAction('all');
    setLogsTarget('all');
    setLogsPage(1);
    setLogsRange({
      startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: formatDateLocal(today)
    });
  };

  if (logsLoading) {
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
        data={logsItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        ListHeaderComponentStyle={{ marginBottom: 0, paddingBottom: 0, zIndex: 2, marginTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={logsRefreshing}
            onRefresh={async () => {
              setLogsRefreshing(true);
              await loadLogs();
              setLogsRefreshing(false);
            }}
          />
        }
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <StickyHeader 
            accessibilityLabel="Audit logs filters"
            style={{ marginTop: 0, paddingTop: spacing.xs }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <TouchableOpacity onPress={() => setCompact(c => !c)} style={[styles.compactChip, compact && styles.compactChipActive]} accessibilityRole="button" accessibilityLabel={`Toggle compact mode, currently ${compact ? 'on' : 'off'}`}>
                <Text style={[styles.compactChipText, compact && styles.compactChipTextActive]}>{compact ? 'Compact: On' : 'Compact: Off'}</Text>
              </TouchableOpacity>
            </View>
            <DateRangePicker
              value={logsRange}
              onChange={(v) => {
                setLogsRange(v);
                setLogsPage(1);
              }}
            />
            <View style={{ position: 'relative' }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search in metadata"
                placeholderTextColor={colors.textSecondary}
                value={logsQuery}
                onChangeText={(t) => {
                  setLogsQuery(t);
                  setLogsPage(1);
                }}
                accessibilityLabel="Search audit logs"
                accessibilityHint="Type to search in log metadata and details"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {!!logsQuery && (
                <TouchableOpacity
                  onPress={() => { setLogsQuery(''); setLogsPage(1); }}
                  style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' }}
                  accessibilityLabel="Clear search"
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
              accessibilityRole="radiogroup"
              accessibilityLabel="Log action filters"
            >
              <View style={styles.filterChips}>
                {(['all', 'update_user', 'leave_approved', 'leave_rejected', 'correction_approved', 'correction_rejected'] as const).map(k => (
                  <Chip
                    key={k}
                    label={k[0].toUpperCase() + k.slice(1)}
                    selected={logsAction === k}
                    onPress={() => { setLogsAction(k); setLogsPage(1); }}
                    accessibilityRole="radio"
                    accessibilityLabel={`Filter by ${k} actions`}
                  />
                ))}
              </View>
            </ScrollView>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
              accessibilityRole="radiogroup"
              accessibilityLabel="Log target filters"
            >
              <View style={styles.filterChips}>
                {(['all', 'user', 'leave', 'attendance_correction'] as const).map(k => (
                  <Chip
                    key={`t-${k}`}
                    label={k[0].toUpperCase() + k.slice(1)}
                    selected={logsTarget === k}
                    onPress={() => { setLogsTarget(k); setLogsPage(1); }}
                    accessibilityRole="radio"
                    accessibilityLabel={`Filter by ${k} targets`}
                  />
                ))}
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
              accessibilityLabel={`Showing ${logsItems.length} of ${logsTotal} audit log entries`}
            >
              Showing {logsItems.length} of {logsTotal}
            </Text>
          </StickyHeader>
        }
        renderItem={({ item }) => (
          <View 
            style={[styles.row, compact && styles.rowCompact]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Audit log: ${item.action} action by ${item.name}, employee number ${item.empNo}, target ${item.target || 'none'}, timestamp ${String(item.createdAt).replace('T', ' ').slice(0, 19)}`}
          >
            <View style={enhancedStyles.logCard}>
              <View style={enhancedStyles.logHeader}>
                <View style={enhancedStyles.logInfo}>
                  <Text style={styles.name}>
                    {item.name} <Text style={styles.muted}>({item.empNo})</Text>
                  </Text>
                  <View style={enhancedStyles.logActionIndicator}>
                    <View style={[
                      enhancedStyles.logActionDot,
                      { 
                        backgroundColor: item.action.includes('create') || item.action.includes('add')
                          ? colors.success
                          : item.action.includes('delete') || item.action.includes('remove')
                          ? colors.error
                          : item.action.includes('update') || item.action.includes('edit')
                          ? colors.warning
                          : colors.secondary
                      }
                    ]} />
                    <Text style={[styles.meta, { fontWeight: '600' }]}>
                      {String(item.createdAt).replace('T', ' ').slice(0, 19)}
                    </Text>
                  </View>
                </View>
                
                <View style={enhancedStyles.logBadgeContainer}>
                  <Text
                    style={[
                      styles.badge,
                      item.action.includes('create') || item.action.includes('add')
                        ? styles.badgeSuccess
                        : item.action.includes('delete') || item.action.includes('remove')
                        ? styles.badgeError
                        : item.action.includes('update') || item.action.includes('edit')
                        ? styles.badgeWarning
                        : styles.badgeSecondary
                    ]}
                  >
                    {item.action}
                  </Text>
                </View>
              </View>

              <View style={enhancedStyles.logDetails}>
                <View style={enhancedStyles.logActionContainer}>
                  <Text style={[styles.meta, { fontWeight: '700', color: colors.primary }]}>
                    {item.action.toUpperCase()}
                  </Text>
                </View>

                {!!item.target && (
                  <View style={enhancedStyles.logTargetContainer}>
                    <Text style={[styles.meta, { fontWeight: '600' }]}>Target:</Text>
                    <Text style={[styles.meta, { 
                      color: colors.secondary,
                      fontWeight: '700',
                      flex: 1,
                      textAlign: 'right'
                    }]}>
                      {item.target}
                    </Text>
                  </View>
                )}

                {!!item.details && (
                  <View style={enhancedStyles.logDetailsContainer}>
                    <Text style={[styles.meta, { fontWeight: '600', marginBottom: spacing.xs }]}>
                      Details:
                    </Text>
                    <Text style={[styles.meta, { 
                      fontStyle: 'italic', 
                      color: colors.textSecondary,
                      backgroundColor: colors.background,
                      padding: spacing.sm,
                      borderRadius: radii.sm,
                      borderLeftWidth: 3,
                      borderLeftColor: colors.primary
                    }]}>
                      {item.details}
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
            accessibilityLabel="No audit logs found. Try a different filter or range"
          >
            <Text style={styles.emptyTitle}>No audit logs</Text>
            <Text style={styles.emptySub}>Try a different filter or range</Text>
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
            if (logsPage > 1) {
              setLogsPage(logsPage - 1);
            }
          }}
          disabled={logsPage <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityHint="Go to previous page of audit logs"
          accessibilityState={{ disabled: logsPage <= 1 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Prev</Text>
        </TouchableOpacity>
        <Text 
          style={styles.meta}
          accessibilityRole="text"
          accessibilityLabel={`Page ${logsPage} of audit logs, showing ${logsTotal} total entries`}
        >
          Page {logsPage} • Total {logsTotal}
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (logsItems.length >= 20) {
              setLogsPage(logsPage + 1);
            }
          }}
          disabled={logsItems.length < 20}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityHint="Go to next page of audit logs"
          accessibilityState={{ disabled: logsItems.length < 20 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

// Enhanced styles for better log card layout and data visualization
const enhancedStyles = StyleSheet.create({
  logCard: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  logInfo: {
    flex: 1,
  },
  logActionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  logActionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  logBadgeContainer: {
    marginLeft: spacing.sm,
  },
  logDetails: {
    marginBottom: spacing.sm,
  },
  logActionContainer: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  logTargetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.secondary + '10',
    borderRadius: radii.sm,
  },
  logDetailsContainer: {
    marginTop: spacing.sm,
  },
});

export default LogsView;
