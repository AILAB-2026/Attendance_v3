import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,

  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { Image } from 'expo-image';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { HardHat, Calendar, MapPin, Users, Check, X } from 'lucide-react-native';

import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import { ToolboxMeetingWithAttendance } from '@/types/toolbox';
import { apiService } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import DateRangePicker from '@/components/DateRangePicker';

export default function ToolboxScreen() {
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ToolboxMeetingWithAttendance | null>(null);
  const [attended, setAttended] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'attended'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [meetings, setMeetings] = useState<ToolboxMeetingWithAttendance[]>([]);
  const [search, setSearch] = useState('');
  // Date range for client-side filtering (defaults to current month)
  const today = new Date();
  const [listRange, setListRange] = useState({
    startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
  });
  const [rangePreset, setRangePreset] = useState<'today' | 'this-month' | 'last-month' | 'last-30'>('this-month');

  const applyPreset = (preset: 'today' | 'this-month' | 'last-month' | 'last-30') => {
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
    if (preset === 'last-month') {
      const last = subMonths(now, 1);
      setListRange({ startDate: format(startOfMonth(last), 'yyyy-MM-dd'), endDate: format(endOfMonth(last), 'yyyy-MM-dd') });
      return;
    }
    const start = subDays(now, 29);
    setListRange({ startDate: format(start, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') });
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

  const loadMeetings = useCallback(async (opts?: { force?: boolean }) => {
    if (!user?.companyCode || !user?.employeeNo) return;
    const companyCode = user.companyCode;
    const employeeNo = user.employeeNo;
    try {
      if (!opts?.force) setIsLoading(true);
      const resp = await apiService.getToolboxMeetings(
        companyCode,
        employeeNo,
        activeTab === 'upcoming'
      );
      // Ensure stable types
      const list = Array.isArray(resp) ? resp : (resp as any)?.data ?? [];
      setMeetings(list as ToolboxMeetingWithAttendance[]);
    } catch (error) {
      if (!opts?.force) setIsLoading(false);
      throw error;
    } finally {
      if (!opts?.force) setIsLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMeetings({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadMeetings]);

  const filteredMeetings = useMemo(() => {
    // 1) Range filter
    let arr = meetings.filter((m) => {
      const d = format(new Date(m.meetingDate), 'yyyy-MM-dd');
      return d >= listRange.startDate && d <= listRange.endDate;
    });
    // 2) Tab filter
    if (activeTab === 'attended') {
      arr = arr.filter((meeting: ToolboxMeetingWithAttendance) => meeting.attendee?.attended);
    } else if (activeTab === 'upcoming') {
      arr = arr.filter((meeting: ToolboxMeetingWithAttendance) => !meeting.isPast);
    }
    // 3) Deduplicate using composite key (title + date + presenter)
    const seen = new Map<string, ToolboxMeetingWithAttendance>();
    for (const m of arr) {
      const key = `${(m.title || '').trim().toLowerCase()}|${format(new Date(m.meetingDate), 'yyyy-MM-dd')}|${(m.presenterName || '').trim().toLowerCase()}`;
      const prev = seen.get(key);
      if (!prev) {
        seen.set(key, m);
      } else {
        // Keep the most recently updated
        const tPrev = new Date(prev.updatedAt || prev.createdAt || prev.meetingDate).getTime();
        const tCurr = new Date(m.updatedAt || m.createdAt || m.meetingDate).getTime();
        if (tCurr > tPrev) seen.set(key, m);
      }
    }
    arr = Array.from(seen.values());
    // 4) Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((m) => {
        return [m.title, m.description, m.location, m.presenterName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
    }
    // 5) Sort: upcoming first, then by date desc
    arr.sort((a, b) => {
      const da = new Date(a.meetingDate).getTime();
      const db = new Date(b.meetingDate).getTime();
      return db - da; // newest dates first
    });
    return arr;
  }, [meetings, activeTab, listRange.startDate, listRange.endDate, search]);

  const handleMeetingPress = (meeting: ToolboxMeetingWithAttendance) => {
    setSelectedMeeting(meeting);
    setAttended(meeting.attendee?.attended || false);
    setNotes(meeting.attendee?.notes || '');
    setModalVisible(true);
  };

  const handleAcknowledge = async () => {
    if (!selectedMeeting) return;
    if (!user?.companyCode || !user?.employeeNo) return;
    const companyCode = user.companyCode;
    const employeeNo = user.employeeNo;
    try {
      setIsSubmitting(true);
      await apiService.acknowledgeMeeting(companyCode, employeeNo, {
        meetingId: selectedMeeting.id,
        attended,
        notes: notes.trim() || undefined,
      });
      // After successful backend update, refetch meetings to reflect server state
      await loadMeetings({ force: true });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setModalVisible(false);
      setSelectedMeeting(null);
      setNotes('');
      // Optional toast/alert
      // Alert.alert('Success', 'Meeting acknowledgment recorded');
    } catch (error) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      if (typeof Alert !== 'undefined') {
        Alert.alert('Error', 'Failed to acknowledge meeting. Please try again.');
      }
      // Ensure we are showing server truth
      await loadMeetings({ force: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMeetingCard = ({ item }: { item: ToolboxMeetingWithAttendance }) => (
    <TouchableOpacity
      style={styles.meetingCard}
      onPress={() => handleMeetingPress(item)}
      testID={`meeting-card-${item.id}`}
    >
      <View style={styles.meetingHeader}>
        <View style={styles.meetingTitleContainer}>
          <HardHat size={20} color={colors.primary} />
          <Text style={styles.meetingTitle}>{item.title}</Text>
        </View>
        <View style={styles.statusContainer}>
          {item.isMandatory && (
            <View style={styles.mandatoryBadge}>
              <Text style={styles.mandatoryText}>Mandatory</Text>
            </View>
          )}
          {item.isPast && !item.attendee?.attended && (
            <View style={styles.missedBadge}>
              <Text style={styles.missedText}>Missed</Text>
            </View>
          )}
          {item.attendee?.attended && (
            <View style={styles.attendedBadge}>
              <Check size={12} color="#fff" />
            </View>
          )}
        </View>
      </View>

      <Text style={styles.meetingDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.meetingDetails}>
        <View style={styles.detailItem}>
          <Calendar size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>
            {format(new Date(item.meetingDate), 'MMM d, yyyy')}
          </Text>
        </View>

        {item.location && (
          <View style={styles.detailItem}>
            <MapPin size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.location}</Text>
          </View>
        )}

        <View style={styles.detailItem}>
          <Users size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>
            {item.attendedCount}/{item.totalAttendees} attended
          </Text>
        </View>
      </View>

      {item.safetyTopics.length > 0 && (
        <View style={styles.topicsContainer}>
          <Text style={styles.topicsLabel}>Safety Topics:</Text>
          <View style={styles.topicsList}>
            {item.safetyTopics.slice(0, 3).map((topic, index) => (
              <View key={index} style={styles.topicBadge}>
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
            {item.safetyTopics.length > 3 && (
              <View style={styles.topicBadge}>
                <Text style={styles.topicText}>+{item.safetyTopics.length - 3}</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <HardHat size={48} color={colors.textSecondary} />
      <Text style={styles.emptyText}>No safety meetings found</Text>
      {!!search && (
        <Text style={[styles.emptyText, { marginTop: 6 }]}>Try clearing search or expanding the date range</Text>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoader size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        {(user as any)?.profileImageUri ? (
          <Image
            source={{ uri: (user as any).profileImageUri }}
            style={styles.profileImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
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
        <DateRangePicker value={listRange} onChange={setListRange} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
          {([
            { key: 'today', label: 'Today' },
            { key: 'this-month', label: 'This Month' },
            { key: 'last-month', label: 'Last Month' },
            { key: 'last-30', label: 'Last 30 Days' },
          ] as const).map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => applyPreset(p.key)}
              style={[styles.presetTab, rangePreset === p.key && styles.presetTabActive]}
            >
              <Text style={[styles.presetTabText, rangePreset === p.key && styles.presetTabTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {/* Search input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search meetings, topics, location, presenter"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'attended' && styles.activeTab]}
          onPress={() => setActiveTab('attended')}
        >
          <Text style={[styles.tabText, activeTab === 'attended' && styles.activeTabText]}>Attended</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredMeetings}
        renderItem={renderMeetingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meeting Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedMeeting && (
                <>
                  <Text style={styles.meetingModalTitle}>{selectedMeeting.title}</Text>
                  <Text style={styles.meetingModalDescription}>{selectedMeeting.description}</Text>

                  <View style={styles.meetingModalDetails}>
                    <View style={styles.modalDetailItem}>
                      <Calendar size={16} color={colors.textSecondary} />
                      <Text style={styles.modalDetailText}>
                        {format(new Date(selectedMeeting.meetingDate), 'EEEE, MMMM d, yyyy')}
                      </Text>
                    </View>

                    {selectedMeeting.location && (
                      <View style={styles.modalDetailItem}>
                        <MapPin size={16} color={colors.textSecondary} />
                        <Text style={styles.modalDetailText}>{selectedMeeting.location}</Text>
                      </View>
                    )}

                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Presenter:</Text>
                      <Text style={styles.modalDetailText}>{selectedMeeting.presenterName}</Text>
                    </View>
                  </View>

                  {selectedMeeting.safetyTopics.length > 0 && (
                    <View style={styles.modalTopicsContainer}>
                      <Text style={styles.modalTopicsLabel}>Safety Topics:</Text>
                      {selectedMeeting.safetyTopics.map((topic, index) => (
                        <View key={index} style={styles.modalTopicItem}>
                          <Text style={styles.modalTopicText}>• {topic}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.attendanceSection}>
                    <Text style={styles.attendanceLabel}>Attendance:</Text>
                    <TouchableOpacity
                      style={[styles.attendanceOption, attended && styles.attendanceOptionActive]}
                      onPress={() => setAttended(true)}
                      disabled={isSubmitting}
                    >
                      <Check size={16} color={attended ? '#fff' : colors.success} />
                      <Text style={[styles.attendanceOptionText, attended && styles.attendanceOptionTextActive]}>
                        I attended this meeting
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.attendanceOption, !attended && styles.attendanceOptionActive]}
                      onPress={() => setAttended(false)}
                      disabled={isSubmitting}
                    >
                      <X size={16} color={!attended ? '#fff' : colors.error} />
                      <Text style={[styles.attendanceOptionText, !attended && styles.attendanceOptionTextActive]}>
                        I did not attend this meeting
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Notes (Optional):</Text>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add any notes or comments about this meeting"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      editable={!isSubmitting}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            {selectedMeeting?.isPast && !selectedMeeting?.attendee?.attended && (
              <Text style={[styles.helperMuted, { textAlign: 'center', paddingHorizontal: 12, marginBottom: 8 }]}>This meeting is over; acknowledgement is closed.</Text>
            )}
            <TouchableOpacity
              style={[styles.acknowledgeButton, (selectedMeeting?.isPast && !selectedMeeting?.attendee?.attended) && { opacity: 0.5 }]}
              onPress={handleAcknowledge}
              disabled={isSubmitting || (selectedMeeting?.isPast && !selectedMeeting?.attendee?.attended)}
            >
              {isSubmitting ? (
                <CustomLoader color="#fff" size="small" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.acknowledgeButtonText}>{(selectedMeeting?.isPast && !selectedMeeting?.attendee?.attended) ? 'Acknowledgement Closed' : 'Acknowledge'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
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
  listContent: {
    paddingBottom: spacing.xl,
  },
  searchRow: {
    marginBottom: spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    color: colors.text,
    backgroundColor: colors.card,
  },
  meetingCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  meetingTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mandatoryBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mandatoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  missedBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  missedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  attendedBadge: {
    backgroundColor: colors.success,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  meetingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  topicsContainer: {
    marginTop: 8,
  },
  topicsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  topicsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  topicBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl + spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  helperMuted: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  meetingModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  meetingModalDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  meetingModalDetails: {
    marginBottom: 16,
    gap: 8,
  },
  modalDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  modalDetailText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  modalTopicsContainer: {
    marginBottom: 16,
  },
  modalTopicsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  modalTopicItem: {
    marginBottom: 4,
  },
  modalTopicText: {
    fontSize: 14,
    color: colors.text,
  },
  attendanceSection: {
    marginBottom: 16,
  },
  attendanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  attendanceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  attendanceOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  attendanceOptionText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  attendanceOptionTextActive: {
    color: '#fff',
  },
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
  },
  acknowledgeButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  acknowledgeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: spacing.sm,
  },
});