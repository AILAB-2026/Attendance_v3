import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform, StyleSheet, Pressable, UIManager, LayoutAnimation, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '@/constants/colors';
import { spacing, radii, shadows, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { apiService } from '@/lib/api';
import DateRangePicker from '@/components/DateRangePicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatDateLocal } from '@/lib/date';
import AssignView from '@/components/manage/AssignView';
import ReportsView from '@/components/manage/ReportsView';
import EmployeesView from '@/components/manage/EmployeesView';
import ApprovalsView from '@/components/manage/ApprovalsView';
import CorrectionsView from '@/components/manage/CorrectionsView';
import LogsView from '@/components/manage/LogsView';
import ScheduleView from '@/components/manage/ScheduleView';
import AssignmentSyncView from '@/components/manage/AssignmentSyncView';
import FeedbackView from '@/components/manage/FeedbackView';

// Lightweight skeleton row for loading states
const SkeletonRow: React.FC = () => {
  return (
    <View style={[styles.row, { borderColor: 'transparent', backgroundColor: colors.card }]}>
      <View style={{ flex: 1 }}>
        <View style={[styles.skelBlock, { marginBottom: 6 }]} />
        <View style={[styles.skelBlock, { width: '60%' }]} />
      </View>
    </View>
  );
};

const ManageScreen = () => {
  const { user } = useAuth();
  const role = String((user as any)?.role || '').toLowerCase();
  const isManager = role === 'manager' || role === 'admin';

  const [activeView, setActiveView] = useState<'employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync' | 'feedback'>('employees');
  const [showHome, setShowHome] = useState(true);
  const [compact, setCompact] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'manager' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<any>>([]);
  const [total, setTotal] = useState(0);
  const [empRefreshing, setEmpRefreshing] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [empSortBy, setEmpSortBy] = useState<'name-asc' | 'name-desc' | 'role' | 'status'>('name-asc');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Approvals (Leaves)
  const [apprStatus, setApprStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [apprQuery, setApprQuery] = useState('');
  const [debouncedApprQuery, setDebouncedApprQuery] = useState('');
  const [apprPage, setApprPage] = useState(1);
  const [apprLoading, setApprLoading] = useState(false);
  const [apprItems, setApprItems] = useState<Array<any>>([]);
  const [apprTotal, setApprTotal] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [rejectCtx, setRejectCtx] = useState<{ id: string; reason: string } | null>(null);
  const today = new Date();
  const [apprRange, setApprRange] = useState({ startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: formatDateLocal(today) });
  const [apprDetail, setApprDetail] = useState<any | null>(null);
  const [apprRefreshing, setApprRefreshing] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);

  // Corrections (Attendance)
  const [corrStatus, setCorrStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [corrQuery, setCorrQuery] = useState('');
  const [debouncedCorrQuery, setDebouncedCorrQuery] = useState('');
  const [corrPage, setCorrPage] = useState(1);
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrItems, setCorrItems] = useState<Array<any>>([]);
  const [corrTotal, setCorrTotal] = useState(0);
  const [corrRange, setCorrRange] = useState({ startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: formatDateLocal(today) });
  const [corrRejectCtx, setCorrRejectCtx] = useState<{ id: string; note: string } | null>(null);
  const [corrRefreshing, setCorrRefreshing] = useState(false);

  // Logs
  const [logsAction, setLogsAction] = useState<string>('all');
  const [logsTarget, setLogsTarget] = useState<string>('all');
  const [logsQuery, setLogsQuery] = useState('');
  const [debouncedLogsQuery, setDebouncedLogsQuery] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsItems, setLogsItems] = useState<Array<any>>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsRange, setLogsRange] = useState({ startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: formatDateLocal(today) });
  const [logsRefreshing, setLogsRefreshing] = useState(false);

  // Schedule
  const [schedRange, setSchedRange] = useState({ startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: formatDateLocal(today) });
  const [schedQuery, setSchedQuery] = useState('');
  const [debouncedSchedQuery, setDebouncedSchedQuery] = useState('');
  const [schedPage, setSchedPage] = useState(1);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedItems, setSchedItems] = useState<Array<any>>([]);
  const [schedTotal, setSchedTotal] = useState(0);
  const [schedRefreshing, setSchedRefreshing] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState<{ employeeNos: string; startDate: string; endDate: string; startTime: string; endTime: string; shiftCode?: string; location?: string; notes?: string }>({ employeeNos: '', startDate: formatDateLocal(new Date()), endDate: formatDateLocal(new Date()), startTime: '09:00', endTime: '18:00', shiftCode: '', location: '', notes: '' });
  const [csvModal, setCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('empNo,date,start_time,end_time,shift_code,location,notes\nE001,2025-09-15,09:00,18:00,MOR,Site A,Note');

  // Assign Site/Project tool
  const [assignForm, setAssignForm] = useState<{ employeeNos: string; startDate: string; endDate: string; startTime: string; endTime: string; siteName?: string; projectName?: string; notes?: string }>({
    employeeNos: '',
    startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: formatDateLocal(today),
    startTime: '09:00',
    endTime: '18:00',
    siteName: '',
    projectName: '',
    notes: '',
  });
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignOptionsLoading, setAssignOptionsLoading] = useState(false);
  const [schedOptions, setSchedOptions] = useState<{ sites: Array<{ id: string; code?: string; name: string }>; projects: Array<{ id: string; code?: string; name: string }>; } | null>(null);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  // Team Reports
  const [reportsRange, setReportsRange] = useState({ startDate: formatDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: formatDateLocal(today) });
  const [reportsQuery, setReportsQuery] = useState('');
  const [debouncedReportsQuery, setDebouncedReportsQuery] = useState('');
  const [reportsThreshold, setReportsThreshold] = useState<number>(5);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsItems, setReportsItems] = useState<Array<any>>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsRefreshing, setReportsRefreshing] = useState(false);
  const [reportsGroupBy, setReportsGroupBy] = useState<'employee' | 'department'>('employee');
  const [reportsPageTotals, setReportsPageTotals] = useState<{ lates: number; absents: number }>({ lates: 0, absents: 0 });
  const [reportsSort, setReportsSort] = useState<'lates' | 'absents'>('lates');
  // Home quick-access enhancements
  const [homeQuery, setHomeQuery] = useState('');
  const [pinnedKeys, setPinnedKeys] = useState<Array<'employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync'>>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState<number>(0);
  const [onlyPinned, setOnlyPinned] = useState<boolean>(false);
  const [ctxMenuKey, setCtxMenuKey] = useState<null | ('employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync')>(null);
  const [infoTipFor, setInfoTipFor] = useState<null | 'approvals' | 'corrections'>(null);
  const [homeRefreshing, setHomeRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('manage_pins');
        if (raw) {
          const v = JSON.parse(raw);
          if (Array.isArray(v)) {
            // filter unknown values defensively
            const allowed = ['employees', 'approvals', 'corrections', 'logs', 'schedule', 'reports', 'assign', 'sync'];
            setPinnedKeys(v.filter((k: string) => allowed.includes(k)));
          }
        }
        const op = await AsyncStorage.getItem('manage_only_pinned');
        if (op === '1') setOnlyPinned(true);
        // Restore last opened tool
        const last = await AsyncStorage.getItem('manage_last_tool');
        const allowed = ['employees', 'approvals', 'corrections', 'logs', 'schedule', 'reports', 'assign', 'sync'];
        if (last && allowed.includes(last) && canView) {
          setActiveView(last as any);
          setShowHome(false);
        }
      } catch { }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('manage_pins', JSON.stringify(pinnedKeys)).catch(() => { });
  }, [pinnedKeys]);
  useEffect(() => {
    AsyncStorage.setItem('manage_only_pinned', onlyPinned ? '1' : '0').catch(() => { });
  }, [onlyPinned]);

  const canView = isManager;

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const res = await (apiService as any).adminListUsers(companyCode, employeeNo, {
        query: debouncedQuery, role: roleFilter === 'all' ? undefined : roleFilter, active: statusFilter === 'all' ? undefined : (statusFilter === 'active'), page, limit: 20,
      });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setItems(rows);
      setTotal(Number(res?.data?.total || rows.length));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [canView, user, debouncedQuery, roleFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const sortedEmployeeItems = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    if (empSortBy === 'name-asc') arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (empSortBy === 'name-desc') arr.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
    if (empSortBy === 'role') arr.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
    if (empSortBy === 'status') arr.sort((a, b) => Number(!!b.isActive) - Number(!!a.isActive));
    return arr;
  }, [items, empSortBy]);

  const loadApprovals = useCallback(async () => {
    if (!canView) return;
    try {
      setApprLoading(true);
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const res = await (apiService as any).adminListLeaves(companyCode, employeeNo, { status: apprStatus, query: debouncedApprQuery, page: apprPage, limit: 20, startDate: apprRange.startDate, endDate: apprRange.endDate });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setApprItems(rows);
      setApprTotal(Number(res?.data?.total || rows.length));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load approvals');
    } finally {
      setApprLoading(false);
    }
  }, [canView, user, apprStatus, debouncedApprQuery, apprPage, apprRange.startDate, apprRange.endDate]);

  useEffect(() => { if (activeView === 'approvals') loadApprovals(); }, [activeView, loadApprovals]);

  const loadCorrections = useCallback(async () => {
    if (!canView) return;
    try {
      setCorrLoading(true);
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const res = await (apiService as any).adminListAttendanceCorrections(companyCode, employeeNo, { status: corrStatus, query: debouncedCorrQuery, page: corrPage, limit: 20, startDate: corrRange.startDate, endDate: corrRange.endDate });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setCorrItems(rows);
      setCorrTotal(Number(res?.data?.total || rows.length));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load corrections');
    } finally {
      setCorrLoading(false);
    }
  }, [canView, user, corrStatus, debouncedCorrQuery, corrPage, corrRange.startDate, corrRange.endDate]);

  useEffect(() => { if (activeView === 'corrections') loadCorrections(); }, [activeView, loadCorrections]);

  const loadLogs = useCallback(async () => {
    if (!canView) return;
    try {
      setLogsLoading(true);
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const action = logsAction === 'all' ? undefined : logsAction;
      const targetType = logsTarget === 'all' ? undefined : logsTarget;
      const res = await (apiService as any).adminListAuditLogs(companyCode, employeeNo, { action, targetType, query: debouncedLogsQuery, page: logsPage, limit: 20, startDate: logsRange.startDate, endDate: logsRange.endDate });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setLogsItems(rows);
      setLogsTotal(Number(res?.data?.total || rows.length));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load audit logs');
    } finally {
      setLogsLoading(false);
    }
  }, [canView, user, logsAction, logsTarget, debouncedLogsQuery, logsPage, logsRange.startDate, logsRange.endDate]);

  // Debounce effects for searches
  useEffect(() => { const t = setTimeout(() => setDebouncedQuery(query), 300); return () => clearTimeout(t); }, [query]);
  useEffect(() => { const t = setTimeout(() => setDebouncedApprQuery(apprQuery), 300); return () => clearTimeout(t); }, [apprQuery]);
  useEffect(() => { const t = setTimeout(() => setDebouncedCorrQuery(corrQuery), 300); return () => clearTimeout(t); }, [corrQuery]);
  useEffect(() => { const t = setTimeout(() => setDebouncedLogsQuery(logsQuery), 300); return () => clearTimeout(t); }, [logsQuery]);
  useEffect(() => { const t = setTimeout(() => setDebouncedSchedQuery(schedQuery), 300); return () => clearTimeout(t); }, [schedQuery]);
  useEffect(() => { const t = setTimeout(() => setDebouncedReportsQuery(reportsQuery), 300); return () => clearTimeout(t); }, [reportsQuery]);

  useEffect(() => { if (activeView === 'logs') loadLogs(); }, [activeView, loadLogs]);
  // Dedicated pending counters for home tiles
  const loadPendingCounts = useCallback(async () => {
    if (!canView) return;
    try {
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const today2 = new Date();
      const start2 = formatDateLocal(new Date(today2.getFullYear(), today2.getMonth(), 1));
      const end2 = formatDateLocal(today2);
      const [lr, cr] = await Promise.all([
        (apiService as any).adminListLeaves(companyCode, employeeNo, { status: 'pending', page: 1, limit: 1, startDate: start2, endDate: end2 }),
        (apiService as any).adminListAttendanceCorrections(companyCode, employeeNo, { status: 'pending', page: 1, limit: 1, startDate: start2, endDate: end2 }),
      ]);
      setPendingApprovalsCount(Number(lr?.data?.total || 0));
      setPendingCorrectionsCount(Number(cr?.data?.total || 0));
    } catch { }
  }, [canView, user]);
  // Preload counts on home so tiles can show numbers
  useEffect(() => {
    if (!showHome) return;
    // fire and forget to populate totals
    load();
    loadApprovals();
    loadCorrections();
    loadLogs();
    loadSchedules();
    loadReports();
    loadPendingCounts();
  }, [showHome]);

  const loadSchedules = useCallback(async () => {
    if (!canView) return;
    try {
      setSchedLoading(true);
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const res = await (apiService as any).adminListSchedules(companyCode, employeeNo, { startDate: schedRange.startDate, endDate: schedRange.endDate, query: debouncedSchedQuery, page: schedPage, limit: 50 });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setSchedItems(rows);
      setSchedTotal(Number(res?.data?.total || rows.length));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load schedules');
    } finally {
      setSchedLoading(false);
    }
  }, [canView, user, schedRange.startDate, schedRange.endDate, debouncedSchedQuery, schedPage]);

  useEffect(() => { if (activeView === 'schedule') loadSchedules(); }, [activeView, loadSchedules]);

  const loadReports = useCallback(async () => {
    if (!canView) return;
    try {
      setReportsLoading(true);
      const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
      const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
      const res = await (apiService as any).adminReportsSummary(companyCode, employeeNo, {
        startDate: reportsRange.startDate,
        endDate: reportsRange.endDate,
        groupBy: reportsGroupBy,
        thresholdMinutes: reportsThreshold,
        query: debouncedReportsQuery,
        page: reportsPage,
        limit: 20,
      });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setReportsItems(rows);
      setReportsTotal(Number(res?.data?.total || rows.length));
      const pt = res?.data?.pageTotals || { lates: 0, absents: 0 };
      setReportsPageTotals({ lates: Number(pt.lates || 0), absents: Number(pt.absents || 0) });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  }, [canView, user, reportsRange.startDate, reportsRange.endDate, debouncedReportsQuery, reportsPage, reportsThreshold, reportsGroupBy]);

  useEffect(() => { if (activeView === 'reports') loadReports(); }, [activeView, loadReports]);

  // Load schedule options when opening Assign tool
  useEffect(() => {
    (async () => {
      if (!canView || activeView !== 'assign') return;
      try {
        setAssignOptionsLoading(true);
        const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
        const res = await (apiService as any).getScheduleOptions(companyCode);
        const data = res?.data?.data || res?.data || {};
        if (data && (Array.isArray(data.sites) || Array.isArray(data.projects))) {
          setSchedOptions({ sites: data.sites || [], projects: data.projects || [] });
        } else {
          setSchedOptions({ sites: [], projects: [] });
        }
      } catch {
        setSchedOptions({ sites: [], projects: [] });
      } finally {
        setAssignOptionsLoading(false);
      }
    })();
  }, [activeView, canView, user]);

  const sortedReportsItems = useMemo(() => {
    const arr = Array.isArray(reportsItems) ? [...reportsItems] : [];
    arr.sort((a, b) => Number(b[reportsSort] || 0) - Number(a[reportsSort] || 0));
    return arr;
  }, [reportsItems, reportsSort]);

  // Refresh dashboard tile counts whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (showHome) {
        // fire and forget
        load();
        loadApprovals();
        loadCorrections();
        loadLogs();
        loadSchedules();
        loadReports();
        loadPendingCounts();
      }
      return () => { };
    }, [showHome, load, loadApprovals, loadCorrections, loadLogs, loadSchedules, loadReports, loadPendingCounts])
  );

  const onHomeRefresh = useCallback(async () => {
    if (!canView) return;
    try {
      setHomeRefreshing(true);
      await Promise.all([
        load(),
        loadApprovals(),
        loadCorrections(),
        loadLogs(),
        loadSchedules(),
        loadReports(),
        loadPendingCounts(),
      ]);
    } finally {
      setHomeRefreshing(false);
    }
  }, [canView, load, loadApprovals, loadCorrections, loadLogs, loadSchedules, loadReports, loadPendingCounts]);

  // Persist and restore filters per tab
  useEffect(() => {
    (async () => {
      try {
        const emp = await AsyncStorage.getItem('manage_filters_employees');
        if (emp) {
          const v = JSON.parse(emp);
          if (typeof v.query === 'string') setQuery(v.query);
          if (['all', 'employee', 'manager', 'admin'].includes(v.roleFilter)) setRoleFilter(v.roleFilter);
          if (['all', 'active', 'inactive'].includes(v.statusFilter)) setStatusFilter(v.statusFilter);
        }
        const apr = await AsyncStorage.getItem('manage_filters_approvals');
        if (apr) {
          const v = JSON.parse(apr);
          if (typeof v.query === 'string') setApprQuery(v.query);
          if (['pending', 'approved', 'rejected'].includes(v.status)) setApprStatus(v.status);
          if (v.range?.startDate && v.range?.endDate) setApprRange(v.range);
        }
        const cor = await AsyncStorage.getItem('manage_filters_corrections');
        if (cor) {
          const v = JSON.parse(cor);
          if (typeof v.query === 'string') setCorrQuery(v.query);
          if (['pending', 'approved', 'rejected'].includes(v.status)) setCorrStatus(v.status);
          if (v.range?.startDate && v.range?.endDate) setCorrRange(v.range);
        }
        const lg = await AsyncStorage.getItem('manage_filters_logs');
        if (lg) {
          const v = JSON.parse(lg);
          if (typeof v.query === 'string') setLogsQuery(v.query);
          if (typeof v.action === 'string') setLogsAction(v.action);
          if (typeof v.target === 'string') setLogsTarget(v.target);
          if (v.range?.startDate && v.range?.endDate) setLogsRange(v.range);
        }
      } catch { }
    })();
  }, []);
  useEffect(() => { AsyncStorage.setItem('manage_filters_employees', JSON.stringify({ query, roleFilter, statusFilter })); }, [query, roleFilter, statusFilter]);
  useEffect(() => { AsyncStorage.setItem('manage_filters_approvals', JSON.stringify({ query: apprQuery, status: apprStatus, range: apprRange })); }, [apprQuery, apprStatus, apprRange.startDate, apprRange.endDate]);
  useEffect(() => { AsyncStorage.setItem('manage_filters_corrections', JSON.stringify({ query: corrQuery, status: corrStatus, range: corrRange })); }, [corrQuery, corrStatus, corrRange.startDate, corrRange.endDate]);
  useEffect(() => { AsyncStorage.setItem('manage_filters_logs', JSON.stringify({ query: logsQuery, action: logsAction, target: logsTarget, range: logsRange })); }, [logsQuery, logsAction, logsTarget, logsRange.startDate, logsRange.endDate]);

  const initials = (name?: string) => {
    const n = (name || '').trim();
    if (!n) return 'U';
    const p = n.split(/\s+/);
    return ((p[0]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase();
  };

  // Helper for header icons per tool
  const iconNameFor = (key: 'employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync') => (
    key === 'employees' ? 'people-outline' :
      key === 'approvals' ? 'checkmark-done-outline' :
        key === 'corrections' ? 'create-outline' :
          key === 'sync' ? 'sync-outline' :
            key === 'logs' ? 'document-text-outline' :
              key === 'schedule' ? 'calendar-outline' :
                key === 'reports' ? 'bar-chart-outline' :
                  key === 'feedback' ? 'chatbubbles-outline' :
                    'pricetag-outline'
  );

  if (!canView) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Manager access required</Text>
      </View>
    );
  }

  const manageTabs: Array<{ key: 'employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync'; label: string }> = [
    { key: 'employees', label: 'Employees' },
    { key: 'approvals', label: 'Approvals' },
    { key: 'corrections', label: 'Corrections' },
    { key: 'logs', label: 'Logs' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'reports', label: 'Reports' },
    { key: 'feedback', label: 'Feedback' },
    { key: 'assign', label: 'Assign' },
    { key: 'sync', label: 'Assignment Sync' },
  ];

  // Persist last opened tool
  useEffect(() => {
    AsyncStorage.setItem('manage_last_tool', activeView).catch(() => { });
  }, [activeView]);

  const togglePin = useCallback((key: 'employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync') => {
    setPinnedKeys((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const filteredTabs = useMemo(() => {
    let arr = [...manageTabs];
    if (homeQuery) {
      const q = homeQuery.toLowerCase();
      arr = arr.filter(t => t.label.toLowerCase().includes(q));
    }
    return arr;
  }, [manageTabs, homeQuery]);
  const pinnedDisplayed = useMemo(() => filteredTabs.filter(t => pinnedKeys.includes(t.key)), [filteredTabs, pinnedKeys]);
  const restDisplayed = useMemo(() => filteredTabs.filter(t => !pinnedKeys.includes(t.key)), [filteredTabs, pinnedKeys]);

  // loadPendingCounts duplicate removed; the function is defined earlier

  const tabCount = (key: 'employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync') => {
    if (key === 'employees') return total;
    if (key === 'approvals') return showHome ? pendingApprovalsCount : apprTotal;
    if (key === 'corrections') return showHome ? pendingCorrectionsCount : corrTotal;
    if (key === 'sync') return 0;
    if (key === 'logs') return logsTotal;
    if (key === 'schedule') return schedTotal;
    if (key === 'reports') return reportsTotal;
    if (key === 'feedback') return 0; // Or fetch count if needed
    if (key === 'assign') return 0;
    return 0;
  };

  // Main component render
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container} key="main-container">
        {!showHome && (
          <View style={styles.headerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {!showHome && (
                  <Ionicons name={iconNameFor(activeView)} size={18} color={colors.primary} style={{ marginRight: 6 }} />
                )}
                <Text style={styles.title}>{showHome ? 'Manage' : manageTabs.find(t => t.key === activeView)?.label}</Text>
              </View>
              {!showHome && (
                <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowHome(true); }} style={styles.backBtn}>
                  <Ionicons name="arrow-back-outline" size={16} color={colors.text} />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Site Picker Modal */}
        <Modal visible={sitePickerOpen} transparent animationType="fade" onRequestClose={() => setSitePickerOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Site</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search sites..."
                placeholderTextColor={colors.textSecondary}
                value={siteSearch}
                onChangeText={setSiteSearch}
              />
              <View style={{ maxHeight: 320, marginTop: spacing.sm }}>
                <FlatList
                  data={(schedOptions?.sites || []).filter(s => !siteSearch || s.name.toLowerCase().includes(siteSearch.toLowerCase()))}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.row, styles.rowCompact]} onPress={() => { setAssignForm(f => ({ ...f, siteName: item.name })); setSitePickerOpen(false); }}>
                      <Ionicons name="location-outline" size={16} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                      <Text style={styles.name}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.muted}>No sites</Text>}
                />
              </View>
              <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSitePickerOpen(false)}>
                  <Text style={styles.secondaryBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Tile Context Menu */}
        <Modal visible={!!ctxMenuKey} transparent animationType="fade" onRequestClose={() => setCtxMenuKey(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{(manageTabs.find(x => x.key === ctxMenuKey)?.label) || 'Tool'}</Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => { if (ctxMenuKey) { setCtxMenuKey(null); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveView(ctxMenuKey as 'employees' | 'approvals' | 'corrections' | 'logs' | 'schedule' | 'reports' | 'assign' | 'sync'); setShowHome(false); } }}>
                  <Text style={styles.primaryBtnText}>Open</Text>
                </TouchableOpacity>
                {/* Removed Pin/Unpin action from context menu */}
              </View>
              <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCtxMenuKey(null)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Info tooltip for tile badges */}
        <Modal visible={!!infoTipFor} transparent animationType="fade" onRequestClose={() => setInfoTipFor(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>What does the badge mean?</Text>
              <Text style={styles.value}>
                {infoTipFor === 'approvals' ? 'Approvals badge shows Pending/Total leave requests for the current month. Pending = awaiting your decision.' :
                  infoTipFor === 'corrections' ? 'Corrections badge shows Pending/Total attendance corrections for the current month.' :
                    'Badge shows count.'}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setInfoTipFor(null)}>
                  <Text style={styles.secondaryBtnText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Project Picker Modal */}
        <Modal visible={projectPickerOpen} transparent animationType="fade" onRequestClose={() => setProjectPickerOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Project</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search projects..."
                placeholderTextColor={colors.textSecondary}
                value={projectSearch}
                onChangeText={setProjectSearch}
              />
              <View style={{ maxHeight: 320, marginTop: spacing.sm }}>
                <FlatList
                  data={(schedOptions?.projects || []).filter(p => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.row, styles.rowCompact]} onPress={() => { setAssignForm(f => ({ ...f, projectName: item.name })); setProjectPickerOpen(false); }}>
                      <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                      <Text style={styles.name}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.muted}>No projects</Text>}
                />
              </View>
              <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setProjectPickerOpen(false)}>
                  <Text style={styles.secondaryBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Content area (Home) */}
        {showHome && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            refreshControl={
              <RefreshControl refreshing={homeRefreshing} onRefresh={onHomeRefresh} tintColor={colors.primary} />
            }
          >
            <>
              <Text style={styles.subTitle}>Quickly access manager tools</Text>
              <TextInput
                style={[styles.searchInput, { marginTop: spacing.xs }]}
                placeholder="Search tools (e.g., Approvals, Reports)"
                placeholderTextColor={colors.textSecondary}
                value={homeQuery}
                onChangeText={setHomeQuery}
              />
              {/* Removed Only pinned toggle */}
              <View style={styles.filterChips}>
                {!!apprTotal && apprTotal > 0 && (
                  <TouchableOpacity style={styles.presetTab} onPress={() => { setActiveView('approvals'); setApprStatus('pending'); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowHome(false); }}>
                    <Text style={styles.presetTabText}>Pending Approvals: {apprTotal}</Text>
                  </TouchableOpacity>
                )}
                {!!corrTotal && corrTotal > 0 && (
                  <TouchableOpacity style={styles.presetTab} onPress={() => { setActiveView('corrections'); setCorrStatus('pending'); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowHome(false); }}>
                    <Text style={styles.presetTabText}>Pending Corrections: {corrTotal}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
            {/* Removed Pinned section */}
            {(filteredTabs.length > 0) && (
              <>
                <View style={styles.sectionDivider} />
                <Text style={[styles.sectionTitle, { marginTop: spacing.md, marginBottom: spacing.xs }]}>All tools</Text>
                <View style={styles.tileGrid}>
                  {filteredTabs.map(t => {
                    const name = iconNameFor(t.key);
                    const badgeText = (
                      t.key === 'approvals' ? `${pendingApprovalsCount}/${apprTotal}` :
                        t.key === 'corrections' ? `${pendingCorrectionsCount}/${corrTotal}` :
                          String(tabCount(t.key))
                    );
                    return (
                      <View key={`r-${t.key}`} style={[styles.tileItem, compact && styles.tileItemCompact]}>
                        <Pressable
                          style={({ pressed }) => [styles.tileCircle, compact && styles.tileCircleCompact, pressed && styles.tilePressed]}
                          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveView(t.key); setShowHome(false); }}
                          onLongPress={async () => { try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { } setCtxMenuKey(t.key); }}
                          delayLongPress={300}
                        >
                          <View style={styles.tileHeaderRow}>
                            <TouchableOpacity onPress={() => setCtxMenuKey(t.key)} style={styles.tileHeaderIconBtn}>
                              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.tileBadgeCorner}>
                            <Text style={styles.tileBadgeText}>{badgeText}</Text>
                          </View>
                          <Ionicons name={name as any} size={24} color={colors.text} style={{ marginBottom: 2 }} />
                        </Pressable>
                        <Text style={styles.tileLabel} numberOfLines={1} ellipsizeMode="tail">{t.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
            {/* Empty state when no tools match search */}
            {(filteredTabs.length === 0) && (
              <View style={[styles.sectionCard, { marginTop: spacing.lg, alignItems: 'center' }]}>
                <Text style={styles.emptyTitle}>No tools found</Text>
                <Text style={styles.emptySub}>Try a different search or clear filters</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Active tool workspace */}
        {!showHome && (
          <View style={{ flex: 1 }}>
            {activeView === 'assign' && (
              <AssignView
                assignForm={assignForm}
                setAssignForm={setAssignForm}
                assignBusy={assignBusy}
                setAssignBusy={setAssignBusy}
                schedOptions={schedOptions}
                setSitePickerOpen={setSitePickerOpen}
                setProjectPickerOpen={setProjectPickerOpen}
                setSiteSearch={setSiteSearch}
                setProjectSearch={setProjectSearch}
                user={user}
                today={today}
                styles={styles}
              />
            )}

            {activeView === 'reports' && (
              <ReportsView
                reportsLoading={reportsLoading}
                reportsRefreshing={reportsRefreshing}
                setReportsRefreshing={setReportsRefreshing}
                loadReports={loadReports}
                sortedReportsItems={sortedReportsItems}
                reportsRange={reportsRange}
                setReportsRange={setReportsRange}
                setReportsPage={setReportsPage}
                reportsQuery={reportsQuery}
                setReportsQuery={setReportsQuery}
                reportsGroupBy={reportsGroupBy}
                setReportsGroupBy={setReportsGroupBy}
                reportsSort={reportsSort}
                setReportsSort={setReportsSort}
                reportsThreshold={reportsThreshold}
                setReportsThreshold={setReportsThreshold}
                reportsTotal={reportsTotal}
                reportsPageTotals={reportsPageTotals}
                debouncedReportsQuery={debouncedReportsQuery}
                reportsPage={reportsPage}
                reportsItems={reportsItems}
                compact={compact}
                today={today}
                user={user}
                styles={styles}
                SkeletonRow={SkeletonRow}
                setCompact={setCompact}
              />
            )}

            {activeView === 'employees' && (
              <EmployeesView
                loading={loading}
                empRefreshing={empRefreshing}
                setEmpRefreshing={setEmpRefreshing}
                load={load}
                items={sortedEmployeeItems}
                query={query}
                setQuery={setQuery}
                setPage={setPage}
                roleFilter={roleFilter}
                setRoleFilter={setRoleFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                total={total}
                compact={compact}
                setEditUser={setEditUser}
                page={page}
                styles={styles}
                onQuickToggleActive={async (userId: string, nextActive: boolean) => {
                  try {
                    setSaving(true);
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    await (apiService as any).adminUpdateUser(companyCode, employeeNo, userId, { isActive: nextActive });
                    await load();
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to update status');
                  } finally {
                    setSaving(false);
                  }
                }}
                sortBy={empSortBy}
                setSortBy={setEmpSortBy}
                setCompact={setCompact}
                onUpdateUser={async (userId: string, data: { name?: string; email?: string; role?: 'employee' | 'manager' | 'admin'; isActive?: boolean }) => {
                  try {
                    setSaving(true);
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    await (apiService as any).adminUpdateUser(companyCode, employeeNo, userId, data);
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to update user');
                    throw e;
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            )}

            {activeView === 'approvals' && (
              <ApprovalsView
                apprLoading={apprLoading}
                apprRefreshing={apprRefreshing}
                setApprRefreshing={setApprRefreshing}
                loadApprovals={loadApprovals}
                apprItems={apprItems}
                apprRange={apprRange}
                setApprRange={setApprRange}
                setApprPage={setApprPage}
                apprQuery={apprQuery}
                setApprQuery={setApprQuery}
                apprStatus={apprStatus}
                setApprStatus={setApprStatus}
                apprTotal={apprTotal}
                compact={compact}
                setApprDetail={setApprDetail}
                apprPage={apprPage}
                handleApproval={async (id: string, status: string) => {
                  try {
                    setSaving(true);
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    await apiService.updateLeaveStatus(id, status as "approved" | "rejected", undefined, companyCode, employeeNo);
                    await loadApprovals();
                  } catch (e: any) {
                  } finally {
                    setSaving(false);
                  }
                }}
                setRejectCtx={setRejectCtx}
                today={today}
                styles={styles}
                SkeletonRow={SkeletonRow}
                setCompact={setCompact}
              />
            )}

            {activeView === 'corrections' && (
              <CorrectionsView
                corrLoading={corrLoading}
                corrRefreshing={corrRefreshing}
                setCorrRefreshing={setCorrRefreshing}
                loadCorrections={loadCorrections}
                corrItems={corrItems}
                corrRange={corrRange}
                setCorrRange={setCorrRange}
                setCorrPage={setCorrPage}
                corrQuery={corrQuery}
                setCorrQuery={setCorrQuery}
                corrStatus={corrStatus}
                setCorrStatus={setCorrStatus}
                corrTotal={corrTotal}
                compact={compact}
                corrPage={corrPage}
                handleCorrectionApproval={async (id: string, status: string) => {
                  try {
                    setSaving(true);
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    await apiService.adminDecideAttendanceCorrection(companyCode, employeeNo, id, status as "approved" | "rejected");
                    await loadCorrections();
                  } catch (e: any) {
                  } finally {
                    setSaving(false);
                  }
                }}
                setRejectCtx={setRejectCtx}
                today={today}
                styles={styles}
                SkeletonRow={SkeletonRow}
                setCompact={setCompact}
              />
            )}

            {activeView === 'schedule' && (
              <ScheduleView
                schedLoading={schedLoading}
                schedRefreshing={schedRefreshing}
                setSchedRefreshing={setSchedRefreshing}
                loadSchedules={loadSchedules}
                schedItems={schedItems}
                schedRange={schedRange}
                setSchedRange={setSchedRange}
                setSchedPage={setSchedPage}
                schedQuery={schedQuery}
                setSchedQuery={setSchedQuery}
                schedTotal={schedTotal}
                compact={compact}
                schedPage={schedPage}
                setBulkModal={setBulkModal}
                setCsvModal={setCsvModal}
                today={today}
                styles={styles}
                SkeletonRow={SkeletonRow}
                setCompact={setCompact}
              />
            )}

            {activeView === 'logs' && (
              <LogsView
                logsLoading={logsLoading}
                logsRefreshing={logsRefreshing}
                setLogsRefreshing={setLogsRefreshing}
                loadLogs={loadLogs}
                logsItems={logsItems}
                logsRange={logsRange}
                setLogsRange={setLogsRange}
                setLogsPage={setLogsPage}
                logsQuery={logsQuery}
                setLogsQuery={setLogsQuery}
                logsAction={logsAction}
                setLogsAction={setLogsAction}
                logsTarget={logsTarget}
                setLogsTarget={setLogsTarget}
                logsTotal={logsTotal}
                compact={compact}
                logsPage={logsPage}
                today={today}
                styles={styles}
                SkeletonRow={SkeletonRow}
                setCompact={setCompact}
              />
            )}

            {activeView === 'sync' && (
              <AssignmentSyncView
                companyCode={(user as any)?.companyCode || (user as any)?.cmpcode || ''}
                employeeNo={user?.empNo || ''}
              />
            )}

            {activeView === 'feedback' && (
              <FeedbackView
                companyCode={(user as any)?.companyCode || (user as any)?.cmpcode || ''}
              />
            )}
          </View>
        )}

        <Modal visible={!!editUser} transparent animationType="slide" onRequestClose={() => setEditUser(null)}>
          <View style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}>
            <View style={[styles.modalCard, { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
              <Text style={styles.modalTitle}>Edit User</Text>
              {!!editUser && (
                <>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{editUser.name}</Text>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.value}>{editUser.email}</Text>
                  <Text style={styles.label}>Role</Text>
                  <TouchableOpacity style={styles.dropdownField} onPress={() => setRolePickerOpen(true)}>
                    <Text style={styles.dropdownValue}>{String(editUser.role || 'employee')[0].toUpperCase() + String(editUser.role || 'employee').slice(1)}</Text>
                  </TouchableOpacity>
                  <Text style={styles.label}>Status</Text>
                  <TouchableOpacity style={styles.dropdownField} onPress={() => setStatusPickerOpen(true)}>
                    <Text style={styles.dropdownValue}>{editUser.isActive ? 'Active' : 'Inactive'}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                    <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={async () => {
                      try {
                        setSaving(true);
                        const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                        const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                        await (apiService as any).adminUpdateUser(companyCode, employeeNo, editUser.id, { role: editUser.role, isActive: !!editUser.isActive });
                        setEditUser(null);
                        await load();
                      } catch (e: any) {
                        Alert.alert('Error', e?.message || 'Failed to update user');
                      } finally {
                        setSaving(false);
                      }
                    }}>
                      <Text style={styles.primaryBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setEditUser(null)}>
                      <Text style={styles.secondaryBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* FAB removed as per request; rely on pull-to-refresh and header actions only */}

        {/* Schedule: Bulk assign modal */}
        <Modal visible={bulkModal} transparent animationType="slide" onRequestClose={() => setBulkModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Bulk Assign Schedules</Text>
              <Text style={styles.label}>Employee Nos (comma separated)</Text>
              <TextInput style={styles.searchInput} value={bulkForm.employeeNos} onChangeText={(t) => setBulkForm({ ...bulkForm, employeeNos: t })} placeholder="E001,E002,E003" placeholderTextColor={colors.textSecondary} />
              <Text style={styles.label}>Date Range</Text>
              <View style={{ flexDirection: 'row' }}>
                <TextInput style={[styles.searchInput, { flex: 1 }]} value={bulkForm.startDate} onChangeText={(t) => setBulkForm({ ...bulkForm, startDate: t })} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.searchInput, { flex: 1, marginLeft: spacing.sm }]} value={bulkForm.endDate} onChangeText={(t) => setBulkForm({ ...bulkForm, endDate: t })} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
              </View>
              <Text style={styles.label}>Time</Text>
              <View style={{ flexDirection: 'row' }}>
                <TextInput style={[styles.searchInput, { flex: 1 }]} value={bulkForm.startTime} onChangeText={(t) => setBulkForm({ ...bulkForm, startTime: t })} placeholder="HH:MM" placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.searchInput, { flex: 1, marginLeft: spacing.sm }]} value={bulkForm.endTime} onChangeText={(t) => setBulkForm({ ...bulkForm, endTime: t })} placeholder="HH:MM" placeholderTextColor={colors.textSecondary} />
              </View>
              <Text style={styles.label}>Shift/Location</Text>
              <View style={{ flexDirection: 'row' }}>
                <TextInput style={[styles.searchInput, { flex: 1 }]} value={bulkForm.shiftCode} onChangeText={(t) => setBulkForm({ ...bulkForm, shiftCode: t })} placeholder="Shift code" placeholderTextColor={colors.textSecondary} />
                <TextInput style={[styles.searchInput, { flex: 1, marginLeft: spacing.sm }]} value={bulkForm.location} onChangeText={(t) => setBulkForm({ ...bulkForm, location: t })} placeholder="Location" placeholderTextColor={colors.textSecondary} />
              </View>
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.searchInput, { minHeight: 80, textAlignVertical: 'top' }]} multiline value={bulkForm.notes} onChangeText={(t) => setBulkForm({ ...bulkForm, notes: t })} placeholder="Optional notes" placeholderTextColor={colors.textSecondary} />
              <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={async () => {
                  try {
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    const employeeNos = bulkForm.employeeNos.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
                    await (apiService as any).adminBulkAssignSchedules(companyCode, employeeNo, { employeeNos, startDate: bulkForm.startDate, endDate: bulkForm.endDate, startTime: bulkForm.startTime, endTime: bulkForm.endTime, shiftCode: (bulkForm.shiftCode || '') || undefined, location: (bulkForm.location || '') || undefined, notes: (bulkForm.notes || '') || undefined });
                    setBulkModal(false);
                    await loadSchedules();
                  } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to assign'); }
                }}>
                  <Text style={styles.primaryBtnText}>Assign</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setBulkModal(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Schedule: CSV import modal */}
        <Modal visible={csvModal} transparent animationType="slide" onRequestClose={() => setCsvModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Import Schedules from CSV</Text>
              <Text style={styles.label}>CSV (headers: empNo,date,start_time,end_time,shift_code,location,notes)</Text>
              <TextInput style={[styles.searchInput, { minHeight: 160, textAlignVertical: 'top' }]} multiline value={csvText} onChangeText={setCsvText} placeholder="Paste CSV content here" placeholderTextColor={colors.textSecondary} />
              <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={async () => {
                  try {
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    await (apiService as any).adminImportSchedulesCsv(companyCode, employeeNo, csvText);
                    setCsvModal(false);
                    await loadSchedules();
                  } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to import CSV'); }
                }}>
                  <Text style={styles.primaryBtnText}>Import</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCsvModal(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Corrections reject modal - Moved outside header card to fix overlap */}
        <Modal visible={!!corrRejectCtx} transparent animationType="fade" onRequestClose={() => setCorrRejectCtx(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Reject Correction</Text>
              <Text style={styles.label}>Note</Text>
              <TextInput
                style={[styles.searchInput, { minHeight: 80, textAlignVertical: 'top' }]}
                multiline
                value={corrRejectCtx?.note || ''}
                onChangeText={(t) => setCorrRejectCtx(r => r ? { ...r, note: t } : r)}
                placeholder="Enter reason/note"
                placeholderTextColor={colors.textSecondary}
              />
              <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={async () => {
                  if (!corrRejectCtx?.id) { setCorrRejectCtx(null); return; }
                  try {
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    await apiService.adminDecideAttendanceCorrection(companyCode, employeeNo, corrRejectCtx.id, 'rejected', (corrRejectCtx.note || '').trim() || undefined);
                    setCorrRejectCtx(null);
                    await loadCorrections();
                  } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to reject'); }
                }}>
                  <Text style={styles.primaryBtnText}>Submit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCorrRejectCtx(null)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!rejectCtx} transparent animationType="fade" onRequestClose={() => setRejectCtx(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Reject Leave</Text>
              <Text style={styles.label}>Reason</Text>
              <TextInput
                style={[styles.searchInput, { minHeight: 80, textAlignVertical: 'top' }]}
                multiline
                value={rejectCtx?.reason || ''}
                onChangeText={(t) => setRejectCtx(r => r ? { ...r, reason: t } : r)}
                placeholder="Enter rejection reason"
                placeholderTextColor={colors.textSecondary}
                editable={!rejecting}
              />
              <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                <TouchableOpacity style={[styles.primaryBtn, rejecting && { opacity: 0.6 }]} disabled={rejecting} onPress={async () => {
                  if (!rejectCtx?.id) { setRejectCtx(null); return; }
                  try {
                    setRejecting(true);
                    const companyCode = (user as any)?.companyCode || (user as any)?.cmpcode;
                    const employeeNo = (user as any)?.empNo || (user as any)?.employeeNo;
                    await apiService.updateLeaveStatus(rejectCtx.id, 'rejected', (rejectCtx.reason || '').trim() || undefined, companyCode, employeeNo);
                    setRejectCtx(null);
                    await loadApprovals();
                  } catch (e: any) {
                    Alert.alert('Error', e?.message || 'Failed to reject');
                  } finally {
                    setRejecting(false);
                  }
                }}>
                  <Text style={styles.primaryBtnText}>Submit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRejectCtx(null)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Approvals details modal */}
        <Modal visible={!!apprDetail} transparent animationType="slide" onRequestClose={() => setApprDetail(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Leave Details</Text>
              {!!apprDetail && (
                <>
                  <Text style={styles.label}>Employee</Text>
                  <Text style={styles.value}>{apprDetail.name} ({apprDetail.empNo})</Text>
                  <Text style={styles.label}>Dates</Text>
                  <Text style={styles.value}>{String(apprDetail.startDate).slice(0, 10)} → {String(apprDetail.endDate).slice(0, 10)}</Text>
                  <Text style={styles.label}>Type</Text>
                  <Text style={styles.value}>{String(apprDetail.type).toUpperCase()}</Text>
                  <Text style={styles.label}>Reason</Text>
                  <Text style={styles.value}>{apprDetail.reason || '-'}</Text>
                  {typeof apprDetail.effectiveDays === 'number' && (
                    <>
                      <Text style={styles.label}>Effective Days</Text>
                      <Text style={styles.value}>{apprDetail.effectiveDays}</Text>
                    </>
                  )}
                  {apprDetail.attachmentUri && (
                    <>
                      <Text style={styles.label}>Attachment</Text>
                      {/^https?:\/\/.*\.(png|jpe?g|webp|gif)$/i.test(String(apprDetail.attachmentUri)) && (
                        <TouchableOpacity onPress={() => setZoomUri(String(apprDetail.attachmentUri))}>
                          <Image source={{ uri: apprDetail.attachmentUri }} style={{ width: '100%', height: 220, borderRadius: radii.md, marginBottom: spacing.sm }} contentFit="cover" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => Linking.openURL(apprDetail.attachmentUri)} style={[styles.secondaryBtn, { alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}>
                        <Text style={styles.secondaryBtnText}>Open Attachment</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setApprDetail(null)}>
                      <Text style={styles.secondaryBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default ManageScreen;

// Define the styles with proper TypeScript types
const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: 0 },
  headerCard: { backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.sm, marginBottom: 0, ...shadows.subtle },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subTitle: { ...typography.caption, color: colors.textSecondary, marginBottom: 0 },
  muted: { ...typography.caption, color: colors.textSecondary },
  filtersRow: { marginBottom: 0 },
  searchInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, backgroundColor: colors.card },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 0 },
  presetTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: 0, justifyContent: 'center' },
  presetTabActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  presetTabText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  presetTabTextActive: { color: colors.primary, fontWeight: '800' },
  tabBadge: { marginLeft: 4, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: colors.primary + '10', borderColor: colors.primary },
  tabBadgeText: { ...typography.caption, color: colors.textSecondary },
  tabBadgeTextActive: { color: colors.primary, fontWeight: '700' },
  segmentedTabs: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radii.pill, padding: 2, borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs },
  segmentedTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: 'transparent', marginRight: 2 },
  segmentedTabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  segmentedTabText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  segmentedTabTextActive: { color: colors.text, fontWeight: '800' },
  compactChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  compactChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  compactChipText: { fontSize: 12, color: colors.textSecondary },
  compactChipTextActive: { color: colors.primary, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 0,
    ...shadows.subtle,
    position: 'relative'
  },
  rowCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: spacing.md, backgroundColor: colors.border },
  avatarCompact: { width: 28, height: 28, borderRadius: 14, marginRight: spacing.sm },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
    textTransform: 'capitalize' as any,
    textAlign: 'center'
  },
  badgeEmployee: {
    backgroundColor: colors.background,
    color: colors.textSecondary,
    borderColor: colors.border,
    borderWidth: 1
  },
  badgeManager: {
    backgroundColor: colors.primary + '20',
    color: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary + '40'
  },
  badgeAdmin: {
    backgroundColor: colors.error + '20',
    color: colors.error,
    borderWidth: 1,
    borderColor: colors.error + '40'
  },
  badgeSuccess: {
    backgroundColor: colors.success + '20',
    color: colors.success,
    borderWidth: 1,
    borderColor: colors.success + '40'
  },
  badgeWarning: {
    backgroundColor: colors.warning + '20',
    color: colors.warning,
    borderWidth: 1,
    borderColor: colors.warning + '40'
  },
  badgeError: {
    backgroundColor: colors.error + '20',
    color: colors.error,
    borderWidth: 1,
    borderColor: colors.error + '40'
  },
  status: { ...typography.caption, marginTop: 4 },
  statusActive: { color: '#22c55e' },
  statusInactive: { color: colors.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stickyHeader: { backgroundColor: colors.background, paddingBottom: 0, borderBottomWidth: 0, borderColor: 'transparent', zIndex: 3, elevation: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { width: '100%', backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, ...shadows.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  value: { color: colors.text },
  dropdownField: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card, marginTop: spacing.xs },
  dropdownValue: { color: colors.text },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', justifyContent: 'center', flex: 1 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', justifyContent: 'center', flex: 1 },
  secondaryBtnText: { color: colors.text },
  emptyTitle: { fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  emptySub: { ...typography.caption, color: colors.textSecondary },
  // KPI cards (Team Reports)
  kpiCard: { backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  kpiLabel: { ...typography.caption, color: colors.textSecondary },
  kpiValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  chipsScroll: { paddingRight: spacing.sm },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, ...shadows.card },
  fabText: { color: '#fff', fontWeight: '800' },
  // Dashboard styles - Enhanced
  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.subtle
  },
  backBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  tileCard: {
    flexBasis: '60%',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 0,
    minHeight: 120,
    position: 'relative',
    ...shadows.card
  },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  tileCount: { marginTop: spacing.xs, fontSize: 20, fontWeight: '800', color: colors.primary, lineHeight: 28 },
  tileDesc: { marginTop: spacing.sm, fontSize: 16, color: colors.textSecondary, lineHeight: 16 },
  tileCircle: {
    width: '60%',
    aspectRatio: 1,
    borderRadius: radii.pill,
    backgroundColor: '#DCDCDC',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'center'
  },
  tileIcon: { fontSize: 60, marginBottom: spacing.sm, opacity: 0.8 },
  tileItem: { flexBasis: '40%', maxWidth: '32%', alignItems: 'center', justifyContent: 'flex-start', marginBottom: spacing.sm },
  tileLabel: { fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 4, fontSize: 11 },
  tileBadge: { position: 'relative', backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 1, paddingVertical: 1, minWidth: 8, alignItems: 'center', justifyContent: 'center', marginRight: 1 },
  tileBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center', lineHeight: 8 },
  // Compact variants for tiles
  tileItemCompact: { flexBasis: '32%', maxWidth: '32%' },
  tileCircleCompact: { width: '80%', aspectRatio: 1, borderRadius: radii.pill, alignSelf: 'center' },
  // New shared section styles
  sectionCard: { backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  helpText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  countPill: { backgroundColor: colors.primary + '20', color: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, overflow: 'hidden', fontWeight: '800' },
  ghostBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  ghostBtnText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  skelBlock: { height: 10, backgroundColor: colors.border, borderRadius: 6 },
  // New UI elements
  tileHeaderRow: { position: 'absolute', top: 4, left: 4, right: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  tileHeaderIconBtn: { marginLeft: 0, padding: 0, borderRadius: radii.sm, backgroundColor: 'transparent', minWidth: 16, minHeight: 16, alignItems: 'center', justifyContent: 'center' },
  tileBadgeCorner: { position: 'absolute', bottom: 8, right: 8, backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 2, paddingVertical: 1, alignItems: 'center', justifyContent: 'center', minWidth: 14, ...shadows.subtle },
  tileGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.pill, opacity: 0.05 },
  tilePressed: { transform: [{ scale: 0.96 }], opacity: 0.8 },
  sectionDivider: { height: 1, backgroundColor: colors.border, opacity: 0.6, marginBottom: spacing.sm },
});
