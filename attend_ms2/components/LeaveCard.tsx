import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { safeFormatDate } from '@/lib/date';
import { Calendar, Clock, FileText } from 'lucide-react-native';

import { Leave } from '@/types/attendance';
import colors from '@/constants/colors';
import { useAttendance } from '@/hooks/use-attendance-store';

type LeaveCardProps = {
  leave: Leave;
  onPress?: (leave: Leave) => void;
  showActions?: boolean;
  onApprove?: (leaveId: string) => void;
  onReject?: (leaveId: string) => void;
};

const LeaveCard = ({
  leave,
  onPress,
  showActions = false,
  onApprove,
  onReject,
}: LeaveCardProps) => {
  const { user } = useAttendance();

  const formatDate = (dateString: string) => {
    return safeFormatDate(dateString, 'MMM d, yyyy');
  };

  const getDuration = (startDate: string, endDate: string) => {
    // IMPORTANT: Use backend's effectiveDays if available, as it excludes weekends/holidays
    if (leave.effectiveDays !== undefined && leave.effectiveDays !== null) {
      const days = leave.effectiveDays;
      // If single-day and explicitly marked half-day, show Half Day with AM/PM when present
      if (days === 0.5 && leave.duration === 'half') {
        return `Half Day${leave.halfDayPeriod ? ` (${leave.halfDayPeriod})` : ''}`;
      }
      return `${days} day${days !== 1 ? 's' : ''}`;
    }

    // Fallback: Simple calculation (doesn't account for weekends/holidays)
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '--';
    const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days <= 0) return '--';
    // If single-day and explicitly marked half-day, show Half Day with AM/PM when present
    if (days === 1 && leave.duration === 'half') {
      return `Half Day${leave.halfDayPeriod ? ` (${leave.halfDayPeriod})` : ''}`;
    }
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  const getLeaveTypeColor = (type: Leave['type']) => {
    return colors.leave[type] || colors.primary;
  };

  const getStatusColor = (status: Leave['status']) => {
    return colors.status[status] || colors.textSecondary;
  };

  const getLeaveTypeText = (type: Leave['type']) => {
    // Normalize: lowercase and remove "leave" suffix if present
    const normalized = String(type || '').toLowerCase().replace(/[_\s]?leave$/i, '').trim();

    switch (normalized) {
      case 'annual': return 'Annual Leave';
      case 'medical': return 'Medical Leave';
      case 'compensatory': return 'Compensatory Leave';
      case 'hospitalised': return 'Hospitalised';
      case 'childcare': return 'ChildCare Leave';
      case 'unpaid': return 'Unpaid Leave';
      case 'others': return 'Others';
      default:
        // Capitalize each word for unknown types
        return String(type || '')
          .split(/[\s_]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress(leave);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      disabled={!onPress}
      testID={`leave-card-${leave.id}`}
    >
      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: getLeaveTypeColor(leave.type) }]}>
          <Text style={styles.typeText}>{getLeaveTypeText(leave.type)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(leave.status) }]}>
          <Text style={styles.statusText}>{leave.status}</Text>
        </View>
      </View>

      {/* Employee Info Row */}
      <View style={styles.employeeRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name || 'E').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.employeeMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.employeeName} numberOfLines={1}>{user?.name || 'Employee'}</Text>
            {!!(user as any)?.companyCode && (
              <Text style={styles.companyBadge} numberOfLines={1}>{(user as any).companyCode}</Text>
            )}
          </View>
          {!!leave.empNo && (
            <Text style={styles.employeeSub} numberOfLines={1}>Emp No: {leave.empNo}</Text>
          )}
        </View>
      </View>

      <View style={styles.dateRow}>
        <Calendar size={16} color={colors.textSecondary} />
        <Text style={styles.dateText}>
          {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
        </Text>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{getDuration(leave.startDate, leave.endDate)}</Text>
        </View>
      </View>

      <View style={styles.reasonRow}>
        <FileText size={16} color={colors.textSecondary} />
        <Text style={styles.reasonText} numberOfLines={2}>{leave.reason}</Text>
      </View>

      {leave.status !== 'pending' && leave.approvedAt && (
        <View style={styles.infoRow}>
          <Clock size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {leave.status === 'approved' ? 'Approved' : 'Rejected'} by {leave.approvedBy} on {safeFormatDate(leave.approvedAt, 'MMM d, yyyy')}
          </Text>
        </View>
      )}

      {leave.status === 'rejected' && leave.rejectedReason && (
        <View style={styles.rejectionRow}>
          <Text style={styles.rejectionLabel}>Reason:</Text>
          <Text style={styles.rejectionText}>{leave.rejectedReason}</Text>
        </View>
      )}

      {showActions && leave.status === 'pending' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => onReject && onReject(leave.id)}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => onApprove && onApprove(leave.id)}
          >
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  employeeMeta: {
    marginLeft: 8,
    flex: 1,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  companyBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.badge.companyBg,
    borderWidth: 1,
    borderColor: colors.badge.companyBorder,
    color: colors.badge.companyText,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 100,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  durationBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reasonText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  rejectionRow: {
    backgroundColor: colors.error + '10',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 10,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default LeaveCard;