import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { safeFormatDate, parseDateLocal } from '@/lib/date';
import { Calendar, Clock, FileText, Check, X, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { useAttendance } from '@/hooks/use-attendance-store';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import { Leave, LeaveType, LeaveStatus } from '@/types/attendance';

export default function LeaveDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { leaves, isLoading, updateLeaveStatus } = useAttendance();

  const [isUpdating, setIsUpdating] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  const leave = leaves.find((item) => item.id === id);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return safeFormatDate(dateString, 'MMM d, yyyy');
  };

  const getDuration = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return '';
    const s = parseDateLocal(startDate);
    const e = parseDateLocal(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days <= 0) return '';
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  const getLeaveTypeColor = (type?: Leave['type']) => {
    if (!type) return colors.primary;
    return colors.leave[type as LeaveType] || colors.primary;
  };

  const getStatusColor = (status?: Leave['status']) => {
    if (!status) return colors.textSecondary;
    return colors.status[status as LeaveStatus] || colors.textSecondary;
  };

  const getLeaveTypeText = (type?: Leave['type']) => {
    if (!type) return '';
    // Normalize: lowercase and remove "leave" suffix if present
    const normalized = String(type || '').toLowerCase().replace(/[_\s]?leave$/i, '').trim();

    switch (normalized) {
      case 'annual': return 'Annual Leave';
      case 'medical': return 'Medical Leave';
      case 'emergency': return 'Emergency Leave';
      case 'unpaid': return 'Unpaid Leave';
      case 'other': return 'Other Leave';
      default:
        // Capitalize each word for unknown types
        return String(type || '')
          .split(/[\s_]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
    }
  };

  const handleApprove = async () => {
    if (!leave) return;

    try {
      setIsUpdating(true);
      await updateLeaveStatus({
        leaveId: leave.id,
        status: 'approved',
      });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Success', 'Leave request approved successfully');
    } catch (error) {
      console.error('Error approving leave:', error);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', 'Failed to approve leave request');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!leave) return;

    if (!showRejectionInput) {
      setShowRejectionInput(true);
      return;
    }

    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    try {
      setIsUpdating(true);
      await updateLeaveStatus({
        leaveId: leave.id,
        status: 'rejected',
        rejectedReason: rejectionReason.trim(),
      });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Success', 'Leave request rejected successfully');
      setShowRejectionInput(false);
    } catch (error) {
      console.error('Error rejecting leave:', error);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Error', 'Failed to reject leave request');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoader size="large" color={colors.primary} />
      </View>
    );
  }

  if (!leave) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Leave request not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.primary} />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Stack.Screen
        options={{
          title: 'Leave Details',
          headerTitleStyle: { color: colors.text },
          headerStyle: { backgroundColor: colors.card },
        }}
      />

      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: getLeaveTypeColor(leave.type as LeaveType) }]}>
          <Text style={styles.typeText}>{getLeaveTypeText(leave.type as LeaveType)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(leave.status as LeaveStatus) }]}>
          <Text style={styles.statusText}>{leave.status}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Calendar size={20} color={colors.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Date Range</Text>
            <Text style={styles.infoValue}>
              {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
            </Text>
            <Text style={styles.infoDuration}>{getDuration(leave.startDate, leave.endDate)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <FileText size={20} color={colors.textSecondary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Reason</Text>
            <Text style={styles.infoValue}>{leave.reason}</Text>
          </View>
        </View>

        {leave.attachmentUri && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <FileText size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Attachment</Text>
                <Image
                  source={{ uri: leave.attachmentUri }}
                  style={styles.attachmentImage}
                  contentFit="cover"
                />
              </View>
            </View>
          </>
        )}

        {leave.status !== 'pending' && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Clock size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {leave.status === 'approved' ? 'Approved By' : 'Rejected By'}
                </Text>
                <Text style={styles.infoValue}>{leave.approvedBy || 'N/A'}</Text>
                {leave.approvedAt && (
                  <Text style={styles.infoDate}>on {safeFormatDate(leave.approvedAt, 'MMM d, yyyy')}</Text>
                )}
              </View>
            </View>
          </>
        )}

        {leave.status === 'rejected' && leave.rejectedReason && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <X size={20} color={colors.error} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Rejection Reason</Text>
                <Text style={styles.rejectionReason}>{leave.rejectedReason}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {leave.status === 'pending' && (
        <View style={styles.actionsContainer}>
          {showRejectionInput ? (
            <View style={styles.rejectionInputContainer}>
              <Text style={styles.rejectionInputLabel}>Reason for Rejection:</Text>
              <TextInput
                style={styles.rejectionInput}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="Enter reason for rejection"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.rejectionButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowRejectionInput(false)}
                  disabled={isUpdating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleReject}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <CustomLoader size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <CustomLoader size="small" color="#fff" />
                ) : (
                  <>
                    <X size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={handleApprove}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <CustomLoader size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
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
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  notFoundText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.sm,
  },
  backButtonText: {
    marginLeft: spacing.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  typeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.caption.fontSize,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.caption.fontSize,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.h3,
    fontWeight: '600',
  },
  infoDuration: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  infoDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  attachmentImage: {
    width: '100%',
    height: 200,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  rejectionReason: {
    ...typography.body,
    color: colors.error,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radii.md,
    marginHorizontal: spacing.sm,
    ...shadows.subtle,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: spacing.sm,
  },
  rejectionInputContainer: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    width: '100%',
  },
  rejectionInputLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  rejectionInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.lg,
    minHeight: 80,
  },
  rejectionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.bodyMuted,
    fontWeight: '600',
  },
  confirmButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.error,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});