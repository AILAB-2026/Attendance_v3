import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,

  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { format, startOfMonth, endOfMonth, subMonths, subDays, addMonths } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Calendar, Plus, X, Upload, Check, ChevronDown, Camera, FileText, Image as ImageIcon } from 'lucide-react-native';

import { useAttendance } from '@/hooks/use-attendance-store';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import LeaveCard from '@/components/LeaveCard';
import { Leave, LeaveType } from '@/types/attendance';
import DateRangePicker from '@/components/DateRangePicker';
import { parseDateLocal } from '@/lib/date';
import StatusModal, { StatusType } from '@/components/StatusModal';

import { User } from '@/types/attendance';

// Helper to get leave balance safely
function getLeaveBalance(user: User | null, type: LeaveType): number {
  if (user && typeof user === 'object' && 'leaveBalance' in user && user.leaveBalance) {
    return user.leaveBalance[type] ?? 0;
  }
  return 0;
}

export default function LeaveScreen() {
  const { user, leaves, isLoading, applyLeave, getLeavesByDateRange, refreshAttendance } = useAttendance();

  const [modalVisible, setModalVisible] = useState(false);
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  // List filtering date range defaults to current month
  const today = new Date();
  const [listRange, setListRange] = useState({
    startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
  });
  const [rangePreset, setRangePreset] = useState<'today' | 'this-month' | 'next-month' | 'last-month' | 'last-30'>('this-month');

  const applyPreset = (preset: 'today' | 'this-month' | 'next-month' | 'last-month' | 'last-30') => {
    setRangePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = format(now, 'yyyy-MM-dd');
      setListRange({ startDate: d, endDate: d });
      return;
    }
    if (preset === 'this-month') {
      setListRange({ startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(endOfMonth(now), 'yyyy-MM-dd') });
      return;
    }
    if (preset === 'next-month') {
      const next = addMonths(now, 1);
      setListRange({ startDate: format(startOfMonth(next), 'yyyy-MM-dd'), endDate: format(endOfMonth(next), 'yyyy-MM-dd') });
      return;
    }
    if (preset === 'last-month') {
      const last = subMonths(now, 1);
      setListRange({ startDate: format(startOfMonth(last), 'yyyy-MM-dd'), endDate: format(endOfMonth(last), 'yyyy-MM-dd') });
      return;
    }
    const start = subDays(now, 29);
    setListRange({ startDate: format(start, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') });
  };
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leaveType, setLeaveType] = useState<LeaveType | null>(null);
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('all');
  const [duration, setDuration] = useState<'full' | 'half'>('full');
  const [halfDayPeriod, setHalfDayPeriod] = useState<'AM' | 'PM' | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | LeaveType>('all');
  const [leaveTypeDropdownOpen, setLeaveTypeDropdownOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  // Status modal state
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalType, setStatusModalType] = useState<StatusType>('info');
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');

  const initials = useMemo(() => {
    const name = (user as any)?.name || '';
    if (!name) return ((user as any)?.empNo || '').slice(0, 2).toUpperCase();
    const parts = String(name).trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }, [user]);

  const filteredLeaves = useMemo(() => {
    let ranged = getLeavesByDateRange(listRange.startDate, listRange.endDate);
    if (activeTab !== 'all') ranged = ranged.filter((leave) => leave.status === activeTab);
    if (typeFilter !== 'all') ranged = ranged.filter((leave) => leave.type === typeFilter);
    return ranged;
  }, [getLeavesByDateRange, listRange.startDate, listRange.endDate, activeTab, typeFilter]);

  const summary = useMemo(() => {
    const total = filteredLeaves.length;
    const pending = filteredLeaves.filter(l => l.status === 'pending').length;
    const approved = filteredLeaves.filter(l => l.status === 'approved');
    const approvedDays = approved.reduce((s, l: any) => s + Number(l.effectiveDays ?? (l.startDate === l.endDate && l.duration === 'half' ? 0.5 : Math.max(1, Math.floor((parseDateLocal(l.endDate).getTime() - parseDateLocal(l.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1))), 0);
    return { total, pending, approvedDays };
  }, [filteredLeaves]);

  // Derived form validation
  const selectedBalance = useMemo(() => getLeaveBalance(user as User | null, leaveType as LeaveType), [user, leaveType]);
  const workingDays = (user as any)?.config?.workingDays ?? 6;
  const holidays = useMemo(() => new Set((user as any)?.config?.holidays || []), [user]);

  const disabledDates = useMemo(() => {
    const dates: string[] = [];
    // Generate weekends for range +/- 1 year for visual disabling
    const start = subMonths(new Date(), 2);
    const end = addMonths(new Date(), 12);
    const cursor = new Date(start);
    while (cursor <= end) {
      const day = cursor.getDay();
      const isSun = day === 0;
      const isSat = day === 6;

      // Disable if it's a 0-weight day
      let disabled = false;
      if (isSun && workingDays < 7) disabled = true;
      if (isSat && workingDays <= 5) disabled = true;
      // Note: For 5.5 days, Sat is 0.5, so we keep it enabled (selectable)

      if (disabled) {
        dates.push(format(cursor, 'yyyy-MM-dd'));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [workingDays]);

  const requestedDays = useMemo(() => {
    const s = parseDateLocal(startDate); const e = parseDateLocal(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;

    // Half day single selection override
    if (s.getTime() === e.getTime() && duration === 'half') return 0.5;

    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const dStr = format(cur, 'yyyy-MM-dd');
      const day = cur.getDay(); // 0=Sun

      let weight = 1;
      if (holidays.has(dStr)) {
        weight = 0;
      } else if (day === 0) { // Sun
        weight = workingDays >= 7 ? 1 : 0;
      } else if (day === 6) { // Sat
        if (workingDays <= 5) weight = 0;
        else if (workingDays === 5.5) weight = 0.5;
        else weight = 1;
      }

      count += weight;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, [startDate, endDate, duration, workingDays, holidays]);
  const dateError = useMemo(() => {
    const s = parseDateLocal(startDate); const e = parseDateLocal(endDate);
    if (!startDate || !endDate) return 'Start and end dates are required';
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 'Invalid date format';
    if (e < s) return 'End date must be after or equal to start date';
    return '';
  }, [startDate, endDate]);
  const reasonError = useMemo(() => (!reason.trim() ? 'Reason is required' : ''), [reason]);
  const balanceError = useMemo(() => {
    const paid = ['annual', 'medical', 'compensatory', 'hospitalised', 'childcare', 'unpaid', 'others'] as const;
    if (leaveType && paid.includes(leaveType)) {
      if (selectedBalance <= 0) return `${leaveType} leave balance is 0`;
      if (requestedDays > selectedBalance && requestedDays > 0) return `Requested ${requestedDays}, available ${selectedBalance}`;
    }
    return '';
  }, [leaveType, requestedDays, selectedBalance]);
  const halfError = useMemo(() => {
    if (startDate === endDate && duration === 'half' && !halfDayPeriod) {
      return 'Please select AM or PM for half-day';
    }
    return '';
  }, [startDate, endDate, duration, halfDayPeriod]);
  const leaveTypeError = !leaveType ? 'Please select a leave type' : '';
  const isFormValid = !leaveTypeError && !dateError && !reasonError && !balanceError && !halfError;

  const handlePickImage = async () => {
    try {
      setAttachmentModalVisible(false);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const name = asset.uri.split('/').pop() || 'image.jpg';
        setAttachment({
          uri: asset.uri,
          name: name,
          mimeType: 'image/jpeg'
        });
      }
    } catch (error) { }
  };

  const handlePickDocument = async () => {
    try {
      setAttachmentModalVisible(false);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType
        });
      }
    } catch (error) { }
  };

  const pickAttachment = async () => {
    if (Platform.OS === 'web') {
      handlePickDocument(); // Web handles both
      return;
    }
    setAttachmentModalVisible(true);
  };

  const handleSubmit = async () => {
    // Show errors if form is invalid
    if (!isFormValid) {
      setShowErrors(true);

      // Show appropriate modal based on the error type
      if (leaveTypeError) {
        setStatusModalType('warning');
        setStatusModalTitle('Leave Type Required');
        setStatusModalMessage('Please select a leave type before submitting your request.');
        setStatusModalVisible(true);
      } else if (balanceError) {
        setStatusModalType('warning');
        setStatusModalTitle('Insufficient Leave Balance');
        setStatusModalMessage(balanceError);
        setStatusModalVisible(true);
      } else if (dateError) {
        setStatusModalType('warning');
        setStatusModalTitle('Invalid Date Range');
        setStatusModalMessage(dateError);
        setStatusModalVisible(true);
      } else if (halfError) {
        setStatusModalType('warning');
        setStatusModalTitle('Half Day Selection Required');
        setStatusModalMessage(halfError);
        setStatusModalVisible(true);
      } else if (reasonError) {
        setStatusModalType('warning');
        setStatusModalTitle('Reason Required');
        setStatusModalMessage('Please provide a reason for your leave request.');
        setStatusModalVisible(true);
      }
      return;
    }

    try {
      setIsSubmitting(true);
      await applyLeave({
        startDate,
        endDate,
        type: leaveType as LeaveType,
        reason: reason.trim(),
        attachmentUri: attachment ? attachment.uri : undefined,
        attachmentName: attachment ? attachment.name : undefined,
        attachmentMimeType: attachment ? attachment.mimeType : undefined,
        duration: startDate === endDate ? duration : undefined,
        halfDayPeriod: startDate === endDate && duration === 'half' ? halfDayPeriod : undefined,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setModalVisible(false);
      resetForm();

      // Show success message
      setStatusModalType('success');
      setStatusModalTitle('Leave Request Submitted');
      setStatusModalMessage('Your leave request has been submitted successfully and is pending approval.');
      setStatusModalVisible(true);
    } catch (error) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      let msg = (error as Error)?.message || 'Failed to submit leave request. Please try again.';

      // Remove "Error:" or "error:" prefix from the message if present
      msg = msg.replace(/^Error:\s*/i, '').trim();

      // Check error type and set appropriate modal type and title
      if (msg.toLowerCase().includes('overlap')) {
        setStatusModalType('warning');
        setStatusModalTitle('Leave Request');
      } else if (msg.toLowerCase().includes('allocation') || msg.toLowerCase().includes('balance')) {
        setStatusModalType('warning');
        setStatusModalTitle('Leave Allocation');
      } else {
        setStatusModalType('error');
        setStatusModalTitle('Leave Request Failed');
      }
      setStatusModalMessage(msg);
      setStatusModalVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setLeaveType(null);
    setReason('');
    setAttachment(null);
    setDuration('full');
    setHalfDayPeriod(undefined);
    setLeaveTypeDropdownOpen(false);
    setShowErrors(false);
  };

  const renderItem = ({ item }: { item: Leave }) => (
    <LeaveCard leave={item} />
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No leave requests found</Text>
    </View>
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshAttendance();
    } catch (e) {
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoader size="large" color={colors.primary} />
      </View>
    );
  }

  // Render list header with all the content that should scroll with the list
  const renderListHeader = () => (
    <>


      <View style={{ marginBottom: spacing.md }}>
        <DateRangePicker value={listRange} onChange={setListRange} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
          {([
            { key: 'today', label: 'Today' },
            { key: 'this-month', label: 'This Month' },
            { key: 'next-month', label: 'Next Month' },
            { key: 'last-month', label: 'Last Month' },
            { key: 'last-30', label: 'Last 30 Days' },
          ] as const).map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => applyPreset(p.key)}
              style={[styles.typeTab, rangePreset === p.key && styles.typeTabActive]}
            >
              <Text style={[styles.typeTabText, rangePreset === p.key && styles.typeTabTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.header}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>Leave Balance</Text>
          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{getLeaveBalance(user as User | null, 'annual')}</Text>
              <Text style={styles.balanceLabel}>Annual</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{getLeaveBalance(user as User | null, 'medical')}</Text>
              <Text style={styles.balanceLabel}>Medical</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{getLeaveBalance(user as User | null, 'compensatory')}</Text>
              <Text style={styles.balanceLabel}>Comp Off</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{getLeaveBalance(user as User | null, 'hospitalised')}</Text>
              <Text style={styles.balanceLabel}>Hospitalised</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{getLeaveBalance(user as User | null, 'childcare')}</Text>
              <Text style={styles.balanceLabel}>Childcare</Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceValue}>{getLeaveBalance(user as User | null, 'unpaid')}</Text>
              <Text style={styles.balanceLabel}>Unpaid</Text>
            </View>
          </View>
        </View>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Requests</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.approvedDays.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Approved Days</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.addButtonText}>Apply for Leave</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'approved' && styles.activeTab]}
          onPress={() => setActiveTab('approved')}
        >
          <Text style={[styles.tabText, activeTab === 'approved' && styles.activeTabText]}>Approved</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rejected' && styles.activeTab]}
          onPress={() => setActiveTab('rejected')}
        >
          <Text style={[styles.tabText, activeTab === 'rejected' && styles.activeTabText]}>Rejected</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredLeaves as Leave[]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => Keyboard.dismiss()}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Apply for Leave</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                  disabled={isSubmitting}
                >
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <Text style={styles.inputLabel}>Leave Type</Text>

                {/* Dropdown Selector for Leave Type */}
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity
                    style={styles.dropdownSelect}
                    onPress={() => setLeaveTypeDropdownOpen(!leaveTypeDropdownOpen)}
                    disabled={isSubmitting}
                  >
                    <View style={styles.dropdownValueRow}>
                      <Text style={[styles.dropdownValueText, !leaveType && { color: colors.textSecondary }]}>
                        {leaveType ? leaveType.charAt(0).toUpperCase() + leaveType.slice(1) + ' Leave' : 'Select Leave Type'}
                      </Text>
                      {leaveType && (['annual', 'medical', 'compensatory', 'hospitalised', 'childcare', 'unpaid', 'others'] as const).includes(leaveType) && (
                        <View style={styles.dropdownBadge}>
                          <Text style={styles.dropdownBadgeText}>
                            Balance: {getLeaveBalance(user as User | null, leaveType)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <ChevronDown
                      size={20}
                      color={colors.textSecondary}
                      style={{ transform: [{ rotate: leaveTypeDropdownOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {/* Dropdown Options */}
                  {leaveTypeDropdownOpen && (
                    <View style={styles.dropdownOptions}>
                      {(['annual', 'medical', 'compensatory', 'hospitalised', 'childcare', 'unpaid', 'others'] as LeaveType[]).map((type) => {
                        const balance = getLeaveBalance(user as User | null, type);
                        const isPaidLeave = (['annual', 'medical', 'compensatory', 'hospitalised', 'childcare', 'unpaid'] as const).includes(type as any);
                        const hasZeroBalance = isPaidLeave && balance <= 0;
                        const isSelected = leaveType === type;
                        const typeColor = colors.leave[type as keyof typeof colors.leave] || colors.primary;

                        return (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.dropdownOption,
                              isSelected && { backgroundColor: typeColor + '15' }
                            ]}
                            onPress={() => {
                              setLeaveType(type);
                              setLeaveTypeDropdownOpen(false);
                            }}
                            disabled={isSubmitting}
                          >
                            <View style={[styles.dropdownOptionDot, { backgroundColor: typeColor }]} />
                            <Text style={[
                              styles.dropdownOptionText,
                              isSelected && { color: typeColor, fontWeight: '600' }
                            ]}>
                              {type === 'others' ? 'Other Leave' : type.charAt(0).toUpperCase() + type.slice(1) + ' Leave'}
                            </Text>
                            {isPaidLeave && (
                              <Text style={[
                                styles.dropdownOptionBalance,
                                hasZeroBalance && styles.dropdownOptionBalanceWarning
                              ]}>
                                ({balance} days)
                              </Text>
                            )}
                            {isSelected && <Check size={16} color={typeColor} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Inline validations and info */}
                {showErrors && !!leaveTypeError && <Text style={styles.errorText}>{leaveTypeError}</Text>}
                {showErrors && !!dateError && <Text style={styles.errorText}>{dateError}</Text>}
                {showErrors && !!reasonError && <Text style={styles.errorText}>{reasonError}</Text>}
                {requestedDays > 0 && (
                  <Text style={styles.helperText}>Requested: {requestedDays === 0.5 ? 'Half Day' : `${requestedDays} day${requestedDays > 1 ? 's' : ''}`}</Text>
                )}
                {showErrors && !!balanceError && <Text style={styles.errorText}>{balanceError}</Text>}
                {showErrors && !!halfError && <Text style={styles.errorText}>{halfError}</Text>}

                <Text style={styles.inputLabel}>Date Range</Text>
                <DateRangePicker
                  value={{ startDate, endDate }}
                  onChange={({ startDate: s, endDate: e }) => {
                    setStartDate(s);
                    setEndDate(e);
                    // Reset half-day if multi-day becomes selected
                    if (s !== e) {
                      setDuration('full');
                      setHalfDayPeriod(undefined);
                    }
                  }}
                  disabledDates={disabledDates}
                  publicHolidays={Array.from(holidays) as string[]}
                />

                {/* Single-day duration controls */}
                {startDate === endDate && (
                  <View style={styles.durationContainer}>
                    <Text style={styles.inputLabel}>Duration</Text>
                    <View style={styles.durationRow}>
                      <TouchableOpacity
                        style={[styles.durationBtn, duration === 'full' && styles.durationBtnActive]}
                        onPress={() => {
                          setDuration('full');
                          setHalfDayPeriod(undefined);
                        }}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.durationBtnText, duration === 'full' && styles.durationBtnTextActive]}>Full Day</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.durationBtn, duration === 'half' && styles.durationBtnActive]}
                        onPress={() => setDuration('half')}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.durationBtnText, duration === 'half' && styles.durationBtnTextActive]}>Half Day</Text>
                      </TouchableOpacity>
                    </View>

                    {duration === 'half' && (
                      <View style={styles.halfRow}>
                        <TouchableOpacity
                          style={[styles.durationBtn, halfDayPeriod === 'AM' && styles.durationBtnActive]}
                          onPress={() => setHalfDayPeriod('AM')}
                          disabled={isSubmitting}
                        >
                          <Text style={[styles.durationBtnText, halfDayPeriod === 'AM' && styles.durationBtnTextActive]}>AM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.durationBtn, halfDayPeriod === 'PM' && styles.durationBtnActive]}
                          onPress={() => setHalfDayPeriod('PM')}
                          disabled={isSubmitting}
                        >
                          <Text style={[styles.durationBtnText, halfDayPeriod === 'PM' && styles.durationBtnTextActive]}>PM</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.inputLabel}>Reason</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Enter reason for leave"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                  onFocus={() => {
                    // Close dropdown when focusing on reason input
                    setLeaveTypeDropdownOpen(false);
                  }}
                />

                <Text style={styles.inputLabel}>Attachment (Optional)</Text>
                {attachment ? (
                  <View style={styles.attachmentContainer}>
                    <View style={styles.attachmentInfo}>
                      {attachment.mimeType === 'application/pdf' ? (
                        <FileText size={20} color={colors.primary} />
                      ) : (
                        <ImageIcon size={20} color={colors.primary} />
                      )}
                      <Text style={styles.attachmentText} numberOfLines={1}>
                        {attachment.name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeAttachmentButton}
                      onPress={() => setAttachment(null)}
                      disabled={isSubmitting}
                    >
                      <X size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.attachmentButton}
                    onPress={pickAttachment}
                    disabled={isSubmitting}
                  >
                    <Upload size={20} color={colors.primary} />
                    <Text style={styles.attachmentButtonText}>Upload Document</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <CustomLoader color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Attachment Selection Modal */}
      <Modal
        visible={attachmentModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAttachmentModalVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Upload Document</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setAttachmentModalVisible(false)}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.pickerSubtitle}>Choose the type of document to upload:</Text>

            <View style={styles.pickerOptions}>
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={handlePickImage}
              >
                <View style={[styles.pickerIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <ImageIcon size={32} color={colors.primary} />
                </View>
                <Text style={styles.pickerOptionTitle}>Upload Image</Text>
                <Text style={styles.pickerOptionSubtitle}>JPG, PNG</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerOption}
                onPress={handlePickDocument}
              >
                <View style={[styles.pickerIconContainer, { backgroundColor: colors.error + '15' }]}>
                  <FileText size={32} color={colors.error} />
                </View>
                <Text style={styles.pickerOptionTitle}>Upload PDF</Text>
                <Text style={styles.pickerOptionSubtitle}>PDF documents (max 10MB)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status Modal for errors and success messages */}
      <StatusModal
        visible={statusModalVisible}
        type={statusModalType}
        title={statusModalTitle}
        message={statusModalMessage}
        buttons={[
          {
            text: 'OK',
            onPress: () => setStatusModalVisible(false),
            style: 'primary',
          },
        ]}
        onClose={() => setStatusModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  header: {
    marginBottom: spacing.md,
  },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  balanceItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: spacing.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  typeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeTab: {
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
  typeTabActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  typeTabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeTabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.md,
    maxHeight: Platform.OS === 'web' ? 400 : undefined,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  leaveTypeContainer: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  leaveTypeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  leaveTypeBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  leaveTypeBtnDisabled: {
    opacity: 0.7,
  },
  leaveTypeBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  leaveTypeBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  leaveTypeBalance: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  leaveTypeBalanceActive: {
    color: colors.primary,
  },
  leaveTypeBtnSpacer: {
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateTextInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  dateToText: {
    marginHorizontal: spacing.sm,
    color: colors.textSecondary,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.md,
    minHeight: 100,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attachmentButtonText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.primary,
  },
  attachmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  attachmentText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
  },
  removeAttachmentButton: {
    padding: spacing.xs,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontSize: 12,
  },
  helperText: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontSize: 12,
  },
  durationContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  halfRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  durationBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  durationBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  durationBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // Dropdown styles for leave type selector
  dropdownContainer: {
    marginBottom: spacing.md,
  },
  dropdownSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
  },
  dropdownValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  dropdownValueText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  dropdownBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  dropdownBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  dropdownOptions: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  dropdownOptionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  dropdownOptionBalance: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  dropdownOptionBalanceWarning: {
    color: colors.error,
    fontWeight: '600',
  },
  // Attachment picker modal styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  pickerContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  pickerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  pickerOptions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  pickerOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  pickerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pickerOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  pickerOptionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});