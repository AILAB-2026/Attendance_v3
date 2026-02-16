import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, RefreshControl, ScrollView, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { spacing, radii, shadows } from '@/constants/theme';
import DateRangePicker from '@/components/DateRangePicker';
import { apiService } from '@/lib/api';
import Chip from '@/components/manage/shared/Chip';
import StickyHeader from '@/components/manage/shared/StickyHeader';
import { formatDateLocal } from '@/lib/date';

interface CorrectionsViewProps {
  corrLoading: boolean;
  corrRefreshing: boolean;
  setCorrRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  loadCorrections: () => Promise<void>;
  corrItems: Array<any>;
  corrRange: { startDate: string; endDate: string };
  setCorrRange: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string }>>;
  setCorrPage: React.Dispatch<React.SetStateAction<number>>;
  corrQuery: string;
  setCorrQuery: React.Dispatch<React.SetStateAction<string>>;
  corrStatus: 'pending' | 'approved' | 'rejected';
  setCorrStatus: React.Dispatch<React.SetStateAction<'pending' | 'approved' | 'rejected'>>;
  corrTotal: number;
  compact: boolean;
  corrPage: number;
  handleCorrectionApproval: (id: string, status: string) => Promise<void>;
  setRejectCtx: React.Dispatch<React.SetStateAction<{ id: string; reason: string } | null>>;
  today: Date;
  styles: any;
  SkeletonRow: React.FC;
  setCompact: React.Dispatch<React.SetStateAction<boolean>>;
}

