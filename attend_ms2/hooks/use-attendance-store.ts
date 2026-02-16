import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AttendanceDay, Leave, LeaveType } from '@/types/attendance';
import { apiService } from '@/lib/api';
import { events } from '@/lib/events';
import { useAuth } from '@/hooks/use-auth';
import { validateAttendanceData, retryOperation } from '@/lib/sync-utils';
import { formatDateLocal } from '@/lib/date';

const TASKS_CACHE_KEY = '@tasks_cache';
const CACHE_EXPIRY_DAYS = 3;

export const [AttendanceContext, useAttendance] = createContextHook(() => {
  const { user, isAuthenticated, refreshSession } = useAuth();
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  // History list (for History tab)
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);
  // Today's single record (for Clock screen and quick status)
  const [todayRecord, setTodayRecord] = useState<AttendanceDay | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [lastHistoryError, setLastHistoryError] = useState<{ status?: number; message?: string } | null>(null);
  // Prevent duplicate history fetches (StrictMode remounts / rapid tab switches)
  const historyInFlightRef = useRef(false);
  const historyFetchKeyRef = useRef<string>('');
  const historyFetchTsRef = useRef<number>(0);
  // Remember last requested history range so we can refresh it on pull-to-refresh
  const lastHistoryRangeRef = useRef<{ start: string; end: string } | null>(null);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string | null;
    accuracy?: number | null;
  } | null>(null);

  // Shared cache for project tasks (keyed by `${date}|${projectName}`)
  type TaskItem = { id: string; name: string; status: string };
  type TaskCacheEntry = { loading: boolean; items: TaskItem[] | null; error?: string; timestamp: number };
  type PersistentCache = { [key: string]: { items: TaskItem[]; timestamp: number } };

  const [projectTasksCache, setProjectTasksCache] = useState<Record<string, TaskCacheEntry>>({});
  const [projectTasksCacheVersion, setProjectTasksCacheVersion] = useState(0);

  // Keys and accessors for project task cache (declare early so others can use without lints)
  const getProjectTasksCacheKey = (date: string, projectName: string) => `${date}|${projectName}`;

  const getProjectTasksCacheEntry = (date: string, projectName: string): TaskCacheEntry | undefined => {
    return projectTasksCache[getProjectTasksCacheKey(date, projectName)];
  };

  // Update a single task's status and sync cache (outside effects)
  const updateProjectTaskStatus = async (
    date: string,
    projectName: string,
    taskId: string,
    status: 'pending' | 'in-progress' | 'done' | 'blocked'
  ) => {
    if (!user?.empNo || !(user as any).companyCode) return { success: false } as any;
    const companyCode = (user as any).companyCode as string;
    // Call API
    const resp = await apiService.updateProjectTaskStatus(companyCode, taskId, status);
    // Update cache optimistically
    const key = getProjectTasksCacheKey(date, projectName);
    setProjectTasksCache((prev) => {
      const entry = prev[key];
      if (!entry || !entry.items) return prev;
      const items = entry.items.map((it) => (it.id === taskId ? { ...it, status } : it));
      return { ...prev, [key]: { ...entry, items, timestamp: Date.now() } };
    });
    setProjectTasksCacheVersion((v) => v + 1);
    // Notify other screens (e.g., tab badge) to refresh task indicators
    try { events.emit('schedule:tasks-updated'); } catch { }
    return resp;
  };

  // Load tasks from AsyncStorage on mount
  useEffect(() => {
    const loadCachedTasks = async () => {
      try {
        const cached = await AsyncStorage.getItem(TASKS_CACHE_KEY);
        if (!cached) return;

        const parsed: PersistentCache = JSON.parse(cached);
        const now = Date.now();
        const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        // Filter out expired entries (older than 3 days)
        const validEntries = Object.entries(parsed).filter(
          ([_, { timestamp }]) => (now - timestamp) < expiryMs
        );

        if (validEntries.length > 0) {
          const validCache = validEntries.reduce((acc, [key, { items }]) => ({
            ...acc,
            [key]: { loading: false, items, timestamp: Date.now() }
          }), {} as Record<string, TaskCacheEntry>);

          setProjectTasksCache(prev => ({
            ...validCache,
            ...prev // In-memory entries take precedence
          }));
        }
      } catch (e) {
        console.warn('Failed to load tasks cache', e);
      }
    };
    loadCachedTasks();
  }, []);

  // Save to AsyncStorage whenever cache updates
  const saveTasksToStorage = useCallback(async (cache: typeof projectTasksCache) => {
    try {
      const now = Date.now();
      const toPersist: PersistentCache = {};

      // Only persist non-loading, non-error entries with items
      Object.entries(cache).forEach(([key, entry]) => {
        if (!entry.loading && entry.items) {
          toPersist[key] = {
            items: entry.items,
            timestamp: now
          };
        }
      });

      await AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(toPersist));
    } catch (e) {
      console.warn('Failed to persist tasks cache', e);
    }
  }, []);

  // Update storage when cache changes
  useEffect(() => {
    if (projectTasksCacheVersion > 0) {
      saveTasksToStorage(projectTasksCache);
    }
  }, [projectTasksCache, projectTasksCacheVersion, saveTasksToStorage]);

  const clearProjectTasksCache = useCallback(async () => {
    setProjectTasksCache({});
    setProjectTasksCacheVersion(v => v + 1);
    try {
      await AsyncStorage.removeItem(TASKS_CACHE_KEY);
    } catch (e) {
      console.warn('Failed to clear persisted tasks cache', e);
    }
  }, []);

  const ensureProjectTasksForDate = async (date: string, projectName: string, force = false) => {
    if (!user?.empNo || !(user as any).companyCode) return;
    const companyCode = (user as any).companyCode as string;
    const key = getProjectTasksCacheKey(date, projectName);

    // Check cache first (unless force refresh)
    if (!force) {
      const entry = projectTasksCache[key];
      if (entry?.loading || entry?.items) return entry.items; // already loaded
    }

    try {
      setProjectTasksCache((prev) => ({
        ...prev, [key]: {
          ...prev[key],
          loading: true,
          items: prev[key]?.items || null
        }
      }));
      setProjectTasksCacheVersion(v => v + 1);

      // Fetch fresh data
      const res = await apiService.getProjectTasks(companyCode, projectName, user.empNo);
      const items = Array.isArray(res?.data) ? (res.data as TaskItem[]) : [];

      // Update cache with fresh data
      setProjectTasksCache((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          items,
          timestamp: Date.now()
        }
      }));
      setProjectTasksCacheVersion(v => v + 1);

      return items;
    } catch (e: any) {
      const error = e?.message || 'Failed to load tasks';
      setProjectTasksCache((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          items: null,
          error,
          timestamp: Date.now()
        }
      }));
      setProjectTasksCacheVersion(v => v + 1);
      return null;
    }
  };

  // Request location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      // On Android, proactively request background too to make the prompt more explicit
      if (Platform.OS === 'android') {
        try { await Location.requestBackgroundPermissionsAsync(); } catch { }
      }
      setLocationPermission(status === 'granted');
    })();
  }, []);

  // Re-check permissions when app returns to foreground (from Settings)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          setLocationPermission(perm.status === 'granted');
        } catch { }
      }
    });
    return () => sub.remove();
  }, []);

  // Load attendance data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.empNo) {
      loadAttendanceData();
    }
  }, [isAuthenticated, user?.empNo]);

  const loadAttendanceData = async () => {
    if (!user?.empNo || !(user as any).companyCode) return;

    try {
      setIsLoading(true);

      // Get session token for authenticated endpoints
      const sessionToken = (user as any).sessionToken;

      // Load data in parallel for better performance
      const [attResp, leavesResp, leaveBalanceResp, leaveRequestsResp] = await Promise.allSettled([
        apiService.getTodayAttendance(user.empNo, (user as any).companyCode),
        apiService.getLeaves((user as any).companyCode, user.empNo),
        sessionToken ? apiService.getLeaveBalance(sessionToken) : Promise.resolve(null),
        sessionToken ? apiService.getLeaveRequests(sessionToken) : Promise.resolve(null)
      ]);

      // Handle attendance response
      // Handle attendance response
      if (attResp.status === 'fulfilled') {
        if (attResp.value?.success && attResp.value?.data) {
          const attendanceData = attResp.value.data as AttendanceDay;
          console.log('🔄 [Store] loadAttendanceData received:', JSON.stringify(attendanceData, null, 2));

          // Validate data structure before setting state
          if (attendanceData.date) {
            console.log('✅ [Store] Setting todayRecord with valid date:', attendanceData.date);
            setTodayRecord(attendanceData);

            // Also update the main attendance list if generic logic needs it
            setAttendance(prev => {
              const existing = prev.filter(d => d.date !== attendanceData.date);
              return [...existing, attendanceData].sort((a, b) => b.date.localeCompare(a.date));
            });
          } else {
            console.warn('⚠️ [Store] Invalid attendance data structure (missing date):', attendanceData);
            // Don't blindly set null if we have partial data, but warning is good
            setTodayRecord(null);
          }
        } else {
          console.warn('⚠️ [Store] Attendance API success=false or no data', attResp.value);
          setTodayRecord(null);
        }
      } else {
        console.error('❌ [Store] Failed to load attendance (rejected):', attResp.reason);
        setTodayRecord(null);
      }

      // Handle leave balance response - update user object properly
      if (leaveBalanceResp.status === 'fulfilled') {
        if (leaveBalanceResp.value?.success && leaveBalanceResp.value?.data) {
          const balanceData = leaveBalanceResp.value.data;
          console.log('💰 [Store] Received leave balance:', JSON.stringify(balanceData.balance));

          // Update user's leave balance in secure storage and refresh session
          if (balanceData.balance && user) {
            try {
              const { secureStorage } = await import('@/lib/secure-storage');
              const userData = await secureStorage.getUserData();
              if (userData) {
                console.log('💾 [Store] Updating user leave balance in storage...');
                const updatedUser = { ...userData, leaveBalance: balanceData.balance };
                await secureStorage.storeUserData(updatedUser);
                // Refresh session to update user state
                await refreshSession();
                console.log('🔄 [Store] Session refreshed with new balance');
              } else {
                console.warn('⚠️ [Store] No userData found in storage to update');
              }
            } catch (err) {
              console.error('❌ [Store] Failed to update leave balance:', err);
            }
          } else {
            console.warn('⚠️ [Store] Missing balance date or user object');
          }
        } else {
          console.warn('⚠️ [Store] Leave balance API success=false', leaveBalanceResp.value);
        }
      } else {
        console.error('❌ [Store] Leave balance request rejected', leaveBalanceResp.reason);
      }

      // Handle leave requests response
      if (leaveRequestsResp.status === 'fulfilled' && Array.isArray(leaveRequestsResp.value)) {
        // Map leave requests to Leave format
        const mappedLeaves = leaveRequestsResp.value.map((req: any) => ({
          id: String(req.id || ''),
          empNo: user.empNo,
          startDate: req.leaveRequestFrom || req.start_date,
          endDate: req.leaveRequestTo || req.end_date,
          type: (req.leaveType || req.type || 'annual').toLowerCase(),
          reason: req.reason || '',
          status: req.leaveStatus || req.status || 'pending',
          effectiveDays: req.days || 1,
          createdAt: req.applyDate || req.created_at
        }));
        setLeaves(mappedLeaves as Leave[]);
      } else if (leavesResp.status === 'fulfilled' && Array.isArray(leavesResp.value?.data)) {
        // Fallback to old endpoint
        setLeaves(leavesResp.value.data as Leave[]);
      } else {
        if (leavesResp.status === 'rejected') {
          console.error('Failed to load leaves:', leavesResp.reason);
        }
        setLeaves([]);
      }

      // Refresh history for the last viewed range if available
      try {
        const range = lastHistoryRangeRef.current;
        if (range) {
          await fetchAttendanceByDateRange(range.start, range.end);
        }
      } catch (historyError) {
        console.warn('Failed to refresh history:', historyError);
      }
    } catch (error) {
      console.error('Failed to load attendance data:', error);
      setTodayRecord(null);
      setLeaves([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get current location with timeout and accuracy fallback
  const getCurrentLocation = async () => {
    console.log('getCurrentLocation called, permission:', locationPermission);
    if (!locationPermission) {
      // Try to request on demand
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationPermission(granted);
      if (!granted) throw new Error('Location permission not granted');
    }

    try {
      // Ensure device location services are enabled (GPS/network)
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Location services disabled');
      }

      // Try highest accuracy first with a timeout, then fallback to balanced if needed
      const withTimeout = <T,>(p: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Location timeout')), ms);
        p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
      });

      let location: Location.LocationObject;
      try {
        location = await withTimeout(Location.getCurrentPositionAsync({
          // Use BestForNavigation when available for tighter accuracy
          accuracy: (Location as any).Accuracy?.BestForNavigation ?? Location.Accuracy.Highest,
          mayShowUserSettingsDialog: true,
        }), 10000);
      } catch {
        // Fallback to balanced power accuracy
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      let address;
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (geocode.length > 0) {
          const { street, streetNumber, city, region, postalCode, country, name, subregion, district } = geocode[0] as any;
          // Prefer explicit door/house number + street
          const doorNo = streetNumber || undefined;
          const streetLine = [doorNo, street].filter(Boolean).join(' ');
          const locality = city || district || subregion || undefined;
          const primary = streetLine || name;
          address = [primary, locality, region, postalCode, country]
            .filter(Boolean)
            .join(', ');
        }
      } catch (error) {
        console.log('Geocoding error:', error);
      }

      // Intentionally no Google Geocoding fallback: we persist the device's live reverse-geocoded address

      const result = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
        accuracy: (location.coords as any)?.accuracy ?? null,
      } as const;

      setCurrentLocation(result);
      return result;
    } catch (error: any) {
      console.log('Location error:', error);
      // Bubble up the most relevant message; upstream will tailor alerts
      const msg = String(error?.message || 'Failed to get location');
      throw new Error(msg);
    }
  };

  // Strict: require GPS coordinates AND a non-empty human-readable address.
  // Performs a single retry to reverse-geocode if the first attempt returned no address.
  const getCurrentLocationStrict = async () => {
    const base = await getCurrentLocation();
    const validLat = Number.isFinite(base?.latitude);
    const validLng = Number.isFinite(base?.longitude);
    if (!validLat || !validLng) {
      throw new Error('GPS unavailable. Please enable Location Services and try again.');
    }

    let address = typeof base.address === 'string' ? base.address.trim() : '';
    if (!address) {
      // Retry once after a short delay, using the same coordinates
      await new Promise((r) => setTimeout(r, 800));
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: base.latitude,
          longitude: base.longitude,
        });
        if (Array.isArray(geocode) && geocode.length > 0) {
          const { street, streetNumber, city, region, postalCode, country, name, subregion, district } = geocode[0] as any;
          const doorNo = streetNumber || undefined;
          const streetLine = [doorNo, street].filter(Boolean).join(' ');
          const locality = city || district || subregion || undefined;
          const primary = streetLine || name;
          address = [primary, locality, region, postalCode, country]
            .filter(Boolean)
            .join(', ');
        }
      } catch {
        // ignore retry errors, will fall through to validation
      }
    }

    if (!address) {
      throw new Error('Address unavailable. Please ensure you are online and try again near an identifiable place.');
    }

    // If we obtained a better address on retry, update store and return it
    if (!base.address && address) {
      const updated = { ...base, address } as typeof base;
      setCurrentLocation(updated);
      return updated;
    }
    return { ...base, address } as typeof base;
  };

  const fetchCurrentLocation = async () => {
    return getCurrentLocation();
  };

  // Allow UI to re-request permission on demand
  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (Platform.OS === 'android') {
      try { await Location.requestBackgroundPermissionsAsync(); } catch { }
    }
    const granted = status === 'granted';
    setLocationPermission(granted);
    return granted;
  };

  // Explicitly re-check current permission without prompting
  const recheckLocationPermission = async () => {
    const perm = await Location.getForegroundPermissionsAsync();
    const granted = perm.status === 'granted';
    setLocationPermission(granted);
    return granted;
  };

  // Get today's attendance
  const getTodayAttendance = () => {
    if (todayRecord) return todayRecord;
    if (!attendance) return null;
    const today = formatDateLocal(new Date());
    return attendance.find((day: AttendanceDay) => day.date === today) || null;
  };

  // Multi-entry helpers
  const getEntry = (siteName?: string, projectName?: string) => {
    const today = getTodayAttendance();
    const entries = today?.entries || [];
    if (!entries.length) return undefined;
    // Match by provided keys; undefined matches undefined keys too
    return entries.find((e: any) => (e.siteName || undefined) === (siteName || undefined)
      && (e.projectName || undefined) === (projectName || undefined));
  };

  const isClockedInFor = (meta?: { siteName?: string; projectName?: string }) => {
    const today = getTodayAttendance();
    if (!today) return false;
    if (Array.isArray(today.entries) && today.entries.length > 0) {
      if (meta && (meta.siteName || meta.projectName)) {
        const e = getEntry(meta.siteName, meta.projectName);
        return !!e?.clockIn && !e?.clockOut; // in without out yet
      }
      // Any active entry counts as clocked-in for global state
      return today.entries.some((e: any) => !!e.clockIn && !e.clockOut);
    }
    // Fallback to legacy top-level
    return !!today.clockIn && !today.clockOut;
  };

  const isClockedOutFor = (meta?: { siteName?: string; projectName?: string }) => {
    const today = getTodayAttendance();
    if (!today) return false;
    if (Array.isArray(today.entries) && today.entries.length > 0) {
      if (meta && (meta.siteName || meta.projectName)) {
        const e = getEntry(meta.siteName, meta.projectName);
        return !!e?.clockOut;
      }
      // Global: all active entries have clocked out
      const anyActive = today.entries.some((e: any) => !!e.clockIn && !e.clockOut);
      return !anyActive && today.entries.some((e: any) => !!e.clockOut);
    }
    // Fallback
    return !!today.clockOut;
  };

  // Helpers
  const parseISO = (d: string) => new Date(d);
  const daysInclusive = (start: string, end: string) => {
    const s = parseISO(start); const e = parseISO(end);
    return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };
  const validateLeaveClient = (data: { startDate: string; endDate: string; type: LeaveType; reason: string; duration?: 'full' | 'half'; halfDayPeriod?: 'AM' | 'PM' }) => {
    if (!data.startDate || !data.endDate) throw new Error('Start and end dates are required');
    const s = parseISO(data.startDate); const e = parseISO(data.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) throw new Error('Invalid date format');
    if (e < s) throw new Error('End date must be after or equal to start date');
    if (!data.type) throw new Error('Leave type is required');
    if (!data.reason?.trim()) throw new Error('Reason is required');
    // Half-day constraints
    const isSingleDay = data.startDate === data.endDate;
    if (data.duration === 'half') {
      if (!isSingleDay) throw new Error('Half-day is only allowed for single-day leave');
      if (!data.halfDayPeriod) throw new Error('Please choose AM or PM for half-day');
    }
    const lower = data.type.toLowerCase() as LeaveType;
    const requiresBalance = ['annual', 'medical', 'emergency'].includes(lower);
    const balance = (user as any)?.leaveBalance || {};
    if (requiresBalance) {
      const available = Number(balance[lower] ?? 0);
      const reqUnits = isSingleDay && data.duration === 'half' ? 0.5 : daysInclusive(data.startDate, data.endDate);
      if (available <= 0) throw new Error(`No ${lower} leave balance available`);
      if (reqUnits > available) throw new Error(`Insufficient ${lower} leave balance. Requested ${reqUnits}, available ${available}.`);
    }
  };

  // Check overlap with existing leaves (pending/approved)
  const overlapsExistingLeave = (data: { startDate: string; endDate: string; duration?: 'full' | 'half'; halfDayPeriod?: 'AM' | 'PM' }) => {
    const s = data.startDate; const e = data.endDate;
    const isHalf = data.duration === 'half' && s === e;
    const relevant = leaves.filter((lv: any) => lv.status !== 'rejected');
    return relevant.some((lv: any) => {
      // date range overlap at day level
      const dateOverlap = !(lv.endDate < s || lv.startDate > e);
      if (!dateOverlap) return false;
      // If either existing or new is single-day (incl. half), block any additional leave on that same date
      const lvSingle = lv.startDate === lv.endDate;
      if ((isHalf || (s === e)) && lvSingle && lv.startDate === s) {
        return true; // Disallow any duplicate on same date
      }
      // Otherwise, any multi-day overlap means conflict
      return true;
    });
  };

  // Get attendance for a specific date range
  const getAttendanceByDateRange = (startDate: string, endDate: string) => {
    if (!attendance) return [];
    return attendance.filter((day: AttendanceDay) => day.date >= startDate && day.date <= endDate);
  };

  // Fetch attendance history from backend and replace store list
  const fetchAttendanceByDateRange = async (startDate: string, endDate: string) => {
    if (!user?.empNo || !(user as any).companyCode) return;
    const key = `${startDate}:${endDate}`;
    const now = Date.now();
    // If an identical request is in-flight, or we fetched this key very recently, skip
    if (historyInFlightRef.current && historyFetchKeyRef.current === key) return;
    if (historyFetchKeyRef.current === key && now - historyFetchTsRef.current < 2000) return;
    try {
      lastHistoryRangeRef.current = { start: startDate, end: endDate };
      historyInFlightRef.current = true;
      historyFetchKeyRef.current = key;
      setIsHistoryLoading(true);
      setLastHistoryError(null);
      const resp: any = await apiService.getAttendanceHistory(
        (user as any).companyCode,
        user.empNo,
        startDate,
        endDate
      );
      if (resp?.success && Array.isArray(resp?.data)) {
        setAttendance(resp.data as AttendanceDay[]);
        setLastHistoryError(null);
      } else {
        setAttendance([]);
        setLastHistoryError({ message: 'Invalid history response' });
      }
    } catch (e) {
      console.error('Failed to fetch attendance history:', e);
      setAttendance([]);
      const status = (e as any)?.status;
      const msg = String((e as any)?.message || '').toLowerCase();
      setLastHistoryError({ status, message: (e as any)?.message });

      // Fallback: if unauthorized or failed, try to fetch today's attendance and inject it
      try {
        const todayStr = formatDateLocal(new Date());
        const inRange = startDate <= todayStr && todayStr <= endDate;
        if (inRange) {
          const todayResp = await apiService.getTodayAttendance(user.empNo, (user as any).companyCode);
          if (todayResp?.success && todayResp?.data) {
            const d = todayResp.data as AttendanceDay;
            setAttendance([d]);
          }
        }
      } catch { }
    } finally {
      historyInFlightRef.current = false;
      historyFetchTsRef.current = Date.now();
      setIsHistoryLoading(false);
    }
  };

  // Get leaves for a specific date range
  const getLeavesByDateRange = (startDate: string, endDate: string) => {
    if (!leaves) return [];
    return leaves.filter((leave: any) =>
      (leave.startDate <= endDate && leave.endDate >= startDate)
    ) as Leave[];
  };

  // Get pending leaves (for admin/manager)
  const getPendingLeaves = () => {
    if (!leaves) return [];
    return leaves.filter((leave: any) => leave.status === 'pending') as Leave[];
  };

  return {
    user,
    isLoading,
    isHistoryLoading,
    attendance,
    leaves,
    locationPermission,
    currentLocation,
    fetchCurrentLocation,
    requestLocationPermission,
    recheckLocationPermission,
    refreshAttendance: async () => {
      await loadAttendanceData();
    },

    clockIn: async (
      method: 'face' | 'button',
      imageUri?: string,
      meta?: { siteName?: string; projectName?: string },
      faceTemplateBase64?: string
    ) => {
      console.log('==================== CLOCK IN START ====================');
      console.log('📍 clockIn called at:', new Date().toISOString());
      console.log('📍 Method:', method);
      console.log('📍 Meta:', JSON.stringify(meta));
      console.log('📍 User empNo:', user?.empNo);
      console.log('📍 User companyCode:', (user as any)?.companyCode);
      console.log('📍 ImageUri provided:', !!imageUri);
      console.log('📍 FaceTemplate provided:', !!faceTemplateBase64);

      if (!user?.empNo || !(user as any).companyCode) {
        console.error('❌ CLOCK IN FAILED: User not authenticated');
        console.log('==================== CLOCK IN END (ERROR) ====================');
        throw new Error('User not authenticated');
      }

      try {
        console.log('📍 Getting current location...');
        const location = await getCurrentLocationStrict();
        console.log('📍 Location obtained:', JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          accuracy: location.accuracy
        }));

        console.log('📍 Calling API clockIn...');
        const result = await apiService.clockIn(
          user.empNo,
          (user as any).companyCode,
          { latitude: location.latitude, longitude: location.longitude, address: location.address ?? null, accuracy: location.accuracy ?? null },
          method,
          meta,
          imageUri,
          faceTemplateBase64
        );
        console.log('📍 API Response received:', JSON.stringify(result));

        if (!result || !result.success) {
          console.error('❌ CLOCK IN FAILED: API returned failure');
          console.error('❌ Result:', JSON.stringify(result));
          console.log('==================== CLOCK IN END (API FAIL) ====================');
          throw new Error((result as any)?.message || 'Clock in failed');
        }

        console.log('✅ Clock In API succeeded, refreshing attendance data...');
        await loadAttendanceData();
        console.log('✅ Attendance data refreshed');
        console.log('==================== CLOCK IN END (SUCCESS) ====================');
        return result;
      } catch (error: any) {
        console.error('❌ CLOCK IN EXCEPTION:', error?.message || error);
        console.error('❌ Error stack:', error?.stack);
        console.log('==================== CLOCK IN END (EXCEPTION) ====================');
        throw error;
      }
    },

    clockOut: async (
      method: 'face' | 'button',
      imageUri?: string,
      meta?: { siteName?: string; projectName?: string },
      faceTemplateBase64?: string
    ) => {
      console.log('==================== CLOCK OUT START ====================');
      console.log('📍 clockOut called at:', new Date().toISOString());
      console.log('📍 Method:', method);
      console.log('📍 Meta:', JSON.stringify(meta));
      console.log('📍 User empNo:', user?.empNo);
      console.log('📍 User companyCode:', (user as any)?.companyCode);
      console.log('📍 ImageUri provided:', !!imageUri);
      console.log('📍 FaceTemplate provided:', !!faceTemplateBase64);

      if (!user?.empNo || !(user as any).companyCode) {
        console.error('❌ CLOCK OUT FAILED: User not authenticated');
        console.log('==================== CLOCK OUT END (ERROR) ====================');
        throw new Error('User not authenticated');
      }

      try {
        console.log('📍 Getting current location...');
        const location = await getCurrentLocationStrict();
        console.log('📍 Location obtained:', JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          accuracy: location.accuracy
        }));

        console.log('📍 Calling API clockOut...');
        const result = await apiService.clockOut(
          user.empNo,
          (user as any).companyCode,
          { latitude: location.latitude, longitude: location.longitude, address: location.address ?? null, accuracy: location.accuracy ?? null },
          method,
          meta,
          imageUri,
          faceTemplateBase64
        );
        console.log('📍 API Response received:', JSON.stringify(result));

        if (!result || !result.success) {
          console.error('❌ CLOCK OUT FAILED: API returned failure');
          console.error('❌ Result:', JSON.stringify(result));
          console.log('==================== CLOCK OUT END (API FAIL) ====================');
          throw new Error((result as any)?.message || 'Clock out failed');
        }

        console.log('✅ Clock Out API succeeded, refreshing attendance data...');
        await loadAttendanceData();
        console.log('✅ Attendance data refreshed');
        console.log('==================== CLOCK OUT END (SUCCESS) ====================');
        return result;
      } catch (error: any) {
        console.error('❌ CLOCK OUT EXCEPTION:', error?.message || error);
        console.error('❌ Error stack:', error?.stack);
        console.log('==================== CLOCK OUT END (EXCEPTION) ====================');
        throw error;
      }
    },

    applyLeave: async (data: { startDate: string, endDate: string, type: LeaveType, reason: string, attachmentUri?: string, attachmentName?: string, attachmentMimeType?: string, duration?: 'full' | 'half', halfDayPeriod?: 'AM' | 'PM' }) => {
      if (!user?.empNo) {
        throw new Error('User not authenticated');
      }

      // Client-side validation to improve UX
      validateLeaveClient(data);

      // Prevent duplicates/overlaps with existing leaves
      if (overlapsExistingLeave(data)) {
        throw new Error('Overlapping leave request exists for the selected dates');
      }

      try {
        const resp: any = await apiService.applyLeave((user as any).companyCode, user.empNo, data);
        // Refresh leaves list after apply
        await loadAttendanceData();
        return resp;
      } catch (err: any) {
        const status = err?.status;
        const msg = String(err?.message || '').toLowerCase();
        if (status === 409 || msg.includes('already exists')) {
          throw new Error('A leave request already exists for the selected date range.');
        }
        throw err;
      }
    },

    updateLeaveStatus: async (data: { leaveId: string, status: 'approved' | 'rejected', rejectedReason?: string }) => {
      if (!user?.empNo) {
        throw new Error('User not authenticated');
      }

      const resp: any = await apiService.updateLeaveStatus(
        data.leaveId,
        data.status,
        data.rejectedReason,
        (user as any).companyCode,
        user.empNo
      );
      // Refresh leaves list after update
      await loadAttendanceData();
      return resp;
    },

    getTodayAttendance,
    getAttendanceByDateRange,
    fetchAttendanceByDateRange,
    getLeavesByDateRange,
    getPendingLeaves,
    lastHistoryError,
    getProjectTasksCacheEntry,
    ensureProjectTasksForDate,
    updateProjectTaskStatus,
    clearProjectTasksCache,
    projectTasksCacheVersion,
    // Backward compatible global checks that consider multi-entry
    isClockedIn: () => {
      const today = getTodayAttendance();
      if (!today) return false;
      if (Array.isArray(today.entries) && today.entries.length > 0) {
        return today.entries.some((e: any) => !!e.clockIn && !e.clockOut);
      }
      return !!today.clockIn && !today.clockOut;
    },
    isClockedOut: () => {
      const today = getTodayAttendance();
      if (!today) return false;
      if (Array.isArray(today.entries) && today.entries.length > 0) {
        const anyActive = today.entries.some((e: any) => !!e.clockIn && !e.clockOut);
        return !anyActive && today.entries.some((e: any) => !!e.clockOut);
      }
      return !!today.clockOut;
    },
    // Per-site/project helpers
    getEntry,
    isClockedInFor,
    isClockedOutFor,
  };
});
