import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';
import DateRangePicker from '@/components/DateRangePicker';
import Chip from '@/components/manage/shared/Chip';
import StickyHeader from '@/components/manage/shared/StickyHeader';
import { formatDateLocal } from '@/lib/date';

interface ApprovalsViewProps {
  apprLoading: boolean;
  apprRefreshing: boolean;
  setApprRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  loadApprovals: () => Promise<void>;
  apprItems: Array<any>;
  apprRange: { startDate: string; endDate: string };
  setApprRange: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string }>>;
  setApprPage: React.Dispatch<React.SetStateAction<number>>;
  apprQuery: string;
  setApprQuery: React.Dispatch<React.SetStateAction<string>>;
  apprStatus: 'pending' | 'approved' | 'rejected';
  setApprStatus: React.Dispatch<React.SetStateAction<'pending' | 'approved' | 'rejected'>>;
  apprTotal: number;
  compact: boolean;
  setApprDetail: React.Dispatch<React.SetStateAction<any>>;
  apprPage: number;
  handleApproval: (id: string, status: string) => Promise<void>;
  setRejectCtx: React.Dispatch<React.SetStateAction<{ id: string; reason: string } | null>>;
  today: Date;
  styles: any;
  SkeletonRow: React.FC;
  setCompact: React.Dispatch<React.SetStateAction<boolean>>;
}