const CorrectionsView: React.FC<CorrectionsViewProps> = ({
  corrLoading,
  corrRefreshing,
  setCorrRefreshing,
  loadCorrections,
  corrItems,
  corrRange,
  setCorrRange,
  setCorrPage,
  corrQuery,
  setCorrQuery,
  corrStatus,
  setCorrStatus,
  corrTotal,
  compact,
  corrPage,
  handleCorrectionApproval,
  setRejectCtx,
  today,
  styles,
  SkeletonRow,
  setCompact
}) => {
  const handleReset = () => {
    setCorrQuery('');
    setCorrStatus('pending');
    setCorrPage(1);
    setCorrRange({
      startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: formatDateLocal(today)
    });
  };

  const handleApprove = async (itemId: string) => {
    try { await Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    Alert.alert('Confirm', 'Approve this attendance correction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        style: 'default',
        onPress: async () => {
          try {
            const handleApprove = async (id: string) => {
              await handleCorrectionApproval(id, 'approved');
            };
            await handleApprove(itemId);
            await loadCorrections();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to approve');
          }
        }
      }
    ]);
  };

  if (corrLoading) {
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
        data={corrItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        ListHeaderComponentStyle={{ marginBottom: 0, paddingBottom: 0, zIndex: 2, marginTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={corrRefreshing}
            onRefresh={async () => {
              setCorrRefreshing(true);
              await loadCorrections();
              setCorrRefreshing(false);
            }}
          />
        }
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <StickyHeader 
            accessibilityLabel="Time correction requests filters"
            style={{ marginTop: 0, paddingTop: spacing.xs }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <TouchableOpacity onPress={() => setCompact(c => !c)} style={[styles.compactChip, compact && styles.compactChipActive]} accessibilityRole="button" accessibilityLabel={`Toggle compact mode, currently ${compact ? 'on' : 'off'}`}>
                <Text style={[styles.compactChipText, compact && styles.compactChipTextActive]}>{compact ? 'Compact: On' : 'Compact: Off'}</Text>
              </TouchableOpacity>
            </View>
            <DateRangePicker
              value={corrRange}
              onChange={(v) => {
                setCorrRange(v);
                setCorrPage(1);
              }}
            />
            <View style={{ position: 'relative' }}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or Emp No"
                placeholderTextColor={colors.textSecondary}
                value={corrQuery}
                onChangeText={(t) => {
                  setCorrQuery(t);
                  setCorrPage(1);
                }}
                accessibilityLabel="Search correction requests"
                accessibilityHint="Type employee name or number to filter correction requests"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {!!corrQuery && (
                <TouchableOpacity
                  onPress={() => { setCorrQuery(''); setCorrPage(1); }}
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
              accessibilityLabel="Correction status filters"
            >
              <View style={styles.filterChips}>
                {(['pending', 'approved', 'rejected'] as const).map(k => (
                  <Chip
                    key={k}
                    label={k[0].toUpperCase() + k.slice(1)}
                    selected={corrStatus === k}
                    onPress={() => { setCorrStatus(k); setCorrPage(1); }}
                    accessibilityRole="radio"
                    accessibilityLabel={`Filter by ${k} corrections`}
                  />
                ))}
                <Chip 
                  label="Refresh" 
                  onPress={() => loadCorrections()}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh corrections list"
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
              accessibilityLabel={`Showing ${corrItems.length} of ${corrTotal} correction requests`}
            >
              Showing {corrItems.length} of {corrTotal}
            </Text>
          </StickyHeader>
        }
        renderItem={({ item }) => (
          <View 
            style={[styles.row, compact && styles.rowCompact]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Time correction request from ${item.name}, employee number ${item.empNo}, status ${item.status}, date ${String(item.date).slice(0, 10)}, submitted ${String(item.createdAt).replace('T', ' ').slice(0, 19)}`}
          >
            <View style={enhancedStyles.correctionCard}>
              <View style={enhancedStyles.correctionHeader}>
                <View style={enhancedStyles.correctionInfo}>
                  <Text style={styles.name}>
                    {item.name} <Text style={styles.muted}>({item.empNo})</Text>
                  </Text>
                  <View style={enhancedStyles.correctionTypeIndicator}>
                    <View style={[
                      enhancedStyles.correctionTypeDot,
                      { backgroundColor: colors.secondary }
                    ]} />
                    <Text style={[styles.meta, { fontWeight: '600', color: colors.secondary }]}>
                      TIME CORRECTION
                    </Text>
                  </View>
                </View>
                
                <View style={enhancedStyles.correctionStatusBadgeContainer}>
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

              <View style={enhancedStyles.correctionDetails}>
                <View style={enhancedStyles.dateTimeContainer}>
                  <View style={enhancedStyles.dateSection}>
                    <Text style={[styles.meta, { fontWeight: '700', color: colors.primary }]}>
                      📅 {String(item.date).slice(0, 10)}
                    </Text>
                  </View>
                  
                  <View style={enhancedStyles.timeSection}>
                    <View style={enhancedStyles.timeRow}>
                      <Text style={[styles.meta, { fontWeight: '600' }]}>Clock In:</Text>
                      <Text style={[styles.meta, { 
                        color: item.clockIn ? colors.success : colors.textSecondary,
                        fontWeight: '700'
                      }]}>
                        {item.clockIn || 'Not recorded'}
                      </Text>
                    </View>
                    <View style={enhancedStyles.timeRow}>
                      <Text style={[styles.meta, { fontWeight: '600' }]}>Clock Out:</Text>
                      <Text style={[styles.meta, { 
                        color: item.clockOut ? colors.success : colors.textSecondary,
                        fontWeight: '700'
                      }]}>
                        {item.clockOut || 'Not recorded'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.meta, { marginTop: spacing.sm, color: colors.textSecondary }]}>
                  Submitted: {String(item.createdAt).replace('T', ' ').slice(0, 19)}
                </Text>
                
                {!!item.reason && (
                  <View style={enhancedStyles.correctionReasonContainer}>
                    <Text style={[styles.meta, { fontWeight: '600', marginBottom: spacing.xs }]}>
                      Reason for correction:
                    </Text>
                    <Text style={[styles.meta, { fontStyle: 'italic', color: colors.textSecondary }]}>
                      "{item.reason}"
                    </Text>
                  </View>
                )}
              </View>

              {item.status === 'pending' && (
                <View 
                  style={enhancedStyles.correctionActionButtons}
                  accessibilityRole="toolbar"
                  accessibilityLabel="Correction approval actions"
                >
                  <TouchableOpacity
                    style={[enhancedStyles.correctionActionBtn, enhancedStyles.correctionApproveBtn]}
                    onPress={() => handleApprove(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Approve time correction for ${item.name}`}
                    accessibilityHint="Approves this time correction request"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={enhancedStyles.correctionApproveBtnText}>✓ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[enhancedStyles.correctionActionBtn, enhancedStyles.correctionRejectBtn]}
                    onPress={async () => { try { await Haptics.selectionAsync?.(); } catch {} setRejectCtx({ id: item.id, reason: '' }); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Reject time correction for ${item.name}`}
                    accessibilityHint="Opens dialog to reject this correction with a reason"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={enhancedStyles.correctionRejectBtnText}>✗ Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View 
            style={styles.center}
            accessibilityRole="text"
            accessibilityLabel="No correction requests found. Try changing the date range or status filter."
          >
            <Text style={styles.emptyTitle}>No corrections</Text>
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
            if (corrPage > 1) {
              setCorrPage(corrPage - 1);
            }
          }}
          disabled={corrPage <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityState={{ disabled: corrPage <= 1 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Prev</Text>
        </TouchableOpacity>
        <Text 
          style={styles.meta}
          accessibilityRole="text"
          accessibilityLabel={`Page ${corrPage} of correction requests, total ${corrTotal} items`}
        >
          Page {corrPage} • Total {corrTotal}
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { flex: undefined, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
          onPress={() => {
            if (corrItems.length >= 20) {
              setCorrPage(corrPage + 1);
            }
          }}
          disabled={corrItems.length < 20}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityState={{ disabled: corrItems.length < 20 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.secondaryBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

// Enhanced styles for better correction card layout
const enhancedStyles = StyleSheet.create({
  correctionCard: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  correctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  correctionInfo: {
    flex: 1,
  },
  correctionTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  correctionTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  correctionStatusBadgeContainer: {
    marginLeft: spacing.sm,
  },
  correctionDetails: {
    marginBottom: spacing.sm,
  },
  dateTimeContainer: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateSection: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeSection: {
    marginTop: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  correctionReasonContainer: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.secondary + '10',
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  correctionActionButtons: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  correctionActionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  correctionApproveBtn: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  correctionRejectBtn: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  correctionApproveBtnText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 13,
  },
  correctionRejectBtnText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default CorrectionsView;
