import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SectionList, FlatList, RefreshControl, TextInput, TouchableOpacity, Platform, Modal, ToastAndroid, Pressable, LayoutAnimation, UIManager, useWindowDimensions } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';


import { useAuth } from '@/hooks/use-auth';
import { useAttendance } from '@/hooks/use-attendance-store';
import { apiService } from '@/lib/api';
import StatusModal, { StatusType, StatusModalButton } from '@/components/StatusModal';

export default function ScheduleScreen() {
  const { user } = useAuth();
  const {
    getProjectTasksCacheEntry,
    ensureProjectTasksForDate: ensureTasksShared,
    clearProjectTasksCache,
    projectTasksCacheVersion,
    updateProjectTaskStatus,
  } = useAttendance();


  // Status Modal state
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalType, setStatusModalType] = useState<StatusType>('info');
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');
  const [statusModalButtons, setStatusModalButtons] = useState<StatusModalButton[]>([]);

  const showStatusModal = (title: string, message: string, type: StatusType, buttons?: StatusModalButton[]) => {
    setStatusModalTitle(title);
    setStatusModalMessage(message);
    setStatusModalType(type);
    setStatusModalButtons(buttons || [{ text: 'OK', onPress: () => setStatusModalVisible(false), style: 'primary' }]);
    setStatusModalVisible(true);
  };



  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [assigned, setAssigned] = useState<Array<{ id: string; siteName?: string; projectName?: string; startDate?: string; endDate?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Manager/admin check (for potential future features)
  const isManager = useMemo(() => (user?.role || '').toLowerCase() === 'manager' || (user?.role || '').toLowerCase() === 'admin', [user?.role]);
  type FilterValue = 'all' | 'active' | 'upcoming' | 'past' | 'with-tasks';
  const [activeFilter, setActiveFilter] = useState<FilterValue>('active');
  const [query, setQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<{ id: string; name: string; status: string; projectName: string } | null>(null);
  const [iosToast, setIosToast] = useState<string | null>(null);
  const [slowMode, setSlowMode] = useState<boolean>(false);
  const [compactDensity, setCompactDensity] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [hideCompletedProjects, setHideCompletedProjects] = useState<boolean>(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState<boolean>(false);
  const { width } = useWindowDimensions();
  const isNarrow = width < 360;
  const isVeryNarrow = width < 320;
  // Active preset key for quick chips selection UI
  const [activePreset, setActivePreset] = useState<
    'today' | 'this-week' | 'this-month' | 'last-month' | 'last-30' | 'reset' | null
  >(null);
  // Task group preferences
  type TaskStatusKey = 'in-progress' | 'blocked' | 'pending' | 'done';
  const defaultGroupOrder: TaskStatusKey[] = ['in-progress', 'blocked', 'pending', 'done'];
  const [groupOrder, setGroupOrder] = useState<TaskStatusKey[]>(defaultGroupOrder);
  const [groupVisibility, setGroupVisibility] = useState<Record<TaskStatusKey, boolean>>({ 'in-progress': true, blocked: true, pending: true, done: true });
  // per-project collapsed groups map
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, Partial<Record<TaskStatusKey, boolean>>>>({});

  const scrollRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      setIosToast(msg);
      setTimeout(() => setIosToast(null), 1500);
    }
  };

  // (moved expand/collapse helpers below after visibleAssignments)



  // Prefetch tasks for all projects in the selected week
  useEffect(() => {
    const projects = Array.from(new Set(
      assigned.map(a => (a.projectName || '').trim()).filter(Boolean)
    ));
    projects.forEach((pn) => ensureProjectTasks(pn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, assigned]);



  // Enable smooth layout changes
  useEffect(() => {
    // On Android with the New Architecture (Fabric), this call is a no-op and produces a warning.
    // Detect Fabric via global.nativeFabricUIManager and skip in that case.
    const isAndroid = Platform.OS === 'android';
    const isFabric = typeof (global as any)?.nativeFabricUIManager !== 'undefined';
    const canEnable = (UIManager as any)?.setLayoutAnimationEnabledExperimental;
    if (isAndroid && canEnable && !isFabric) {
      try { (UIManager as any).setLayoutAnimationEnabledExperimental(true); } catch { }
    }
  }, []);

  // Persist and restore last selected date and filter
  useEffect(() => {
    (async () => {
      try {
        const savedDate = await AsyncStorage.getItem('@schedule_selected_date');
        const savedFilter = await AsyncStorage.getItem('@schedule_active_filter');
        const savedSlow = await AsyncStorage.getItem('@schedule_slow_mode');
        const savedCompact = await AsyncStorage.getItem('@schedule_compact_density');
        const savedHideCompleted = await AsyncStorage.getItem('@schedule_hide_completed_projects');
        const savedShowCompletedTasks = await AsyncStorage.getItem('@schedule_show_completed_tasks');


        const savedExpanded = await AsyncStorage.getItem('@schedule_expanded_ids');
        const savedOrder = await AsyncStorage.getItem('@schedule_group_order');
        const savedVisibility = await AsyncStorage.getItem('@schedule_group_visibility');
        const savedCollapsed = await AsyncStorage.getItem('@schedule_group_collapsed');
        if (savedDate) setSelectedDate(savedDate);
        if (savedFilter && ['all', 'active', 'upcoming', 'past', 'with-tasks'].includes(savedFilter)) {
          setActiveFilter(savedFilter as FilterValue);
        }
        if (savedSlow != null) setSlowMode(savedSlow === '1');
        if (savedCompact != null) setCompactDensity(savedCompact === '1');
        if (savedHideCompleted != null) setHideCompletedProjects(savedHideCompleted === '1');
        if (savedShowCompletedTasks != null) setShowCompletedTasks(savedShowCompletedTasks === '1');
        if (savedExpanded) {
          try { const arr = JSON.parse(savedExpanded) as string[]; setExpandedIds(new Set(arr)); } catch { }
        }
        if (savedOrder) {
          try { const arr = JSON.parse(savedOrder) as TaskStatusKey[]; if (Array.isArray(arr) && arr.length) setGroupOrder(arr as TaskStatusKey[]); } catch { }
        }
        if (savedVisibility) {
          try { const obj = JSON.parse(savedVisibility) as Record<TaskStatusKey, boolean>; if (obj) setGroupVisibility({ 'in-progress': obj['in-progress'] ?? true, blocked: obj.blocked ?? true, pending: obj.pending ?? true, done: obj.done ?? true }); } catch { }
        }
        if (savedCollapsed) {
          try { const obj = JSON.parse(savedCollapsed) as Record<string, Partial<Record<TaskStatusKey, boolean>>>; if (obj) setGroupCollapsed(obj); } catch { }
        }

      } catch { }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('@schedule_selected_date', selectedDate).catch(() => { });
  }, [selectedDate]);
  useEffect(() => {
    AsyncStorage.setItem('@schedule_active_filter', activeFilter).catch(() => { });
  }, [activeFilter]);
  useEffect(() => {
    AsyncStorage.setItem('@schedule_slow_mode', slowMode ? '1' : '0').catch(() => { });
  }, [slowMode]);
  useEffect(() => {
    AsyncStorage.setItem('@schedule_compact_density', compactDensity ? '1' : '0').catch(() => { });
  }, [compactDensity]);
  useEffect(() => {
    AsyncStorage.setItem('@schedule_hide_completed_projects', hideCompletedProjects ? '1' : '0').catch(() => { });
  }, [hideCompletedProjects]);
  useEffect(() => {
    AsyncStorage.setItem('@schedule_show_completed_tasks', showCompletedTasks ? '1' : '0').catch(() => { });
  }, [showCompletedTasks]);

  useEffect(() => {
    try { const arr = Array.from(expandedIds); AsyncStorage.setItem('@schedule_expanded_ids', JSON.stringify(arr)); } catch { }
  }, [expandedIds]);
  useEffect(() => {
    try { AsyncStorage.setItem('@schedule_group_order', JSON.stringify(groupOrder)); } catch { }
  }, [groupOrder]);
  useEffect(() => {
    try { AsyncStorage.setItem('@schedule_group_visibility', JSON.stringify(groupVisibility)); } catch { }
  }, [groupVisibility]);
  useEffect(() => {
    try { AsyncStorage.setItem('@schedule_group_collapsed', JSON.stringify(groupCollapsed)); } catch { }
  }, [groupCollapsed]);

  // Calendar helpers (single-date select)
  const startOfGrid = (date: Date) => startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const endOfGrid = (date: Date) => endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const buildCalendarDays = (date: Date) => {
    const start = startOfGrid(date);
    const end = endOfGrid(date);
    const days: Date[] = [];
    let cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };
  // Format a date as local YYYY-MM-DD to avoid UTC shifting
  const toYMD = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const isSameYMD = (a: Date, b: Date) => toYMD(a) === toYMD(b);

  // Week strip (derived from selectedDate)
  const weekDays = useMemo(() => {
    const sel = new Date(selectedDate + 'T00:00:00');
    const start = startOfWeek(sel, { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // Friendlier date for UI display
  const friendlySelectedDate = useMemo(() => {
    const dt = new Date(selectedDate + 'T00:00:00');
    return format(dt, 'EEE, d MMM yyyy');
  }, [selectedDate]);
  const friendlySelectedDateShort = useMemo(() => {
    const dt = new Date(selectedDate + 'T00:00:00');
    return format(dt, 'd MMM yyyy');
  }, [selectedDate]);

  // Load assigned items; if filter is 'active', we can ask API for that day only; otherwise fetch all and filter client-side
  const loadAssigned = async (date: string, filter: FilterValue) => {
    if (!(user as any)?.companyCode || !user?.empNo) return;
    try {
      setLoading(true);
      if (slowMode) { await new Promise(r => setTimeout(r, 600)); }
      if (filter === 'active') {
        const res = await apiService.getAssignedSchedule((user as any).companyCode, user.empNo, date);
        const list = Array.isArray(res?.data) ? res.data : [];
        setAssigned(list);
      } else {
        // Fetch all and filter locally
        const res = await apiService.getAssignedSchedule((user as any).companyCode, user.empNo);
        const list = Array.isArray(res?.data) ? res.data : [];
        setAssigned(list);
      }
    } catch (e: any) {
      showStatusModal('Failed to load schedule', e?.message || 'Please try again', 'error');
    } finally {
      setLoading(false);
    }
  };

  const ensureProjectTasks = async (projectName?: string, force = false) => {
    if (!projectName) return;
    if (slowMode) { await new Promise(r => setTimeout(r, 600)); }
    await ensureTasksShared(selectedDate, projectName, force);
    if (force) showToast('Tasks refreshed');
  };

  useEffect(() => {
    loadAssigned(selectedDate, activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empNo, selectedDate, activeFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalidate task caches so next expansions fetch fresh data
      clearProjectTasksCache();
      setSelectedTask(null);
      await loadAssigned(selectedDate, activeFilter);
    } finally { setRefreshing(false); }
  };

  const shiftDate = (delta: number) => {
    const [y, m, d] = selectedDate.split('-').map((x) => Number(x));
    const dt = new Date(y, (m - 1), d);
    dt.setDate(dt.getDate() + delta);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
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

  const totalSites = new Set(assigned.map(a => (a.siteName || '').trim()).filter(Boolean)).size;
  const totalProjects = new Set(assigned.map(a => (a.projectName || '').trim()).filter(Boolean)).size;

  // Compute filtered list for non-active filters relative to selectedDate
  const filteredAssignments = useMemo(() => {
    const toDate = (s?: string) => (s ? new Date(s + 'T00:00:00') : undefined);
    const sel = new Date(selectedDate + 'T00:00:00');
    return assigned.filter(a => {
      const start = toDate(a.startDate);
      const end = toDate(a.endDate);

      if (activeFilter === 'active') {
        // Active: not upcoming and not past
        if (start && start.getTime() > sel.getTime()) return false; // upcoming
        if (end && end.getTime() < sel.getTime()) return false; // past
        // For active items, also exclude fully completed projects
        if (a.projectName) {
          const entry = getProjectTasksCacheEntry(selectedDate, a.projectName);
          const items = entry?.items;
          if (Array.isArray(items)) {
            const remaining = items.filter((t: any) => t.status !== 'done').length;
            return remaining > 0; // Only show if has remaining tasks
          }
          // Unknown yet (not loaded) — include it for now
          return true;
        }
        return true; // Non-project items are active
      }

      if (activeFilter === 'upcoming') {
        // Upcoming if start exists and is strictly after selected date
        return !!start && start.getTime() > sel.getTime();
      }
      if (activeFilter === 'past') {
        // Past if end exists and is strictly before selected date
        return !!end && end.getTime() < sel.getTime();
      }
      // all
      return true;
    });
  }, [assigned, activeFilter, selectedDate, projectTasksCacheVersion]);

  // Counts for badges
  const counts = useMemo(() => {
    const toDate = (s?: string) => (s ? new Date(s + 'T00:00:00') : undefined);
    const sel = new Date(selectedDate + 'T00:00:00');
    let active = 0, upcoming = 0, past = 0;
    assigned.forEach(a => {
      const start = toDate(a.startDate); const end = toDate(a.endDate);
      if (start && start.getTime() > sel.getTime()) { upcoming++; return; }
      if (end && end.getTime() < sel.getTime()) { past++; return; }
      // Active bucket: exclude fully completed projects (0 remaining), but include non-project or unknown yet
      if (a.projectName) {
        const entry = getProjectTasksCacheEntry(selectedDate, a.projectName);
        const items = entry?.items;
        if (Array.isArray(items)) {
          const remaining = items.filter((t: any) => t.status !== 'done').length;
          if (remaining > 0) active++;
        } else {
          // Unknown yet (not loaded) — count it for now for responsiveness
          active++;
        }
      } else {
        active++;
      }
    });
    return { active, upcoming, past };
  }, [assigned, selectedDate, projectTasksCacheVersion]);

  // Text search across site/project names
  const visibleAssignments = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = filteredAssignments;
    // Filter to only assignments that have tasks (based on fetched cache)
    if (activeFilter === 'with-tasks') {
      list = list.filter((a) => {
        const pn = a.projectName || '';
        const items = pn ? getProjectTasksCacheEntry(selectedDate, pn)?.items : undefined;
        const remaining = Array.isArray(items) ? items.filter((t: any) => t.status !== 'done') : [];
        return remaining.length > 0;
      });
    }
    // Hide completed projects if toggled on
    if (hideCompletedProjects) {
      list = list.filter((a) => {
        if (!a.projectName) return true;
        const items = getProjectTasksCacheEntry(selectedDate, a.projectName)?.items;
        if (!Array.isArray(items) || items.length === 0) return true; // unknown -> keep
        const remaining = items.filter((t: any) => t.status !== 'done');
        return remaining.length > 0;
      });
    }
    // Completed projects remain visible; per-project toggle controls item visibility inside details
    if (!q) return list;
    return list.filter((a) => {
      const s = (a.siteName || '').toLowerCase();
      const p = (a.projectName || '').toLowerCase();
      return s.includes(q) || p.includes(q);
    });
  }, [filteredAssignments, query, activeFilter, projectTasksCacheVersion, selectedDate, hideCompletedProjects]);

  // Expand/Collapse all helpers
  const expandAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const all = new Set<string>(expandedIds);
    visibleAssignments.forEach((a) => all.add(a.id));
    setExpandedIds(all);
    // prefetch tasks for all visible projects
    const projects = Array.from(new Set(visibleAssignments.map(a => (a.projectName || '').trim()).filter(Boolean)));
    projects.forEach((pn) => ensureProjectTasks(pn));
  };
  const collapseAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds(new Set());
  };

  // Prefetch tasks for all current project assignments when filter is 'with-tasks'
  useEffect(() => {
    if (activeFilter !== 'with-tasks') return;
    const projects = Array.from(new Set(assigned.map(a => (a.projectName || '').trim()).filter(Boolean)));
    projects.forEach((pn) => ensureProjectTasks(pn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, assigned]);

  // Warm task cache whenever assigned projects change to keep badge/count accurate
  useEffect(() => {
    const projects = Array.from(new Set(assigned.map(a => (a.projectName || '').trim()).filter(Boolean)));
    projects.forEach((pn) => ensureProjectTasks(pn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigned]);

  const withTasksCount = useMemo(() => {
    // Count projects that have at least one remaining (non-done) task
    let count = 0;
    const seen = new Set<string>();
    assigned.forEach(a => {
      if (!a.projectName) return;
      if (seen.has(a.projectName)) return;
      const items = getProjectTasksCacheEntry(selectedDate, a.projectName)?.items;
      const remaining = Array.isArray(items) ? items.filter((t: any) => t.status !== 'done').length : 0;
      if (remaining > 0) {
        count += 1;
        seen.add(a.projectName);
      }
    });
    return count;
  }, [assigned, projectTasksCacheVersion, selectedDate]);

  // Helpers for group customization
  const moveGroup = (key: TaskStatusKey, dir: -1 | 1) => {
    setGroupOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const cp = [...prev];
      const tmp = cp[idx];
      cp[idx] = cp[ni];
      cp[ni] = tmp;
      return cp;
    });
  };
  const toggleGroupVisibility = (key: TaskStatusKey) => {
    setGroupVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleGroupCollapsed = (projectName: string, key: TaskStatusKey) => {
    setGroupCollapsed((prev) => {
      const p = { ...(prev[projectName] || {}) };
      p[key] = !p[key];
      return { ...prev, [projectName]: p };
    });
  };

  const anyTasksLoading = useMemo(() => {
    const projects = Array.from(new Set(assigned.map(a => (a.projectName || '').trim()).filter(Boolean)));
    return projects.some(pn => !!getProjectTasksCacheEntry(selectedDate, pn)?.loading);
  }, [assigned, projectTasksCacheVersion, selectedDate]);

  // Derive a human-friendly state for each assignment relative to selected date
  type AssignmentState = 'Active' | 'Upcoming' | 'Past';
  const getAssignmentState = (a: { startDate?: string; endDate?: string }): AssignmentState => {
    const toDate = (s?: string) => (s ? new Date(s + 'T00:00:00') : undefined);
    const sel = new Date(selectedDate + 'T00:00:00');
    const start = toDate(a.startDate);
    const end = toDate(a.endDate);
    if (start && start.getTime() > sel.getTime()) return 'Upcoming';
    if (end && end.getTime() < sel.getTime()) return 'Past';
    return 'Active';
  };

  // Local sort helper (defined before sections useMemo)
  const sortAssignmentsFn = (list: typeof assigned) => {
    const order: Record<AssignmentState, number> = { Active: 0, Upcoming: 1, Past: 2 };
    return [...list].sort((a, b) => {
      const sa = getAssignmentState(a);
      const sb = getAssignmentState(b);
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      const ta = `${a.siteName || ''}${a.siteName && a.projectName ? ' · ' : ''}${a.projectName || ''}`.toLowerCase();
      const tb = `${b.siteName || ''}${b.siteName && b.projectName ? ' · ' : ''}${b.projectName || ''}`.toLowerCase();
      return ta.localeCompare(tb);
    });
  };

  // Sort visible assignments by state (Active, Upcoming, Past) and then by title
  const sortAssignments = (list: typeof assigned) => sortAssignmentsFn(list);

  // Build sections for SectionList (must be after sortAssignments is defined)
  const sections = useMemo(() => {
    const titles: AssignmentState[] = ['Active', 'Upcoming', 'Past'];
    const sorted = sortAssignments(visibleAssignments);
    return titles
      .map((title) => ({ title, data: sorted.filter((a) => getAssignmentState(a) === title) }))
      .filter((s) => s.data.length > 0);
  }, [visibleAssignments, selectedDate, projectTasksCacheVersion]);

  return (
    <View style={{ flex: 1 }}>
      <StatusModal
        visible={statusModalVisible}
        type={statusModalType}
        title={statusModalTitle}
        message={statusModalMessage}
        buttons={statusModalButtons}
        onClose={() => setStatusModalVisible(false)}
      />
      <SectionList
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        refreshing={refreshing}
        onRefresh={onRefresh}
        onScroll={(e: any) => {
          const y = e.nativeEvent.contentOffset.y;
          setShowScrollTop(y > 300);
        }}
        scrollEventThrottle={16}
        ListHeaderComponent={(
          <>
            {/* Profile Header (matches History) */}

            {/* Date selector */}
            <View style={styles.stickyWrap}>
              <View style={styles.dateBar}>
                <TouchableOpacity accessibilityLabel="Previous day" style={[styles.dateButton, isNarrow && styles.dateButtonSmall]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => shiftDate(-1)}>
                  {isNarrow ? (
                    <MaterialIcons name="chevron-left" size={isVeryNarrow ? 16 : 18} color={colors.text} />
                  ) : (
                    <Text style={styles.dateButtonText}>Prev</Text>
                  )}
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: isNarrow ? 4 : spacing.sm, flexShrink: 1, minWidth: 0 }}>
                  <TouchableOpacity accessibilityLabel="Open calendar" style={[styles.dateBadge, isNarrow && styles.dateBadgeNarrow, isVeryNarrow && styles.dateBadgeTiny]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => { setCalendarVisible(true); setCurrentMonth(new Date(selectedDate + 'T00:00:00')); }}>
                    <Text style={[styles.dateText, isNarrow && styles.dateTextSmall, isVeryNarrow && styles.dateTextTiny]} numberOfLines={1} ellipsizeMode="tail">{isVeryNarrow ? friendlySelectedDateShort : friendlySelectedDate}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity accessibilityLabel="Next day" style={[styles.dateButton, isNarrow && styles.dateButtonSmall]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => shiftDate(1)}>
                  {isNarrow ? (
                    <MaterialIcons name="chevron-right" size={isVeryNarrow ? 16 : 18} color={colors.text} />
                  ) : (
                    <Text style={styles.dateButtonText}>Next</Text>
                  )}
                </TouchableOpacity>
              </View>
              {/* Week strip for quick navigation */}
              <View style={styles.weekStripRow}>
                <TouchableOpacity
                  accessibilityLabel="Previous week"
                  style={styles.weekNavBtn}
                  onPress={() => shiftDate(-7)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.weekNavText}>{'<'}</Text>
                </TouchableOpacity>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.weekStripContent, { gap: 8 }]}
                  style={styles.weekStripScroll}
                >
                  {weekDays.map((d) => {
                    const active = isSameYMD(d, new Date(selectedDate + 'T00:00:00'));
                    const name = format(d, 'EEE');
                    const num = d.getDate();
                    return (
                      <TouchableOpacity
                        key={d.toISOString()}
                        style={[styles.weekDayCell, active && styles.weekDayCellActive]}
                        onPress={() => setSelectedDate(toYMD(d))}
                        accessibilityLabel={`Select ${name} ${num}`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.weekDayName, active && styles.weekDayTextActive]}>{name}</Text>
                        <Text style={[styles.weekDayNum, active && styles.weekDayTextActive]}>{num}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  accessibilityLabel="Next week"
                  style={styles.weekNavBtn}
                  onPress={() => shiftDate(7)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.weekNavText}>{'>'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }} contentContainerStyle={{ paddingVertical: 6 }}>
              <TouchableOpacity style={[styles.presetTab, activePreset === 'today' && styles.presetTabActive]} onPress={() => {
                const t = new Date();
                const y = t.getFullYear();
                const m = String(t.getMonth() + 1).padStart(2, '0');
                const d = String(t.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
                setActivePreset('today');
              }}>
                <Text style={[styles.presetTabText, activePreset === 'today' && styles.presetTabTextActive]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.presetTab, activePreset === 'this-week' && styles.presetTabActive]} onPress={() => {
                // Jump to Monday of current week
                const base = new Date();
                const monday = startOfWeek(base, { weekStartsOn: 1 });
                const y = monday.getFullYear();
                const m = String(monday.getMonth() + 1).padStart(2, '0');
                const d = String(monday.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
                setActiveFilter('active');
                setActivePreset('this-week');
              }}>
                <Text style={[styles.presetTabText, activePreset === 'this-week' && styles.presetTabTextActive]}>This Week</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.presetTab, activePreset === 'this-month' && styles.presetTabActive]} onPress={() => {
                const first = startOfMonth(new Date());
                const y = first.getFullYear();
                const m = String(first.getMonth() + 1).padStart(2, '0');
                const d = String(first.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
                setActiveFilter('active');
                setActivePreset('this-month');
              }}>
                <Text style={[styles.presetTabText, activePreset === 'this-month' && styles.presetTabTextActive]}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.presetTab, activePreset === 'last-month' && styles.presetTabActive]} onPress={() => {
                const last = subMonths(new Date(), 1);
                const first = startOfMonth(last);
                const y = first.getFullYear();
                const m = String(first.getMonth() + 1).padStart(2, '0');
                const d = String(first.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
                setActiveFilter('active');
                setActivePreset('last-month');
              }}>
                <Text style={[styles.presetTabText, activePreset === 'last-month' && styles.presetTabTextActive]}>Last Month</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.presetTab, activePreset === 'last-30' && styles.presetTabActive]} onPress={() => {
                const t = new Date();
                t.setDate(t.getDate() - 29);
                const y = t.getFullYear();
                const m = String(t.getMonth() + 1).padStart(2, '0');
                const d = String(t.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
                setActiveFilter('active');
                setActivePreset('last-30');
              }}>
                <Text style={[styles.presetTabText, activePreset === 'last-30' && styles.presetTabTextActive]}>Last 30 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.presetTab, activePreset === 'reset' && styles.presetTabActive]} onPress={() => {
                setQuery(''); setActiveFilter('active');
                showToast('Filters reset');
                setActivePreset('reset');
              }}>
                <Text style={[styles.presetTabText, activePreset === 'reset' && styles.presetTabTextActive]}>Reset Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickChip, slowMode && styles.quickChipActive]} onPress={() => setSlowMode(v => !v)}>
                <Text style={[styles.quickChipText, slowMode && styles.quickChipTextActive]}>{slowMode ? 'Slow On' : 'Slow Off'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickChip, compactDensity && styles.quickChipActive]} onPress={() => setCompactDensity(v => !v)}>
                <Text style={[styles.quickChipText, compactDensity && styles.quickChipTextActive]}>{compactDensity ? 'Compact On' : 'Compact Off'}</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Your Assignments</Text>
              <View style={styles.summaryContent}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{assigned.length}</Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalSites}</Text>
                  <Text style={styles.summaryLabel}>Sites</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalProjects}</Text>
                  <Text style={styles.summaryLabel}>Projects</Text>
                </View>
              </View>
            </View>

            {/* Search */}
            <View style={[styles.searchRow, styles.searchWrapper]}>
              <TextInput
                placeholder="Search site or project"
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!query && (
                <TouchableOpacity
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.searchClearBtn}
                >
                  <Text style={styles.searchClearText}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Filters + controls */}
            <View style={styles.stickyWrap}>
              <View style={styles.filterContainer}>
                <ScrollableFilter
                  options={([
                    { value: 'all', label: 'All', count: assigned.length },
                    { value: 'active', label: 'Active', count: counts.active },
                    { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
                    { value: 'past', label: 'Past', count: counts.past },
                    { value: 'with-tasks', label: 'With Tasks', count: withTasksCount },
                  ]) as any}
                  activeValue={activeFilter as any}
                  onChange={(val: any) => setActiveFilter(val)}
                  renderExtra={(opt: any) => {
                    const isWithTasks = opt.value === 'with-tasks';
                    const disabled = isWithTasks && withTasksCount === 0 && !anyTasksLoading;
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialIcons
                          style={{ marginRight: 6 }}
                          name={opt.value === 'all' ? 'view-list' : opt.value === 'active' ? 'play-circle-outline' : opt.value === 'upcoming' ? 'schedule' : opt.value === 'past' ? 'history' : 'assignment-turned-in'}
                          size={16}
                          color={activeFilter === opt.value ? '#fff' : colors.textSecondary}
                        />
                        <Text style={[styles.filterButtonText, activeFilter === opt.value && styles.activeFilterButtonText]}>
                          {opt.label}
                        </Text>
                        {isWithTasks && anyTasksLoading && (
                          <CustomLoader style={{ marginLeft: 6 }} size="small" color={colors.textSecondary} />
                        )}
                        {!!opt.count && (!isWithTasks || !anyTasksLoading) && (
                          <View style={styles.filterCountBadge}>
                            <Text style={styles.filterCountText}>{opt.count}</Text>
                          </View>
                        )}
                      </View>
                    );
                  }}
                  isDisabled={(opt: any) => opt.value === 'with-tasks' && withTasksCount === 0 && !anyTasksLoading}
                />
                {/* Right-side controls */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rightControlsContent} style={styles.rightControlsScroll}>
                  <View style={styles.rightControlsRow}>
                    <TouchableOpacity style={[styles.togglePill]} onPress={expandAll}>
                      <Text style={[styles.togglePillText]}>Expand All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.togglePill]} onPress={collapseAll}>
                      <Text style={[styles.togglePillText]}>Collapse All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.togglePill, hideCompletedProjects && styles.togglePillActive]}
                      onPress={() => setHideCompletedProjects(v => !v)}
                    >
                      <Text style={[styles.togglePillText, hideCompletedProjects && styles.togglePillTextActive]}>Hide Completed Projects</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.togglePill, showCompletedTasks && styles.togglePillActive]}
                      onPress={() => setShowCompletedTasks(v => !v)}
                    >
                      <Text style={[styles.togglePillText, showCompletedTasks && styles.togglePillTextActive]}>{showCompletedTasks ? 'Show All Tasks' : 'Hide Completed Tasks'}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>

            {/* List title */}
            <Text style={styles.sectionTitle}>Assigned Sites & Projects</Text>
          </>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={[styles.sectionCountBadge, section.title === 'Active' ? styles.sectionLeftBadge : section.title === 'Past' ? styles.sectionDoneBadge : null]}>
              <Text style={[styles.sectionCountText, section.title === 'Active' ? styles.sectionLeftText : section.title === 'Past' ? styles.sectionDoneText : null]}>{section.data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item: a }) => {
          const title = (a.siteName || a.projectName) ? `${a.siteName || ''}${a.siteName && a.projectName ? ' · ' : ''}${a.projectName || ''}` : 'Default';
          const dateRange = a.startDate || a.endDate ? `${a.startDate || ''}${a.endDate ? ` → ${a.endDate}` : ''}` : 'Ongoing';
          const state = getAssignmentState(a);
          const isOpen = expandedIds.has(a.id);
          const toggle = async () => {
            const opening = !expandedIds.has(a.id);
            setExpandedIds((prev) => { const nxt = new Set(prev); if (prev.has(a.id)) nxt.delete(a.id); else nxt.add(a.id); return nxt; });
            if (opening && a.projectName) {
              ensureProjectTasks(a.projectName);
            }
          };
          const taskEntry = a.projectName ? getProjectTasksCacheEntry(selectedDate, a.projectName) : undefined;
          const itemsArr = taskEntry?.items;
          const taskCount = itemsArr?.length || 0;
          const doneCount = itemsArr ? itemsArr.filter((t: any) => t.status === 'done').length : 0;
          const remainingCount = itemsArr ? itemsArr.filter((t: any) => t.status !== 'done').length : 0;
          const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
          const hasTasks = taskCount > 0;
          const isCompletedProject = hasTasks && remainingCount === 0;
          return (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <View key={a.id} style={[styles.assignmentCard, compactDensity && styles.assignmentCardCompact, isCompletedProject && styles.assignmentCardCompleted]}>
                <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); toggle(); }} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <View style={styles.assignmentHeader}>
                    <Text style={styles.assignmentTitle} numberOfLines={1}>{title}</Text>
                    <View style={[styles.assignmentBadge,
                    state === 'Active' && styles.assignmentBadgeActive,
                    state === 'Upcoming' && styles.assignmentBadgeUpcoming,
                    state === 'Past' && styles.assignmentBadgePast,
                    ]}>
                      <Text style={styles.assignmentBadgeText}>{state}</Text>
                    </View>
                    {isCompletedProject && (
                      <View style={[styles.assignmentBadge, styles.completedBadge]}>
                        <Text style={[styles.assignmentBadgeText, { color: '#16a34a' }]}>Completed</Text>
                      </View>
                    )}
                    {hasTasks && (
                      <View style={styles.taskCountChip}>
                        <Text style={styles.taskCountText}>{remainingCount} left • {doneCount}/{taskCount} • {progress}%</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                {hasTasks && (
                  <View style={styles.progressBarOuter}>
                    <View style={[styles.progressBarInner, { width: `${progress}%` }]} />
                  </View>
                )}
                <View style={styles.assignmentMetaRow}>
                  <View style={[styles.stateDot,
                  state === 'Active' && styles.stateDotActive,
                  state === 'Upcoming' && styles.stateDotUpcoming,
                  state === 'Past' && styles.stateDotPast,
                  ]} />
                  <Text style={styles.stateText}>{state}</Text>
                  <Text style={styles.assignmentMeta}>  •  Valid: {dateRange}</Text>
                </View>
                <View style={styles.tagRow}>
                  {!!a.siteName && <View style={styles.tag}><Text style={styles.tagText}>Site</Text><Text style={styles.tagValue} numberOfLines={2}>{a.siteName}</Text></View>}
                  {!!a.projectName && <View style={styles.tag}><Text style={styles.tagText}>Project</Text><Text style={styles.tagValue} numberOfLines={2}>{a.projectName}</Text></View>}
                </View>
                {isOpen && !!a.projectName && (
                  <View style={styles.detailsBox}>
                    <View style={styles.detailsHeaderRow}>
                      <Text style={styles.detailsTitle}>Project Tasks</Text>
                      <TouchableOpacity onPress={() => ensureProjectTasks(a.projectName!, true)} style={styles.refreshBtn}>
                        <Text style={styles.refreshBtnText}>Refresh</Text>
                      </TouchableOpacity>
                    </View>
                    {!!taskEntry?.loading && (
                      <>
                        <View style={styles.taskLoadingBanner}>
                          <CustomLoader size="small" color={colors.textSecondary} />
                          <Text style={styles.taskLoadingText}>Fetching tasks…</Text>
                        </View>
                        <View style={styles.taskSkeletonList}>
                          {[0, 1, 2].map((i) => (
                            <View key={i} style={styles.taskSkeletonItem}>
                              <View style={styles.taskSkeletonTitle} />
                              <View style={styles.taskSkeletonStatus} />
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                    {!!taskEntry?.error && (
                      <Text style={[styles.assignmentMeta, { color: '#ef4444' }]}>Error: {taskEntry?.error}</Text>
                    )}
                    {!!taskEntry?.items && (() => {
                      const items = taskEntry!.items!;
                      if (items.length === 0) {
                        return <Text style={styles.assignmentMeta}>No tasks found for this project.</Text>;
                      }
                      const remaining = items.filter((t: any) => t.status !== 'done');
                      if (!showCompletedTasks && remaining.length === 0) {
                        return <Text style={styles.assignmentMeta}>All tasks completed.</Text>;
                      }
                      const effective = showCompletedTasks ? items : remaining;
                      const groupMeta: Record<TaskStatusKey, { label: string; colorStyle: any }> = {
                        'in-progress': { label: 'In Progress', colorStyle: styles.taskStatusInProgress },
                        'blocked': { label: 'Blocked', colorStyle: styles.taskStatusBlocked },
                        'pending': { label: 'Pending', colorStyle: styles.taskStatusPending },
                        'done': { label: 'Done', colorStyle: styles.taskStatusDone },
                      };

                      // Legend and customization controls
                      const counts: Record<TaskStatusKey, number> = {
                        'in-progress': effective.filter((t: any) => t.status === 'in-progress').length,
                        'blocked': effective.filter((t: any) => t.status === 'blocked').length,
                        'pending': effective.filter((t: any) => t.status === 'pending').length,
                        'done': (showCompletedTasks ? effective : items).filter((t: any) => t.status === 'done').length,
                      } as any;

                      return (
                        <View style={{ marginTop: spacing.xs }}>
                          <View style={styles.legendRow}>
                            {defaultGroupOrder.map((k) => (
                              <View key={k} style={styles.legendItem}>
                                <View style={[styles.legendDot, groupMeta[k].colorStyle]} />
                                <Text style={styles.legendText}>{groupMeta[k].label}</Text>
                              </View>
                            ))}
                          </View>

                          <View style={styles.customizeRow}>
                            {groupOrder.map((k, idx) => (
                              <View key={k} style={styles.customizePill}>
                                <TouchableOpacity onPress={() => moveGroup(k, -1)} disabled={idx === 0} style={[styles.customizeBtn, idx === 0 && styles.disabledFilterButton]}>
                                  <MaterialIcons name="chevron-left" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => toggleGroupVisibility(k)} style={[styles.customizeLabel, !groupVisibility[k] && styles.dimmed]}>
                                  <Text style={styles.customizeText}>{groupMeta[k].label}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => moveGroup(k, 1)} disabled={idx === groupOrder.length - 1} style={[styles.customizeBtn, idx === groupOrder.length - 1 && styles.disabledFilterButton]}>
                                  <MaterialIcons name="chevron-right" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>

                          <View style={styles.taskList}>
                            {groupOrder.map((key) => {
                              if (!groupVisibility[key]) return null;
                              if (!showCompletedTasks && key === 'done') return null;
                              const ts = effective.filter((t: any) => t.status === key);
                              if (ts.length === 0) return null;
                              const collapsed = !!groupCollapsed[a.projectName!]?.[key];
                              return (
                                <View key={key} style={{ marginTop: spacing.xs }}>
                                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Toggle ${groupMeta[key].label} group`} onPress={() => toggleGroupCollapsed(a.projectName!, key)} activeOpacity={0.8}>
                                    <View style={styles.taskGroupHeader}>
                                      <Text style={styles.taskGroupTitle}>{groupMeta[key].label}</Text>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={styles.filterCountBadge}><Text style={styles.filterCountText}>{ts.length}</Text></View>
                                        <MaterialIcons name={collapsed ? 'expand-more' : 'expand-less'} size={18} color={colors.textSecondary} />
                                      </View>
                                    </View>
                                  </TouchableOpacity>
                                  {!collapsed && ts.map((t: any) => (
                                    <TouchableOpacity key={t.id} style={[styles.taskItem, compactDensity && styles.taskItemCompact]} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPress={() => setSelectedTask({ id: t.id, name: t.name, status: t.status, projectName: a.projectName! })}>
                                      <Text style={styles.taskName}>{t.name}</Text>
                                      <Text style={[styles.taskStatus,
                                      t.status === 'done' ? styles.taskStatusDone :
                                        t.status === 'in-progress' ? styles.taskStatusInProgress :
                                          t.status === 'blocked' ? styles.taskStatusBlocked : styles.taskStatusPending]}
                                      >
                                        {t.status}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={loading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.assignmentCard]}>
                <View style={{ height: 16, backgroundColor: colors.background, borderRadius: 4, marginBottom: 8 }} />
                <View style={{ height: 8, backgroundColor: colors.background, borderRadius: 4, width: '60%', marginBottom: 8 }} />
                <CustomLoader size="small" color={colors.textSecondary} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            {activeFilter === 'active' && (<>
              <Text style={styles.emptyText}>No assignments valid on {selectedDate}.</Text>
              <Text style={styles.emptyHint}>Try another date or check Upcoming.</Text>
            </>)}
            {activeFilter === 'upcoming' && (<>
              <Text style={styles.emptyText}>No future assignments.</Text>
              <Text style={styles.emptyHint}>Try switching to Active or All.</Text>
            </>)}
            {activeFilter === 'past' && (<>
              <Text style={styles.emptyText}>No past assignments.</Text>
              <Text style={styles.emptyHint}>Try switching to Active or All.</Text>
            </>)}
            {activeFilter === 'with-tasks' && (<>
              <Text style={styles.emptyText}>No projects with remaining tasks.</Text>
              <Text style={styles.emptyHint}>Refresh tasks or adjust filters.</Text>
            </>)}
            {!!query && <Text style={styles.emptyHint}>Search “{query}” returned no results.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
              <TouchableOpacity style={styles.togglePill} onPress={() => {
                const t = new Date();
                const y = t.getFullYear();
                const m = String(t.getMonth() + 1).padStart(2, '0');
                const d = String(t.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
              }}>
                <Text style={styles.togglePillText}>Go to Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.togglePill} onPress={() => setActiveFilter('active')}>
                <Text style={styles.togglePillText}>Show Active</Text>
              </TouchableOpacity>
              {!!query && (
                <TouchableOpacity style={styles.togglePill} onPress={() => { setQuery(''); showToast('Search cleared'); }}>
                  <Text style={styles.togglePillText}>Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />


      {/* Task quick view modal */}
      <Modal visible={!!selectedTask} transparent animationType="fade" onRequestClose={() => setSelectedTask(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTask(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{selectedTask?.name}</Text>
            <Text style={[styles.modalStatus,
            selectedTask?.status === 'done' ? styles.taskStatusDone :
              selectedTask?.status === 'in-progress' ? styles.taskStatusInProgress :
                selectedTask?.status === 'blocked' ? styles.taskStatusBlocked : styles.taskStatusPending]}>
              {selectedTask?.status}
            </Text>
            <Text style={styles.modalMeta}>Tap outside to close</Text>
            {!!selectedTask && (
              <View style={{ marginTop: spacing.md, gap: 8 }}>
                <Text style={styles.detailsTitle}>Update Status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {([
                    { label: 'Pending', value: 'pending' },
                    { label: 'In Progress', value: 'in-progress' },
                    { label: 'Blocked', value: 'blocked' },
                    { label: 'Done', value: 'done' },
                  ] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.statusBtn, selectedTask!.status === opt.value ? styles.statusBtnActive : null]}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      onPress={async () => {
                        try {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          await updateProjectTaskStatus(selectedDate, selectedTask!.projectName, selectedTask!.id, opt.value);
                          setSelectedTask(prev => prev ? ({ ...prev, status: opt.value } as any) : prev);
                          showToast('Task updated');
                        } catch (e: any) {
                          showStatusModal('Update failed', e?.message || 'Please try again', 'error');
                        }
                      }}
                    >
                      <Text style={[styles.statusBtnText, selectedTask!.status === opt.value ? styles.statusBtnTextActive : null]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Calendar modal */}
      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCalendarVisible(false)}>
          <Pressable style={styles.calendarCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity onPress={() => setCurrentMonth((prev: Date) => subMonths(prev, 1))} style={styles.monthNavBtn}>
                <Text style={styles.monthNavText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity onPress={() => setCurrentMonth((prev: Date) => addMonths(prev, 1))} style={styles.monthNavBtn}>
                <Text style={styles.monthNavText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekdayRowCal}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <Text key={d} style={styles.weekdayTextCal}>{d}</Text>
              ))}
            </View>
            <View style={styles.daysGridCal}>
              {buildCalendarDays(currentMonth).map((d) => {
                const inCurrentMonth = d.getMonth() === currentMonth.getMonth();
                const selected = isSameYMD(d, new Date(selectedDate + 'T00:00:00'));
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={[styles.dayCellCal, !inCurrentMonth && styles.dayCellMutedCal, selected && styles.dayCellSelectedCal]}
                    onPress={() => {
                      setSelectedDate(toYMD(d));
                      setCalendarVisible(false);
                    }}
                  >
                    <Text style={[styles.dayTextCal, selected && styles.dayTextSelectedCal]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>


      {
        showScrollTop && (
          <TouchableOpacity
            style={styles.scrollTopBtn}
            accessibilityLabel="Scroll to top"
            onPress={() => scrollRef.current?.scrollToOffset?.({ offset: 0, animated: true })}
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-upward" size={22} color="#fff" />
          </TouchableOpacity>
        )
      }
      {
        !!iosToast && (
          <View pointerEvents="none" style={styles.toastContainer}>
            <View style={styles.toastCard}>
              <Text style={styles.toastText}>{iosToast}</Text>
            </View>
          </View>
        )
      }

    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  taskItemCompact: { paddingVertical: 4 },
  scrollTopBtn: { position: 'absolute', bottom: 16, right: 16, backgroundColor: colors.primary, borderRadius: 24, padding: 10, zIndex: 1, ...shadows.card },

  stickyWrap: { backgroundColor: colors.background, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  // Profile header mirroring History screen
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, ...shadows.card,
  },
  profileImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  profileInfo: { marginLeft: spacing.md, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  metaValue: { color: colors.text, fontWeight: '600' },
  companyBadge: {
    marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill,
    backgroundColor: colors.badge.companyBg, borderWidth: 1, borderColor: colors.badge.companyBorder,
    color: colors.badge.companyText, fontSize: 12, fontWeight: '700', maxWidth: 100,
  },

  // Date bar
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  dateBadge: { backgroundColor: colors.card, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dateText: { ...typography.body, fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.text },
  dateButton: { backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  dateButtonSmall: { paddingHorizontal: spacing.sm, paddingVertical: 8, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  dateBadgeNarrow: { paddingHorizontal: spacing.md, flexShrink: 1, flex: 1, maxWidth: '70%' as any },
  dateButtonText: { color: colors.text, fontWeight: '600' },
  dateTextSmall: { fontSize: 14, lineHeight: 20 },
  dateBadgeTiny: { paddingHorizontal: spacing.sm, paddingVertical: 8 },
  dateTextTiny: { fontSize: 12, lineHeight: 18 },
  // Week strip styles
  weekStripRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.lg },
  weekStripScroll: { flexGrow: 1, marginHorizontal: spacing.sm },
  weekStripContent: { alignItems: 'center' },
  weekDayCell: { minWidth: 52, alignItems: 'center', marginHorizontal: 2, paddingVertical: spacing.sm, paddingHorizontal: 6, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  weekDayCellActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  weekDayName: { ...typography.caption, color: colors.textSecondary },
  weekDayNum: { ...typography.body, color: colors.text, fontWeight: '700' },
  weekDayTextActive: { color: colors.primary },
  weekNavBtn: { width: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  weekNavText: { ...typography.body, color: colors.text, fontWeight: '700' },
  // Summary
  summaryCard: { backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.card },
  summaryTitle: { ...typography.h3, marginBottom: spacing.md },
  summaryContent: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  summaryLabel: { ...typography.caption },
  divider: { width: 1, backgroundColor: colors.border },

  // List section
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  info: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionCountBadge: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  sectionCountText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  sectionLeftBadge: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  sectionLeftText: { color: '#92400e' },
  sectionDoneBadge: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  sectionDoneText: { color: '#166534' },
  emptyContainer: { paddingVertical: spacing.md, alignItems: 'center' },
  emptyText: { ...typography.bodyMuted },
  emptyHint: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  // Search
  searchRow: { marginBottom: spacing.md },
  searchInput: { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: Platform.select({ ios: 12, android: 8, default: 8 }) },
  searchWrapper: { position: 'relative' },
  searchClearBtn: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 4 },
  searchClearText: { fontSize: 18, color: colors.textSecondary },
  // Filters (parity with History)
  filterContainer: { marginBottom: spacing.md },
  filterList: { paddingVertical: spacing.sm },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
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
  disabledFilterButton: { opacity: 0.5 },
  filterCountBadge: { marginLeft: spacing.xs, backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  filterCountText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  taskCountChip: { marginLeft: spacing.sm, backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  taskCountText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  assignmentCard: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  assignmentCardCompact: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  assignmentCardCompleted: { opacity: 0.7 },
  assignmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  assignmentTitle: { ...typography.body, fontWeight: '700', color: colors.text, flex: 1 },
  assignmentBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1 },
  assignmentBadgeActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  assignmentBadgeUpcoming: { backgroundColor: '#0AA0FF22', borderColor: '#0AA0FF55' },
  assignmentBadgePast: { backgroundColor: '#99999922', borderColor: '#99999955' },
  assignmentBadgeText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  completedBadge: { backgroundColor: '#16a34a22', borderColor: '#16a34a55', marginLeft: 8 },
  assignmentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6, backgroundColor: colors.border },
  stateDotActive: { backgroundColor: colors.primary },
  stateDotUpcoming: { backgroundColor: '#0AA0FF' },
  stateDotPast: { backgroundColor: '#999999' },
  stateText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  assignmentMeta: { ...typography.caption, color: colors.textSecondary },
  tagRow: { flexDirection: 'column', gap: 8, marginTop: 6 },
  tag: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  tagText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', flexShrink: 0 },
  tagValue: { ...typography.caption, color: colors.text, flex: 1, flexShrink: 1 },
  detailsBox: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm },
  detailsTitle: { ...typography.caption, fontWeight: '700', color: colors.text, marginBottom: 6 },
  detailsText: { ...typography.caption, color: colors.textSecondary },
  // Tasks
  detailsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshBtn: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  refreshBtnText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  taskLoadingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: spacing.xs },
  taskLoadingText: { ...typography.caption, color: colors.textSecondary },
  taskSkeletonList: { marginTop: spacing.xs, gap: 6 },
  taskSkeletonItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8 },
  taskSkeletonTitle: { height: 10, backgroundColor: colors.background, borderRadius: 4, flex: 1, marginRight: spacing.md },
  taskSkeletonStatus: { height: 10, width: 60, backgroundColor: colors.background, borderRadius: radii.pill },
  taskList: { marginTop: spacing.xs, gap: 6 },
  taskItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  taskName: { ...typography.caption, color: colors.text, fontWeight: '600', flex: 1, marginRight: spacing.md },
  taskStatus: { ...typography.caption, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, textTransform: 'capitalize' as any },
  taskStatusDone: { backgroundColor: '#16a34a22', color: '#16a34a' },
  taskStatusInProgress: { backgroundColor: '#0ea5e922', color: '#0ea5e9' },
  taskStatusBlocked: { backgroundColor: '#ef444422', color: '#ef4444' },
  taskStatusPending: { backgroundColor: '#a3a3a322', color: '#737373' },
  taskGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: 4 },
  taskGroupTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  // Legend and customization controls
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption, color: colors.textSecondary },
  customizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.xs, marginBottom: spacing.xs },
  customizePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 4 },
  customizeBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  customizeLabel: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: radii.pill },
  customizeText: { ...typography.caption, color: colors.textSecondary },
  dimmed: { opacity: 0.5 },
  // Progress bar
  progressBarOuter: { height: 10, backgroundColor: colors.background, borderRadius: radii.pill, overflow: 'hidden', marginTop: 10 },
  progressBarInner: { height: '100%', backgroundColor: colors.primary, borderRadius: radii.pill },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.lg, ...shadows.card },
  modalTitle: { ...typography.h3, marginBottom: spacing.sm },
  modalStatus: { ...typography.caption, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, textTransform: 'capitalize' as any },
  modalMeta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  // Toast (iOS/web)
  toastContainer: { position: 'absolute', left: 0, right: 0, bottom: spacing.xl, alignItems: 'center' },
  toastCard: { backgroundColor: '#111827EE', borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toastText: { color: '#fff' },

  // Status buttons
  statusBtn: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusBtnText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  statusBtnTextActive: { color: colors.primary },
  // Calendar styles
  calendarCard: { width: '100%', backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.lg, ...shadows.card },
  calendarHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthNavBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  monthNavText: { ...typography.body },
  monthTitle: { ...typography.body, fontWeight: '700' },
  weekdayRowCal: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  weekdayTextCal: { width: `${100 / 7}%`, textAlign: 'center', ...typography.caption, color: colors.textSecondary },
  daysGridCal: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  dayCellCal: { width: `${100 / 7}%`, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.sm },
  dayCellMutedCal: { opacity: 0.4 },
  dayCellSelectedCal: { backgroundColor: colors.primaryLight },
  dayTextCal: { color: colors.text },
  dayTextSelectedCal: { color: colors.primary, fontWeight: '700' },
  // Right controls next to filters
  rightControlsScroll: { marginTop: spacing.sm },
  rightControlsContent: { paddingRight: spacing.sm },
  rightControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  togglePill: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  togglePillActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  togglePillText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  togglePillTextActive: { color: colors.primary },
  // Quick chips (week/date helpers)
  quickChip: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: 10, ...shadows.subtle },
  quickChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  quickChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  quickChipTextActive: { color: colors.primary },
  // Preset chips (align to History/Leave screens)
  presetTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
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
});

// Local reusable filter (aligned with History screen)
type FilterOption = { value: any; label: string; count?: number };
type ScrollableFilterProps = {
  options: FilterOption[];
  activeValue: any;
  onChange: (value: any) => void;
  renderExtra?: (opt: FilterOption) => React.ReactNode;
  isDisabled?: (opt: FilterOption) => boolean;
};

const ScrollableFilter = ({ options, activeValue, onChange, renderExtra, isDisabled }: ScrollableFilterProps) => {
  return (
    <FlatList
      data={options}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => String(item.value)}
      renderItem={({ item }) => {
        const disabled = !!isDisabled?.(item);
        return (
          <TouchableOpacity
            style={[styles.filterButton, activeValue === item.value && styles.activeFilterButton, disabled && styles.disabledFilterButton]}
            onPress={() => !disabled && onChange(item.value)}
            activeOpacity={disabled ? 1 : 0.7}
            disabled={disabled}
          >
            {renderExtra ? (
              renderExtra(item)
            ) : (
              <Text style={[styles.filterButtonText, activeValue === item.value && styles.activeFilterButtonText]}>
                {item.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      }}
      contentContainerStyle={styles.filterList}
    />
  );
};