const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  apprLoading,
  apprRefreshing,
  setApprRefreshing,
  loadApprovals,
  apprItems,
  apprRange,
  setApprRange,
  setApprPage,
  apprQuery,
  setApprQuery,
  apprStatus,
  setApprStatus,
  apprTotal,
  compact,
  setApprDetail,
  apprPage,
  handleApproval,
  setRejectCtx,
  today,
  styles,
  SkeletonRow,
  setCompact
}) => {
  const handleReset = () => {
    setApprQuery('');
    setApprStatus('pending');
    setApprPage(1);
    setApprRange({
      startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: formatDateLocal(today)
    });
  };

  if (apprLoading) {
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
        data={apprItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        ListHeaderComponentStyle={{ marginBottom: 0, paddingBottom: 0, zIndex: 2, marginTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={apprRefreshing}
            onRefresh={async () => {
              setApprRefreshing(true);
              await loadApprovals();
              setApprRefreshing(false);
            }}
          />
        }
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <StickyHeader 
            accessibilityLabel="Approval requests filters"
            style={{ marginTop: 0, paddingTop: spacing.xs }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <TouchableOpacity onPress={() => setCompact(c => !c)} style={[styles.compactChip, compact && styles.compactChipActive]} accessibilityRole="button" accessibilityLabel={`Toggle compact mode, currently ${compact ? 'on' : 'off'}`}>
                <Text style={[styles.compactChipText, compact && styles.compactChipTextActive]}>{compact ? 'Compact: On' : 'Compact: Off'}</Text>
              </TouchableOpacity>
            </View>
            <DateRangePicker
              value={apprRange}
              onChange={(v) => {
                setApprRange(v);
                setApprPage(1);
              }}
            />
            <View style={{ position: 'relative' }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or Emp No"
                placeholderTextColor={colors.textSecondary}
                value={apprQuery}
                onChangeText={(t) => {
                  setApprQuery(t);
                  setApprPage(1);
                }}
                accessibilityLabel="Search approval requests"
                accessibilityHint="Type employee name or number to filter approval requests"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {!!apprQuery && (
                <TouchableOpacity
                  onPress={() => { setApprQuery(''); setApprPage(1); }}
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
              accessibilityLabel="Approval status filters"
            >
              <View style={styles.filterChips}>
                {(['pending', 'approved', 'rejected'] as const).map(k => (
                  <Chip
                    key={k}
                    label={k[0].toUpperCase() + k.slice(1)}
                    selected={apprStatus === k}
                    onPress={() => { setApprStatus(k); setApprPage(1); }}
                    accessibilityRole="radio"
                    accessibilityLabel={`Filter by ${k} requests`}
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
              accessibilityLabel={`Showing ${apprItems.length} of ${apprTotal} approval requests`}
            >
              Showing {apprItems.length} of {apprTotal}
            </Text>
          </StickyHeader>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.row, compact && styles.rowCompact]}
            activeOpacity={0.8}
            onPress={() => setApprDetail(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.type} request from ${item.name}, employee number ${item.empNo}, status ${item.status}`}
            accessibilityHint="Opens detailed view with actions"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <View style={enhancedStyles.approvalCard}>
              <View style={enhancedStyles.approvalHeader}>
                <View style={enhancedStyles.approvalInfo}>
                  <Text style={styles.name}>
                    {item.name} <Text style={styles.muted}>({item.empNo})</Text>
                  </Text>
                  <View style={enhancedStyles.typeIndicator}>
                    <View style={[
                      enhancedStyles.typeDot,
                      { backgroundColor: item.type === 'leave' ? colors.primary : colors.secondary }
                    ]} />
                    <Text style={[styles.meta, { fontWeight: '600' }]}>
                      {item.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <View style={enhancedStyles.statusBadgeContainer}>
                  <Text
                    style={[
                      styles.badge,
                      item.status === 'approved'
                        ? styles.badgeSuccess
                        : item.status === 'rejected'
                        ? styles.badgeError
                        : styles.badgeWarning
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={enhancedStyles.approvalDetails}>
                <Text style={[styles.meta, { marginBottom: spacing.xs }]}>
                  Submitted: {String(item.createdAt).replace('T', ' ').slice(0, 19)}
                </Text>
                
                {item.type === 'leave' && (
                  <View style={enhancedStyles.leaveDetails}>
                    <Text style={[styles.meta, { fontWeight: '600' }]}>
                      {String(item.startDate).slice(0, 10)} → {String(item.endDate).slice(0, 10)}
                    </Text>
                    <Text style={[styles.meta, { color: colors.primary }]}>
                      {item.leaveType}
                    </Text>
                  </View>
                )}
                
                {item.type === 'correction' && (
                  <View style={enhancedStyles.correctionDetails}>
                    <Text style={[styles.meta, { fontWeight: '600' }]}>
                      Date: {String(item.date).slice(0, 10)}
                    </Text>
                    <Text style={styles.meta}>
                      Time: {item.clockIn || '-'} → {item.clockOut || '-'}
                    </Text>
                  </View>
                )}
                
                {!!item.reason && (
                  <View style={enhancedStyles.reasonContainer}>
                    <Text style={[styles.meta, { fontStyle: 'italic', color: colors.textSecondary }]}>
                      "{item.reason}"
                    </Text>
                  </View>
                )}
              </View>

              {item.status === 'pending' && (
                <View 
                  style={enhancedStyles.actionButtons}
                  accessibilityRole="toolbar"
                  accessibilityLabel="Approval actions"
                >
                  <TouchableOpacity
                    style={[enhancedStyles.actionBtn, enhancedStyles.approveBtn]}
                    onPress={async () => { try { await Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium); } catch {} handleApproval(item.id, 'approved'); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Approve ${item.type} request from ${item.name}`}
                    accessibilityHint="Approves this request and notifies the employee"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={enhancedStyles.approveBtnText}>✓ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[enhancedStyles.actionBtn, enhancedStyles.rejectBtn]}
                    onPress={async () => { try { await Haptics.selectionAsync?.(); } catch {} setRejectCtx({ id: item.id, reason: '' }); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Reject ${item.type} request from ${item.name}`}
                    accessibilityHint="Opens dialog to reject this request with a reason"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={enhancedStyles.rejectBtnText}>✗ Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View 
            style={styles.center}
            accessibilityRole="text"
            accessibilityLabel="No approval requests found. Try changing the date range or status filter."
          >
            <Text style={styles.emptyTitle}>No leave requests</Text>
            <Text style={styles.emptySub}>Change date range or status</Text>
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
            if (apprPage > 1) {
              setApprPage(apprPage - 1);
            }
          }}
          disabled={apprPage <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityState={{ disabled: apprPage <= 1 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Prev</Text>
        </TouchableOpacity>
        <Text 
          style={styles.meta}
          accessibilityRole="text"
          accessibilityLabel={`Page ${apprPage} of approval requests, total ${apprTotal} items`}
        >
          Page {apprPage} • Total {apprTotal}
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (apprItems.length >= 20) {
              setApprPage(apprPage + 1);
            }
          }}
          disabled={apprItems.length < 20}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityState={{ disabled: apprItems.length < 20 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

// Enhanced styles for better approval card layout
const enhancedStyles = StyleSheet.create({
  approvalCard: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  approvalInfo: {
    flex: 1,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusBadgeContainer: {
    marginLeft: spacing.sm,
  },
  approvalDetails: {
    marginBottom: spacing.sm,
  },
  leaveDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: radii.sm,
  },
  correctionDetails: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.secondary + '10',
    borderRadius: radii.sm,
  },
  reasonContainer: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  approveBtn: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  rejectBtn: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  approveBtnText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 13,
  },
  rejectBtnText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default ApprovalsView;
