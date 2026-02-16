import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, RefreshControl, Linking, Animated, Easing, Modal } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { Camera, MapPin, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import ClockButton from '@/components/ClockButton';
import SiteProjectModal, { SiteProjectMeta } from '@/components/SiteProjectModal';
import FastFacialClocking from '@/components/FastFacialClocking';
import colors from '@/constants/colors';
import { useAttendance } from '@/hooks/use-attendance-store';
import { useAuth } from '@/hooks/use-auth';
import ActionModal from '@/components/ActionModal';
import StatusModal, { StatusType, StatusModalButton } from '@/components/StatusModal';
import { apiService } from '@/lib/api';
import CustomLoader from '@/components/CustomLoader';
import { useFocusEffect } from '@react-navigation/native';

// Suppress ALL error popups, banners, and notifications
if (Platform.OS !== 'web') {
  // Suppress console errors that trigger React Native error overlays
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = (...args: any[]) => {
    // Completely suppress ALL error logging - no output at all
    return;
  };

  console.warn = (...args: any[]) => {
    // Completely suppress ALL warning logging - no output at all
    return;
  };

  // Comprehensive error suppression
  try {
    const globalAny = global as any;

    // Override ErrorUtils completely
    if (globalAny.ErrorUtils) {
      globalAny.ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
        // Completely suppress - no logging, no UI
        return;
      });

      // Also override reportFatalError if it exists
      if (globalAny.ErrorUtils.reportFatalError) {
        globalAny.ErrorUtils.reportFatalError = () => { };
      }
    }

    // Handle unhandled promise rejections
    const originalRejectionHandler = globalAny.onunhandledrejection;
    globalAny.onunhandledrejection = (event: any) => {
      // Completely suppress
      if (event && event.preventDefault) {
        event.preventDefault();
      }
      return true;
    };

    // Also try addEventListener if available
    if (typeof globalAny.addEventListener === 'function') {
      globalAny.addEventListener('unhandledrejection', (event: any) => {
        if (event && event.preventDefault) {
          event.preventDefault();
        }
      });
    }

    // Suppress React Native's LogBox if available
    if (globalAny.LogBox) {
      globalAny.LogBox.ignoreAllLogs(true);
    }

  } catch (e) {
    // Silently ignore setup failures
  }
}

// Simple fade-in hook for Animated opacity when dependency changes
function useFade(dep: any): Animated.AnimatedInterpolation<number> | Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dep]);
  return opacity;
}

// (removed unused getProfileImageUri helper)

// Safely format timestamps coming from API/demo. Accepts ms, seconds, ISO string, Date
function safeFormatTime(ts: any, fmt: string = 'h:mm a'): string {
  if (ts == null) return '--';
  try {
    let d: Date | null = null;
    if (typeof ts === 'number') {
      const ms = ts < 1e12 ? ts * 1000 : ts; // treat small numbers as seconds
      d = new Date(ms);
    } else if (typeof ts === 'string') {
      const num = Number(ts);
      if (!Number.isNaN(num)) {
        const ms = num < 1e12 ? num * 1000 : num;
        d = new Date(ms);
      } else {
        d = new Date(ts);
      }
    } else if (ts instanceof Date) {
      d = ts;
    }
    if (!d || Number.isNaN(d.getTime())) return '--';
    return format(d, fmt);
  } catch {
    return '--';
  }
}

export default function ClockScreen() {
  const {
    user,
    isLoading,
    clockIn,
    clockOut,
    getTodayAttendance,
    isClockedIn,
    isClockedOut,
    isClockedInFor,
    isClockedOutFor,
    locationPermission,
    requestLocationPermission,
    refreshAttendance,
  } = useAttendance();
  const { refreshSession } = useAuth();

  const [showCamera, setShowCamera] = useState(false);
  const [isClocking, setIsClocking] = useState(false);
  const [clockMethod, setClockMethod] = useState<'face' | 'button' | null>(null);
  const [siteModalVisible, setSiteModalVisible] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<SiteProjectMeta | null>(null);
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | 'face' | 'select' | null>(null);
  const [sessionSites, setSessionSites] = useState<Record<string, { in?: boolean; out?: boolean }>>({});
  const [profileActionVisible, setProfileActionVisible] = useState(false);
  const [uiMessage, setUiMessage] = useState<string>("");
  const [facePlannedAction, setFacePlannedAction] = useState<'in' | 'out' | null>(null);
  const [showRegisterCamera, setShowRegisterCamera] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null);
  const [viewer, setViewer] = useState<{ uri: string; timestamp?: number; title: string; location?: string } | null>(null);
  // Backend-controlled method flags
  const [allowFace, setAllowFace] = useState(true);
  const [allowButton, setAllowButton] = useState(true);
  // Backend-controlled behavior flags
  const [requireSitePopup, setRequireSitePopup] = useState(false);
  // Company name state
  const [companyName, setCompanyName] = useState<string>("SKK TECHNOLOGIES PTE LTD");
  // Pull-to-refresh state (must be declared before any early returns)
  const [refreshing, setRefreshing] = useState(false);
  // Check if hours should be displayed (default to true if not set)
  const showHours = (user as any)?.enableHours !== false;

  // Missed clock-out alert state
  const [missedClockoutData, setMissedClockoutData] = useState<{
    clockingLineId: number;
    clockInDate: string;
    clockInTime: string;
    siteName?: string;
    projectName?: string;
  } | null>(null);
  const [showMissedClockoutAlert, setShowMissedClockoutAlert] = useState(false);
  const [isProcessingMissedClockout, setIsProcessingMissedClockout] = useState(false);
  // Status modal state for professional alerts
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalType, setStatusModalType] = useState<StatusType>('info');
  const [statusModalTitle, setStatusModalTitle] = useState('');
  const [statusModalMessage, setStatusModalMessage] = useState('');
  const [statusModalButtons, setStatusModalButtons] = useState<StatusModalButton[]>([
    { text: 'OK', onPress: () => setStatusModalVisible(false), style: 'primary' }
  ]);

  // Helper function to show StatusModal (replaces Alert.alert)
  const showAlert = (
    title: string,
    message: string,
    type: StatusType = 'info',
    buttons?: StatusModalButton[]
  ) => {
    setStatusModalTitle(title);
    setStatusModalMessage(message);
    setStatusModalType(type);
    setStatusModalButtons(buttons || [
      { text: 'OK', onPress: () => setStatusModalVisible(false), style: 'primary' }
    ]);
    setStatusModalVisible(true);
  };

  const lastActionRef = useRef<number>(0);
  const DEBOUNCE_MS = 1200;
  const shouldDebounce = () => {
    const now = Date.now();
    if (now - lastActionRef.current < DEBOUNCE_MS) return true;
    lastActionRef.current = now;
    return false;
  };

  // Allow user to change profile image
  const onChangeProfileImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission required', 'Please grant Photo Library permission to select a profile image.', 'warning');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const cc = (user as any)?.companyCode;
      const emp = (user as any)?.empNo || (user as any)?.employeeNo;
      if (!cc || !emp) return;
      // Send plain URI to backend to avoid storing large base64 in SecureStore
      const resp = await apiService.updateProfileImage(cc, emp, asset.uri);
      if (!resp?.success) {
        showAlert('Update failed', 'Could not update profile image. Please try again.', 'error');
        return;
      }
      // Optimistic local update: selected image shows immediately
      // The profile card reads user.profileImageUri; update via attendance refresh already happens elsewhere
      setUiMessage('');
      showAlert('Profile updated', 'Your profile image has been updated.', 'success');
      try { await refreshSession(); } catch { }
    } catch (e: any) {
      showAlert('Update failed', 'Could not update profile image.', 'error');
    }
  };
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAttendance();
      await refreshSession();

      // Also refresh face registration status
      const cc = (user as any)?.companyCode || (user as any)?.cmpcode;
      const emp = (user as any)?.empNo || (user as any)?.employeeNo;
      if (cc && emp) {
        try {
          const faceResult = await apiService.getFaceStatus(cc, emp);
          setFaceRegistered(!!faceResult?.data?.registered);
          console.log('🔄 Face status refreshed on pull-to-refresh:', !!faceResult?.data?.registered);
        } catch (e) {
          console.log('Error refreshing face status on refresh:', e);
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Load all initial data in parallel for faster page load
  useEffect(() => {
    const loadInitialData = async () => {
      const cc = (user as any)?.companyCode || (user as any)?.cmpcode;
      const emp = (user as any)?.empNo || (user as any)?.employeeNo;

      if (!cc || !emp) {
        setCompanyName("SKK TECHNOLOGIES PTE LTD");
        setFaceRegistered(null);
        return;
      }

      // Run all API calls in parallel for faster loading (including prefetch for site/project modal)
      const [settingsResult, companyResult, faceResult, sitesResult] = await Promise.allSettled([
        apiService.getClockMethodSettings(cc, emp),
        apiService.getCompanyInfo(cc),
        apiService.getFaceStatus(cc, emp),
        apiService.getSitesWithProjects(cc, emp), // Prefetch sites/projects filtered by employee assignment
      ]);

      // Process clock method settings
      if (settingsResult.status === 'fulfilled' && settingsResult.value?.data) {
        const flags = settingsResult.value.data as { allowFace?: boolean; allowButton?: boolean; sitePopup?: boolean };
        setAllowFace(typeof flags.allowFace === 'boolean' ? flags.allowFace : true);
        setAllowButton(typeof flags.allowButton === 'boolean' ? flags.allowButton : true);
        setRequireSitePopup(typeof flags.sitePopup === 'boolean' ? flags.sitePopup : false);
      } else {
        setAllowFace(true);
        setAllowButton(true);
        setRequireSitePopup(false);
      }

      // Process company name
      if (companyResult.status === 'fulfilled' && companyResult.value?.data?.companyName) {
        setCompanyName(companyResult.value.data.companyName);
      } else {
        setCompanyName("SKK TECHNOLOGIES PTE LTD");
      }

      // Process face status
      if (faceResult.status === 'fulfilled') {
        setFaceRegistered(!!faceResult.value?.data?.registered);
      } else {
        setFaceRegistered(null);
      }

      // Prefetch sites/projects - cache for instant modal display
      if (sitesResult.status === 'fulfilled' && sitesResult.value?.success && sitesResult.value?.data?.sites) {
        const cacheKey = `@face_rec_options:${cc}:${emp}`;
        const sites = sitesResult.value.data.sites.map(s => s.siteName).filter(Boolean);
        const siteProjectMap = sitesResult.value.data.siteProjectMap || {};
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            sites,
            siteProjectMap,
            ts: Date.now()
          }));
          console.log('✅ Prefetched and cached site/project data for instant modal display');
        } catch { }
      }

      // Check for missed clock-outs from previous days
      try {
        const missedResult = await apiService.checkMissedClockout(cc, emp);
        if (missedResult?.success && missedResult?.hasMissedClockout && missedResult?.data) {
          console.log('⚠️ Found missed clock-out from previous day:', missedResult.data);
          setMissedClockoutData(missedResult.data);
          setShowMissedClockoutAlert(true);
        }
      } catch (e) {
        console.log('Error checking missed clock-out:', e);
      }
    };

    loadInitialData();
  }, [(user as any)?.companyCode, (user as any)?.cmpcode, (user as any)?.empNo, (user as any)?.employeeNo]);

  // Refresh face registration status when screen comes into focus
  // This ensures the button updates dynamically if face_descriptor changes in DB
  useFocusEffect(
    useCallback(() => {
      const refreshFaceStatus = async () => {
        const cc = (user as any)?.companyCode || (user as any)?.cmpcode;
        const emp = (user as any)?.empNo || (user as any)?.employeeNo;
        if (!cc || !emp) return;

        try {
          const faceResult = await apiService.getFaceStatus(cc, emp);
          setFaceRegistered(!!faceResult?.data?.registered);
          console.log('🔄 Face status refreshed on focus:', !!faceResult?.data?.registered);
        } catch (e) {
          console.log('Error refreshing face status:', e);
        }
      };

      refreshFaceStatus();
    }, [(user as any)?.companyCode, (user as any)?.cmpcode, (user as any)?.empNo, (user as any)?.employeeNo])
  );

  // Ensure we have location permission before attempting clock actions
  const ensureLocation = async (): Promise<boolean> => {
    if (locationPermission === true) return true;
    const granted = await requestLocationPermission();
    if (!granted) {
      showAlert(
        'Location required',
        'Please grant Location permission and ensure Location Services are ON to clock in/out.',
        'warning',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { } },
          { text: 'Open Settings', style: 'primary', onPress: () => Linking.openSettings?.() },
        ]
      );
      return false;
    }
    return true;
  };

  // Hook must be called at top-level, not inside JSX
  const todayAttendance = getTodayAttendance();
  const clockInOpacity = useFade(todayAttendance?.clockIn?.timestamp);

  // Build a composite key with site and project to distinguish entries within same site
  const keyOf = (site?: string | null, project?: string | null) => `${(site || '').trim()}::${(project || '').trim()}`;

  // Prefer backend as source of truth for duplicate detection
  const TRUST_SERVER = true;

  // Reset per-site session state when the day changes
  useEffect(() => {
    setSessionSites({});
  }, [todayAttendance?.date]);

  // Seed per-site session state from today's entries so Face flow knows current IN/OUT
  useEffect(() => {
    const entries = (todayAttendance as any)?.entries;
    if (!Array.isArray(entries)) return;
    const seeded: Record<string, { in?: boolean; out?: boolean }> = {};
    for (const e of entries) {
      const key = keyOf(e?.siteName, e?.projectName);
      if (!key) continue;
      const hasIn = !!e?.clockIn?.timestamp;
      const hasOut = !!e?.clockOut?.timestamp;
      if (hasIn || hasOut) {
        seeded[key] = { in: hasIn || undefined, out: hasOut || undefined };
      }
    }
    if (Object.keys(seeded).length > 0) setSessionSites(seeded);
  }, [todayAttendance && (todayAttendance as any)?.entries]);

  const getInitials = () => {
    return (user?.name || 'E')
      .split(' ')
      .filter(Boolean)
      .map((s: string) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Helper: derive today's site/project from last clock-in
  const getTodayMeta = (): SiteProjectMeta | null => {
    const ci = todayAttendance?.clockIn;
    if (!ci) return null;
    const siteName = (ci as any)?.siteName || '';
    const projectName = (ci as any)?.projectName || '';
    if (!siteName && !projectName) return null;
    return { siteName, projectName };
  };

  const openSiteModal = (action: 'in' | 'out' | 'face' | 'select') => {
    if (isClocking || shouldDebounce()) return;
    setPendingAction(action);
    setSiteModalVisible(true);
  };

  const onSiteConfirm = async (meta: SiteProjectMeta) => {
    setSelectedMeta(meta);
    setSiteModalVisible(false);
    const siteKey = keyOf(meta.siteName, meta.projectName);
    if (!siteKey) {
      setUiMessage('Site required. Please enter at least a Site ID or Site Name.');
      return;
    }
    // If user is only changing selection, do not trigger any clock action
    if (pendingAction === 'select') {
      setUiMessage('');
      setPendingAction(null);
      return;
    }
    // Determine if there are no entries today (avoid false 'already clocked in')
    const today = getTodayAttendance();
    const noEntriesToday = !today || (
      (!Array.isArray((today as any)?.entries) || (today as any)?.entries?.length === 0) &&
      !(today as any)?.clockIn
    );

    const sess = sessionSites[siteKey] || {};

    if (!TRUST_SERVER && !noEntriesToday && pendingAction === 'in' && sess.in) {
      // Close camera before showing validation
      setShowCamera(false);
      setClockMethod(null);
      setFacePlannedAction(null);
      setUiMessage('You are already clocked in today at this site/project.');
      return;
    }
    if (pendingAction === 'out' && sess.out) {
      // Close camera before showing validation
      setShowCamera(false);
      setClockMethod(null);
      setFacePlannedAction(null);
      setUiMessage('You have clocked out for today at this site/project.');
      return;
    }
    if (pendingAction === 'face') {
      // Prevent unauthorized access: ensure face is registered
      try {
        const cc = (user as any)?.companyCode;
        const emp = (user as any)?.empNo;
        if (cc && emp) {
          const status = await apiService.getFaceStatus(cc, emp);
          console.log('📋 Face status:', status);
          const registered = !!status?.data?.registered;
          if (!registered) {
            showAlert(
              '📸 Face Enrollment Required',
              'Please enroll your face first to use Face Clock In/Out for clock in/out. This is a one-time registration.',
              'warning',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => { setPendingAction(null); } },
                {
                  text: 'Enroll Now', style: 'primary', onPress: async () => {
                    setPendingAction(null);
                    try {
                      const ready = await apiService.getFaceModelsReady();
                      if (ready?.ready) {
                        setShowRegisterCamera(true);
                      } else {
                        showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                      }
                    } catch {
                      showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                    }
                  }
                },
              ]
            );
            return;
          } else {
            console.log('✅ Face already enrolled. Proceeding with Clock In/Out...');
          }

          // Check clock status for this specific project
          console.log(`🔍 Checking clock status for project: ${meta.projectName}`);
          const clockStatus = await apiService.checkClockStatus(cc, emp, meta.projectName);
          console.log('⏰ Clock status:', clockStatus);

          if (clockStatus.success) {
            const planned: 'in' | 'out' = clockStatus.action === 'clock_in' ? 'in' : 'out';
            setFacePlannedAction(planned);

            if (clockStatus.isClockedIn && clockStatus.data) {
              console.log(`📍 Already clocked in at ${clockStatus.data.clockInTime} for ${clockStatus.data.siteName}`);
              console.log(`🔄 Will perform: Clock Out`);

              // Show user-friendly message before opening camera
              // Show user-friendly message before opening camera
              const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
              showAlert(
                '⏰ Clock Out',
                `EMP NO : ${empNo}\n\nYou are already clocked in at ${clockStatus.data.clockInTime}.\n\nScanning your face will clock you OUT.`,
                'clock-out',
                [
                  {
                    text: 'Cancel', style: 'cancel', onPress: () => {
                      setPendingAction(null);
                    }
                  },
                  {
                    text: 'Continue to Clock Out', style: 'primary', onPress: () => {
                      // Open camera for clock out (guard on face model readiness)
                      (async () => {
                        try {
                          const ready = await apiService.getFaceModelsReady();
                          if (!ready?.ready) {
                            showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                            return;
                          }
                          setClockMethod('face');
                          setShowCamera(true);
                          setUiMessage('');
                          setPendingAction(null);
                        } catch {
                          showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                        }
                      })();
                    }
                  }
                ]
              );
              return; // Don't open camera yet, wait for user confirmation
            } else {
              console.log(`🔄 Will perform: Clock In`);

              // Show user-friendly message before opening camera
              const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
              showAlert(
                '⏰ Clock In',
                `EMP NO : ${empNo}\n\nYou are not clocked in yet.\n\nScan your face to start your shift.`,
                'clock-in',
                [
                  {
                    text: 'Cancel', style: 'cancel', onPress: () => {
                      setPendingAction(null);
                    }
                  },
                  {
                    text: 'Continue to Clock In', style: 'primary', onPress: () => {
                      // Open camera for clock in (guard on face model readiness)
                      (async () => {
                        try {
                          const ready = await apiService.getFaceModelsReady();
                          if (!ready?.ready) {
                            showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                            return;
                          }
                          setClockMethod('face');
                          setShowCamera(true);
                          setUiMessage('');
                          setPendingAction(null);
                        } catch {
                          showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                        }
                      })();
                    }
                  }
                ]
              );
              return; // Don't open camera yet, wait for user confirmation
            }
          }
        }
      } catch (e) {
        console.error('❌ Error checking face/clock status:', e);
        // Fallback to old logic
        const alreadyInThisSite = !!sess.in && !sess.out;
        const globallyClockedIn = isClockedIn() && !isClockedOut();
        const planned: 'in' | 'out' = (alreadyInThisSite || (!siteKey && globallyClockedIn)) ? 'out' : 'in';
        setFacePlannedAction(planned);
      }

      // Only open camera if status check failed (fallback)
      setClockMethod('face');
      setShowCamera(true);
      setUiMessage('');
      setPendingAction(null);
      return;
    }
    if (pendingAction === 'in') {
      setUiMessage('');
      // Button method should not require camera; proceed directly
      setSelectedMeta(meta);
      await handleClockIn('button', undefined, meta);
    } else if (pendingAction === 'out') {
      setUiMessage('');
      // Button method should not require camera; proceed directly
      setSelectedMeta(meta);
      await handleClockOut('button', undefined, meta);
    }
    setPendingAction(null); // Clear pending action after handling
  };

  const handleClockIn = async (method: 'face' | 'button', imageUri?: string, meta?: SiteProjectMeta, faceTemplateBase64?: string) => {
    console.log('==================== UI handleClockIn START ====================');
    console.log('🖱️ [UI] handleClockIn called at:', new Date().toISOString());
    console.log('🖱️ [UI] Method:', method);
    console.log('🖱️ [UI] Meta:', JSON.stringify(meta));
    console.log('🖱️ [UI] User:', user?.empNo, '|', (user as any)?.companyCode);
    console.log('🖱️ [UI] isClocking:', isClocking);
    console.log('🖱️ [UI] facePlannedAction:', facePlannedAction);

    const debounced = method === 'button' ? shouldDebounce() : false;
    console.log('🖱️ [UI] Debounced:', debounced);

    if (isClocking || debounced) {
      console.log('⚠️ [UI] Blocked: isClocking or debounced');
      console.log('==================== UI handleClockIn END (BLOCKED) ====================');
      return;
    }
    // Determine if there are no entries today (avoid false 'already clocked in')
    const _today = getTodayAttendance();
    console.log('🖱️ [UI] Today attendance:', JSON.stringify(_today));
    const noEntriesToday = !_today || (
      (!Array.isArray((_today as any)?.entries) || (_today as any)?.entries?.length === 0) &&
      !(_today as any)?.clockIn
    );
    console.log('🖱️ [UI] noEntriesToday:', noEntriesToday);
    console.log('🖱️ [UI] isClockedIn():', isClockedIn());
    console.log('🖱️ [UI] isClockedOut():', isClockedOut());

    // For face method, skip local state validation since server already verified via checkClockStatus()
    if (method === 'face') {
      console.log('✅ [UI] Face method - trusting server-verified facePlannedAction, skipping local state checks');
    } else {
      // Button method: use local state validation (may have stale data but acceptable for button)
      // If the user has already completed both in and out today, prevent a new shift on the same day
      if (!noEntriesToday && isClockedIn() && isClockedOut()) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        setUiMessage('You have already completed today\'s attendance. Please try again tomorrow.');
        return;
      }
      // Global guard: prevent multiple clock-ins before clock-out
      if (!noEntriesToday && isClockedIn() && !isClockedOut()) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        setUiMessage('You are already clocked in today. Please clock out before clocking in again.');
        return;
      }
    }
    // Per-site validation: if same site already clocked-in this session, show message (button only)
    if (method === 'button' && meta) {
      const key = keyOf(meta.siteName, meta.projectName);
      const sess = key ? (sessionSites[key] || {}) : {};
      if (!noEntriesToday && sess.in) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        setUiMessage('You are already clocked in today at this site/project.');
        return;
      }
    }
    const ok = await ensureLocation();
    if (!ok) return;

    try {
      setClockMethod(method);
      setIsClocking(true);
      // Require face/photo only when using face method
      if (method === 'face') {
        if (!imageUri) {
          setShowCamera(false);
          setClockMethod(null);
          setFacePlannedAction(null);
          showAlert('Photo Required', 'Please capture your face to proceed.', 'warning');
          return;
        }
        const cc = (user as any)?.companyCode;
        const emp = (user as any)?.empNo;
        if (cc && emp) {
          const verify = await apiService.verifyFace(cc, emp, { imageUri, faceTemplateBase64 });
          if (!verify?.success) {
            setShowCamera(false);
            setClockMethod(null);
            setFacePlannedAction(null);
            const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
            showAlert('Clock In Failed', `EMP NO : ${empNo}\n\n${verify?.message || 'Your face could not be verified. Please try again.'}`, 'error');
            return;
          }
        }
      }
      try {
        // Use facePlannedAction to determine whether to clock in or out
        if (facePlannedAction === 'out') {
          console.log('🔄 Executing Clock Out based on facePlannedAction');
          await clockOut(method, imageUri, meta, faceTemplateBase64);
        } else {
          console.log('🔄 Executing Clock In based on facePlannedAction');
          await clockIn(method, imageUri, meta, faceTemplateBase64);
        }
      } catch (storeError) {
        // Re-throw to be handled by our outer catch block
        throw storeError;
      }
      if (meta) {
        const key = keyOf(meta.siteName, meta.projectName);
        if (key) setSessionSites((s) => ({ ...s, [key]: { ...(s[key] || {}), in: true } }));
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // SHOW SUCCESS ALERT
      const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
      if (facePlannedAction === 'out') {
        showAlert('Successfully Clocked Out', `EMP NO : ${empNo}\n\nYou have successfully clocked out.`, 'clock-out');
      } else {
        showAlert('Successfully Clocked In', `EMP NO : ${empNo}\n\nYou have successfully clocked in.`, 'clock-in');
      }
    } catch (error) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const rawMessage = (error instanceof Error ? error.message : String(error || ''));
      const message = rawMessage.toLowerCase();
      if (message.includes('permission')) {
        showAlert(
          'Location permission required',
          'Please grant Location permission to clock in. You can enable it in Settings.',
          'warning',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => { } },
            { text: 'Open Settings', style: 'primary', onPress: () => Linking.openSettings?.() },
          ]
        );
      } else if (message.includes('services')) {
        showAlert(
          'Location Services Off',
          'Turn on device Location Services (GPS/Wi‑Fi) and try again.',
          'warning'
        );
      } else if (
        message.includes('address unavailable') ||
        message.includes('gps unavailable') ||
        message.includes('location timeout')
      ) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        showAlert(
          'Address Required',
          'We couldn’t fetch a valid address for your current location. Please ensure you are online and try again near an identifiable place.',
          'error'
        );
      } else if (message.includes('not assigned') || message.includes('assign')) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        showAlert(
          'Not assigned to this site/project',
          'You are not assigned to this site/project for today. Please choose a valid assignment.',
          'warning',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => { } },
            { text: 'Choose Site/Project', style: 'primary', onPress: () => openSiteModal('select') },
          ]
        );
      } else if (message.includes('face does not match') || message.includes('face verification failed') || message.includes('no face detected') || message.includes('liveness check failed') || message.includes('unauthorized')) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);

        // SECURITY: Provide specific feedback based on error type
        let alertTitle = 'Face Verification Failed';
        let alertMessage = 'Your face could not be verified. Please try again.';

        if (message.includes('no face detected')) {
          alertTitle = 'No Face Detected';
          alertMessage = 'Please ensure your face is fully visible, well-lit, and centered in the camera frame.';
        } else if (message.includes('liveness check failed') || message.includes('liveness')) {
          alertTitle = 'Liveness Check Failed';
          alertMessage = 'Please use your real face for verification. Photos, videos, or masks are not allowed.';
        } else if (message.includes('unauthorized') || message.includes('does not match')) {
          alertTitle = (facePlannedAction === 'out') ? 'Clock Out Failed' : 'Clock In Failed';
          const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
          alertMessage = `EMP NO : ${empNo}\n\nThe face does not match the registered user. Please ensure you are using your own account.`;
        }

        showAlert(alertTitle, alertMessage, 'error');
      } else if (message.includes('already clocked in')) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        const siteProject = meta ? `${meta.siteName}${meta.projectName ? ' / ' + meta.projectName : ''}` : 'this location';
        showAlert(
          'Already Clocked In',
          `You have already clocked in at ${siteProject} today. Please clock out first or choose a different site/project.`,
          'info',
          [
            { text: 'OK', style: 'cancel', onPress: () => { } },
            { text: 'Choose Different Site', style: 'primary', onPress: () => openSiteModal('select') },
          ]
        );
      } else {
        // Show error for unexpected failures
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        showAlert(
          (facePlannedAction === 'out') ? 'Clock Out Failed' : 'Clock In Failed',
          rawMessage || 'An unexpected error occurred. Please try again.',
          'error'
        );
      }
    } finally {
      setIsClocking(false);
      setShowCamera(false);
      setClockMethod(null);
      setFacePlannedAction(null);
    }
  };

  const handleClockOut = async (method: 'face' | 'button', imageUri?: string, meta?: SiteProjectMeta, faceTemplateBase64?: string) => {
    console.log('==================== UI handleClockOut START ====================');
    console.log('🖱️ [UI] handleClockOut called at:', new Date().toISOString());
    console.log('🖱️ [UI] Method:', method);
    console.log('🖱️ [UI] Meta:', JSON.stringify(meta));
    console.log('🖱️ [UI] User:', user?.empNo, '|', (user as any)?.companyCode);
    console.log('🖱️ [UI] isClocking:', isClocking);
    console.log('🖱️ [UI] isClockedOut():', isClockedOut());

    if (isClocking || (method === 'button' && shouldDebounce())) {
      console.log('⚠️ [UI] Blocked: isClocking or debounced');
      console.log('==================== UI handleClockOut END (BLOCKED) ====================');
      return;
    }
    // Global guard: prevent multiple clock-outs (SKIP for face method - server already verified)
    // When using face method, the server's checkClockStatus() already determined the correct action
    // So we trust facePlannedAction instead of potentially stale local state
    if (method === 'button' && isClockedOut()) {
      console.log('⚠️ [UI] Blocked: Already clocked out today (button method)');
      // Close camera before showing validation
      setShowCamera(false);
      setClockMethod(null);
      setFacePlannedAction(null);
      setUiMessage('You have already clocked out today.');
      console.log('==================== UI handleClockOut END (BLOCKED) ====================');
      return;
    }
    if (method === 'face') {
      console.log('✅ [UI] Face method - trusting server-verified facePlannedAction, skipping local state check');
    }
    // Per-site validation (button only - face method already verified by server)
    if (method === 'button' && meta) {
      const key = keyOf(meta.siteName, meta.projectName);
      const sess = key ? (sessionSites[key] || {}) : {};
      if (!sess.in) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        setUiMessage('Please clock in at this site/project before clocking out.');
        return;
      }
      if (sess.out) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        setUiMessage('You have clocked out for today at this site/project.');
        return;
      }
    }
    const ok = await ensureLocation();
    if (!ok) return;

    try {
      setClockMethod(method);
      setIsClocking(true);
      // Require face/photo only when using face method
      if (method === 'face') {
        if (!imageUri) {
          setShowCamera(false);
          setClockMethod(null);
          setFacePlannedAction(null);
          showAlert('Photo Required', 'Please capture your face to proceed.', 'warning');
          return;
        }
        const cc = (user as any)?.companyCode;
        const emp = (user as any)?.empNo;
        if (cc && emp) {
          const verify = await apiService.verifyFace(cc, emp, { imageUri, faceTemplateBase64 });
          if (!verify?.success) {
            setShowCamera(false);
            setClockMethod(null);
            setFacePlannedAction(null);
            const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
            showAlert('Clock Out Failed', `EMP NO : ${empNo}\n\n${verify?.message || 'Your face could not be verified. Please try again.'}`, 'error');
            return;
          }
        }
      }
      try {
        // Pass the face template so the server's clock-out verification (second check)
        // receives the same payload as the pre-check above. Without this, strict mode fails.
        await clockOut(method, imageUri, meta, faceTemplateBase64);
      } catch (storeError) {
        // Re-throw to be handled by our outer catch block
        throw storeError;
      }
      if (meta) {
        const key = keyOf(meta.siteName, meta.projectName);
        if (key) setSessionSites((s) => ({ ...s, [key]: { ...(s[key] || {}), out: true } }));
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // SHOW SUCCESS ALERT
      const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
      showAlert('Successfully Clocked Out', `EMP NO : ${empNo}\n\nYou have successfully clocked out.`, 'clock-out');
    } catch (error) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const rawMessage = (error instanceof Error ? error.message : String(error || ''));
      const message = rawMessage.toLowerCase();
      if (message.includes('permission')) {
        showAlert(
          'Location permission required',
          'Please grant Location permission to clock out. You can enable it in Settings.',
          'warning',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => { } },
            { text: 'Open Settings', style: 'primary', onPress: () => Linking.openSettings?.() },
          ]
        );
      } else if (message.includes('services')) {
        showAlert(
          'Location Services Off',
          'Turn on device Location Services (GPS/Wi‑Fi) and try again.',
          'warning'
        );
      } else if (
        message.includes('address unavailable') ||
        message.includes('gps unavailable') ||
        message.includes('location timeout')
      ) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        showAlert(
          'Address Required',
          'We couldn’t fetch a valid address for your current location. Please ensure you are online and try again near an identifiable place.',
          'error'
        );
      } else if (message.includes('not assigned') || message.includes('assign')) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        showAlert(
          'Not assigned to this site/project',
          'You are not assigned to this site/project for today. Please choose a valid assignment.',
          'warning',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => { } },
            { text: 'Choose Site/Project', style: 'primary', onPress: () => openSiteModal('select') },
          ]
        );
      } else if (message.includes('face does not match') || message.includes('face verification failed') || message.includes('no face detected') || message.includes('liveness check failed') || message.includes('unauthorized')) {
        // Close camera before showing validation
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);

        // SECURITY: Provide specific feedback based on error type
        let alertTitle = 'Face Verification Failed';
        let alertMessage = 'Your face could not be verified. Please try again.';

        if (message.includes('no face detected')) {
          alertTitle = 'No Face Detected';
          alertMessage = 'Please ensure your face is fully visible, well-lit, and centered in the camera frame.';
        } else if (message.includes('liveness check failed') || message.includes('liveness')) {
          alertTitle = 'Liveness Check Failed';
          alertMessage = 'Please use your real face for verification. Photos, videos, or masks are not allowed.';
        } else if (message.includes('unauthorized') || message.includes('does not match')) {
          alertTitle = 'Clock Out Failed';
          const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
          alertMessage = `EMP NO : ${empNo}\n\nThe face does not match the registered user. Please ensure you are using your own account.`;
        }

        showAlert(alertTitle, alertMessage, 'error');
      } else {
        // Show error for unexpected failures
        setShowCamera(false);
        setClockMethod(null);
        setFacePlannedAction(null);
        showAlert(
          'Clock Out Failed',
          rawMessage || 'An unexpected error occurred. Please try again.',
          'error'
        );
      }
    } finally {
      setIsClocking(false);
      setShowCamera(false);
      setClockMethod(null);
      setFacePlannedAction(null);
    }
  };

  const startFaceRecognition = async () => {
    // Note: do NOT call shouldDebounce() here, openSiteModal() handles it to avoid double-debounce
    if (isClocking) return;

    // Only show site modal when requireSitePopup is true (controlled by x_site_popup in database)
    if (requireSitePopup) {
      openSiteModal('face');
    } else {
      // When site popup is disabled, proceed directly to face clock in/out
      // Use the current selected meta if available, or empty meta
      const meta = selectedMeta || { siteName: '', projectName: '' };

      try {
        const cc = (user as any)?.companyCode;
        const emp = (user as any)?.empNo;
        if (cc && emp) {
          // Check if face is registered
          const status = await apiService.getFaceStatus(cc, emp);
          const registered = !!status?.data?.registered;
          if (!registered) {
            showAlert(
              '📸 Face Enrollment Required',
              'Please enroll your face first to use Face Clock In/Out. This is a one-time registration.',
              'warning',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                  text: 'Enroll Now', style: 'primary', onPress: async () => {
                    try {
                      const ready = await apiService.getFaceModelsReady();
                      if (ready?.ready) {
                        setShowRegisterCamera(true);
                      } else {
                        showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                      }
                    } catch {
                      showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                    }
                  }
                },
              ]
            );
            return;
          }

          // Check clock status to determine if we should clock in or out
          const clockStatus = await apiService.checkClockStatus(cc, emp, meta.projectName);
          const planned: 'in' | 'out' = clockStatus.action === 'clock_in' ? 'in' : 'out';
          setFacePlannedAction(planned);
          setSelectedMeta(meta);

          if (clockStatus.isClockedIn && clockStatus.data) {
            showAlert(
              '⏰ Clock Out',
              `You are already clocked in at ${clockStatus.data.clockInTime}.\n\nScanning your face will clock you OUT.`,
              'clock-out',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                  text: 'Continue to Clock Out', style: 'primary', onPress: async () => {
                    try {
                      const ready = await apiService.getFaceModelsReady();
                      if (!ready?.ready) {
                        showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                        return;
                      }
                      setClockMethod('face');
                      setShowCamera(true);
                      setUiMessage('');
                    } catch {
                      showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                    }
                  }
                }
              ]
            );
          } else {
            showAlert(
              '⏰ Clock In',
              `You are not clocked in yet.\n\nScan your face to start your shift.`,
              'clock-in',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                  text: 'Continue to Clock In', style: 'primary', onPress: async () => {
                    try {
                      const ready = await apiService.getFaceModelsReady();
                      if (!ready?.ready) {
                        showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                        return;
                      }
                      setClockMethod('face');
                      setShowCamera(true);
                      setUiMessage('');
                    } catch {
                      showAlert('Please Wait', 'Face models are initializing. Please retry in a few seconds.', 'info');
                    }
                  }
                }
              ]
            );
          }
        }
      } catch (e) {
        console.error('❌ Error in startFaceRecognition (no popup mode):', e);
        // Fallback: just open camera with current state
        const globallyClockedIn = isClockedIn() && !isClockedOut();
        setFacePlannedAction(globallyClockedIn ? 'out' : 'in');
        setSelectedMeta(meta);
        setClockMethod('face');
        setShowCamera(true);
        setUiMessage('');
      }
    }
  };


  const handleCameraCapture = (image: { uri: string; base64?: string }) => {
    if ((clockMethod === 'face' || clockMethod === 'button') && !isClocking) {
      const meta = selectedMeta || undefined;
      const imageUri = image?.uri;
      if (!imageUri) return;

      // Convert base64 to data URI format if available
      const faceTemplateBase64 = image.base64
        ? `data:image/jpeg;base64,${image.base64}`
        : undefined;

      // Prefer the planned action determined at site selection
      if (facePlannedAction === 'out') {
        handleClockOut(clockMethod === 'face' ? 'face' : 'button', imageUri, meta, faceTemplateBase64);
        return;
      }
      if (facePlannedAction === 'in') {
        handleClockIn(clockMethod === 'face' ? 'face' : 'button', imageUri, meta, faceTemplateBase64);
        return;
      }
      // Fallback: compute from seeded session state and global status
      const key = keyOf(meta?.siteName, meta?.projectName);
      const sess = key ? (sessionSites[key] || {}) : {};
      const alreadyInThisSite = !!sess.in && !sess.out;
      const globallyClockedIn = isClockedIn() && !isClockedOut();
      if (alreadyInThisSite || (!key && globallyClockedIn)) {
        handleClockOut(clockMethod === 'face' ? 'face' : 'button', imageUri, meta, faceTemplateBase64);
      } else {
        handleClockIn(clockMethod === 'face' ? 'face' : 'button', imageUri, meta, faceTemplateBase64);
      }
    }
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
    setClockMethod(null);
    setFacePlannedAction(null);
  };

  if (showCamera) {
    const handleLivenessClockAction = async (imageUri: string, action: 'in' | 'out') => {
      const meta = selectedMeta || undefined;
      if (action === 'out') {
        await handleClockOut('face', imageUri, meta);
      } else {
        await handleClockIn('face', imageUri, meta);
      }
    };

    return (
      <>
        <FastFacialClocking
          intendedAction={facePlannedAction || 'in'}
          onClockAction={handleLivenessClockAction}
          onCancel={handleCameraCancel}
          onShowAlert={showAlert}
        />
        <StatusModal
          visible={statusModalVisible}
          type={statusModalType}
          title={statusModalTitle}
          message={statusModalMessage}
          buttons={statusModalButtons}
          onClose={() => setStatusModalVisible(false)}
        />
      </>
    );
  }

  // Face registration camera
  if (showRegisterCamera) {
    const handleRegisterCancel = () => {
      setShowRegisterCamera(false);
    };
    const handleLivenessRegister = async (imageUri: string) => {
      const cc = (user as any)?.companyCode;
      const emp = (user as any)?.empNo;
      if (!cc || !emp) { setShowRegisterCamera(false); return; }
      try {
        const res = await apiService.registerFace(cc, emp, { imageUri });
        if (res?.success) {
          setFaceRegistered(true);
          showAlert('Face Registered', 'Your face has been registered successfully. You can now use Face Clock In/Out.', 'success');
        } else {
          showAlert('Registration Failed', res?.message || 'Please try again.', 'error');
        }
      } catch (e: any) {
        showAlert('Registration Failed', (e?.message as string) || 'Please try again.', 'error');
      } finally {
        setShowRegisterCamera(false);
      }
    };

    return (
      <>
        <FastFacialClocking
          intendedAction="in"
          onClockAction={handleLivenessRegister}
          onCancel={handleRegisterCancel}
          mode="register"
          onShowAlert={showAlert}
        />
        <StatusModal
          visible={statusModalVisible}
          type={statusModalType}
          title={statusModalTitle}
          message={statusModalMessage}
          buttons={statusModalButtons}
          onClose={() => setStatusModalVisible(false)}
        />
      </>
    );
  }

  // Handler for missed clock-out from previous day
  const handleMissedClockout = async () => {
    if (!missedClockoutData) return;

    const cc = (user as any)?.companyCode || (user as any)?.cmpcode;
    const emp = (user as any)?.empNo || (user as any)?.employeeNo;

    if (!cc || !emp) {
      showAlert('Error', 'Unable to identify user. Please log in again.', 'error');
      return;
    }

    setIsProcessingMissedClockout(true);

    try {
      // Call clock-out API directly with isImproperClocking flag
      const result = await apiService.clockOut(
        emp,
        cc,
        { latitude: 0, longitude: 0, address: 'Late clock-out (previous day)' },
        'button',
        { siteName: missedClockoutData.siteName, projectName: missedClockoutData.projectName },
        undefined, // imageUri
        undefined, // faceTemplateBase64
        true // isImproperClocking
      );

      if (!result?.success) {
        throw new Error((result as any)?.message || 'Clock out failed');
      }

      setShowMissedClockoutAlert(false);
      setMissedClockoutData(null);

      // Refresh attendance data
      await refreshAttendance();

      const currentEmpNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
      showAlert(
        'Clock Out Completed',
        `EMP NO : ${currentEmpNo}\n\nYou have been clocked out for ${missedClockoutData.clockInDate}. This has been marked as "Improper Clocking" in your history.`,
        'success'
      );
    } catch (e: any) {
      showAlert('Clock Out Failed', e?.message || 'Please try again.', 'error');
    } finally {
      setIsProcessingMissedClockout(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <CustomLoader size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
        </View>
        {/* Clock In/Out section moved to the top */}
        <View style={styles.clockSection}>


          {!locationPermission && (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>
                Location permission is required for attendance tracking.
              </Text>
              <TouchableOpacity style={[styles.methodButton, styles.faceButton, { marginTop: 12 }]} onPress={requestLocationPermission}>
                <Text style={styles.methodButtonText}>Grant Location Permission</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.methodSection}>


            {!!selectedMeta && (
              <View style={[styles.chipsRow, { alignItems: 'center', justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', gap: 8, flexShrink: 1 }}>
                  {!!selectedMeta.siteName && (
                    <Text style={styles.chip}>{selectedMeta.siteName}</Text>
                  )}
                  {!!selectedMeta.projectName && (
                    <Text style={styles.chipAlt}>{selectedMeta.projectName}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => openSiteModal('select')}>
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Change Site/Project</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.methodButtons}>
              {(!allowFace && !allowButton) && (
                <View style={styles.warningCard}>
                  <Text style={styles.warningText}>
                    No clocking methods are enabled for your account. Please contact your administrator.
                  </Text>
                </View>
              )}
              {allowFace && (
                <TouchableOpacity
                  style={[styles.methodButton, styles.faceButton]}
                  onPress={async () => {
                    if (isClocking) return;
                    if (faceRegistered !== true) {
                      try {
                        const ready = await apiService.getFaceModelsReady();
                        if (ready?.ready) {
                          setShowRegisterCamera(true);
                        } else {
                          showAlert('', '', 'info');
                        }
                      } catch {
                        showAlert('', '', 'info');
                      }
                    } else {
                      startFaceRecognition();
                    }
                  }}
                  disabled={isClocking}
                >
                  <Camera size={20} color={colors.primary} />
                  <Text style={styles.methodButtonText}>{faceRegistered === true ? 'Clock In/Out' : 'Register Face'}</Text>
                </TouchableOpacity>
              )}

              {/* Helper text below the button */}
              <Text style={styles.clockHelpText}>Please clock in or out to record your attendance</Text>

              {/* Clock In/Out buttons removed as per user request - only Face Recognition is used */}

              {/* Inline state messages */}
              {isClocking ? (
                <Text style={styles.disabledHint}>Processing your request...</Text>
              ) : !!uiMessage ? (
                <View>
                  <Text style={styles.disabledHint}>{uiMessage}</Text>
                </View>
              ) : (!allowFace && !allowButton) ? (
                <Text style={styles.disabledHint}>Clocking methods are disabled by your organization. Please contact your administrator.</Text>
              ) : null}
            </View>

            {/* Name Card Section - Removed from here */}
          </View>
        </View>

        {/* Main card with profile and today's events */}
        <View style={styles.card}>
          {/* Profile Section (New Design) */}
          <View style={styles.profileSectionNew}>

            <TouchableOpacity style={styles.profileHeaderNew} onPress={() => setProfileActionVisible(true)} activeOpacity={0.7}>
              <View style={styles.largeAvatar}>
                {user?.profileImageUri ? (
                  <Image source={{ uri: user.profileImageUri }} style={styles.largeAvatarImg} contentFit="cover" />
                ) : (
                  <Text style={styles.largeAvatarText}>{getInitials()}</Text>
                )}
              </View>
              <View style={styles.profileInfoNew}>
                <View style={styles.nameBadgeRow}>
                  <Text style={styles.profileNameNew} numberOfLines={1}>{user?.name || 'Employee'}</Text>
                  {(user as any)?.companyCode && (
                    <View style={styles.companyCodeBadge}>
                      <Text style={styles.companyCodeText}>{(user as any)?.companyCode}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.profileRoleNew}>Employee</Text>
                <Text style={styles.profileEmpNoNew}>
                  <Text style={{ fontWeight: '400' }}>Emp No: </Text>
                  {(user as any)?.empNo || (user as any)?.employeeNo || '--'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.separator} />

            {/* Status Box */}
            <View style={styles.statusBox}>
              <Text style={styles.statusBoxLabel}>Status</Text>
              <Text style={[styles.statusBoxValue, isClockedIn() && !isClockedOut() ? styles.textSuccess : isClockedOut() ? styles.textNeutral : styles.textWarn]}>
                {isClockedIn() ? (isClockedOut() ? 'Clocked Out' : 'Clocked In') : 'Not Clocked In'}
              </Text>
            </View>
          </View>

          {/* Today's per-site entries (compact) */}
          {Array.isArray((todayAttendance as any)?.entries) && (todayAttendance as any).entries.length > 0 && (
            <View style={styles.todaysSitesSection}>
              <Text style={styles.todaysSitesTitle}>Today's Sites</Text>
              {(todayAttendance as any).entries.map((e: any, idx: number) => {
                // Skip rendering the default tile when both site and project are empty
                if (!(e?.siteName) && !(e?.projectName)) {
                  return null;
                }
                const isSelected = !!selectedMeta && (selectedMeta.siteName || '') === (e.siteName || '') && (selectedMeta.projectName || '') === (e.projectName || '');
                const address = (e.clockIn?.location?.address || e.clockOut?.location?.address) as string | undefined;
                const statusText = e.clockIn && !e.clockOut ? 'In Progress' : e.clockOut ? 'Completed' : 'Not Started';
                const title = `${e.siteName || ''}${e.siteName && e.projectName ? ' · ' : ''}${e.projectName || ''}`;
                return (
                  <TouchableOpacity
                    key={`clock-entry-${idx}-${e.siteName || 'default'}-${e.projectName || 'default'}`}
                    activeOpacity={0.8}
                    onPress={() => setSelectedMeta({ siteName: e.siteName || '', projectName: e.projectName || '' })}
                    style={[
                      styles.entryCard,
                      isSelected ? styles.entryCardSelected : styles.entryCardDefault,
                    ]}
                  >
                    <View style={styles.entryHeaderRow}>
                      <Text style={styles.entryTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.entryStatus}>{statusText}</Text>
                    </View>
                    <View style={styles.entryTimesRow}>
                      <View style={styles.timeColLeft}>
                        <Text style={styles.timeLabel}>In</Text>
                        <Text style={styles.timeValue}>{safeFormatTime(e.clockIn?.timestamp)}</Text>
                      </View>
                      <View style={styles.timeDivider} />
                      <View style={styles.timeColRight}>
                        <Text style={[styles.timeLabel, styles.alignRight]}>Out</Text>
                        <Text style={[styles.timeValue, styles.alignRight]}>{safeFormatTime(e.clockOut?.timestamp)}</Text>
                      </View>
                    </View>
                    {!!address && (
                      <View style={styles.locationRowCompact}>
                        <MapPin size={12} color={colors.textSecondary} />
                        <Text style={styles.locationTextCompact} numberOfLines={1}>{address}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Clock In card */}
          <Animated.View style={[styles.eventCard, { opacity: clockInOpacity }]}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>Clock In</Text>
              {todayAttendance?.clockIn?.method && (
                <View style={[styles.methodBadge, todayAttendance.clockIn.method === 'face' ? styles.methodFace : styles.methodButtonBadge, styles.methodBadgeRow]}>
                  {todayAttendance.clockIn.method === 'face' ? (
                    <Camera size={14} color={'#0AA0FF'} />
                  ) : (
                    <Clock size={14} color={'#7A5AF8'} />
                  )}
                  <Text style={styles.methodBadgeText}>{todayAttendance.clockIn.method === 'face' ? 'Face' : 'Button'}</Text>
                </View>
              )}
            </View>
            <View style={styles.timeRowWithThumb}>
              <Text style={styles.eventTime}>{safeFormatTime(todayAttendance?.clockIn?.timestamp)}</Text>
              {!!todayAttendance?.clockIn?.imageUri && (
                <TouchableOpacity
                  onPress={() => setViewer({ uri: (todayAttendance as any).clockIn.imageUri, timestamp: todayAttendance?.clockIn?.timestamp, title: 'Clock In', location: todayAttendance?.clockIn?.location?.address || undefined })}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="View clock-in photo"
                  style={styles.thumbWrap}
                >
                  <Image source={{ uri: (todayAttendance as any).clockIn.imageUri }} style={styles.thumb} contentFit="cover" />
                </TouchableOpacity>
              )}
            </View>
            {((todayAttendance?.clockIn as any)?.siteName || (todayAttendance?.clockIn as any)?.projectName) && (
              <View style={styles.chipsRow}>
                {!!(todayAttendance as any)?.clockIn?.siteName && (
                  <Text style={styles.chip}>{(todayAttendance as any).clockIn.siteName}</Text>
                )}
                {!!(todayAttendance as any)?.clockIn?.projectName && (
                  <Text style={styles.chipAlt}>{(todayAttendance as any).clockIn.projectName}</Text>
                )}
              </View>
            )}
            {todayAttendance?.clockIn?.location && (
              <View style={styles.locationRow}>
                <MapPin size={14} color={colors.textSecondary} />
                <Text style={styles.locationText}>
                  {todayAttendance.clockIn.location.address || 'Location captured'}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Clock Out card */}
          <View style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>Clock Out</Text>
              {todayAttendance?.clockOut?.method && (
                <View style={[styles.methodBadge, todayAttendance.clockOut.method === 'face' ? styles.methodFace : styles.methodButtonBadge, styles.methodBadgeRow]}>
                  {todayAttendance.clockOut.method === 'face' ? (
                    <Camera size={14} color={'#0AA0FF'} />
                  ) : (
                    <Clock size={14} color={'#7A5AF8'} />
                  )}
                  <Text style={styles.methodBadgeText}>{todayAttendance.clockOut.method === 'face' ? 'Face' : 'Button'}</Text>
                </View>
              )}
            </View>
            <View style={styles.timeRowWithThumb}>
              <Text style={styles.eventTime}>{safeFormatTime(todayAttendance?.clockOut?.timestamp)}</Text>
              {!!todayAttendance?.clockOut?.imageUri && (
                <TouchableOpacity
                  onPress={() => setViewer({ uri: (todayAttendance as any).clockOut.imageUri, timestamp: todayAttendance?.clockOut?.timestamp, title: 'Clock Out', location: todayAttendance?.clockOut?.location?.address || undefined })}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="View clock-out photo"
                  style={styles.thumbWrap}
                >
                  <Image source={{ uri: (todayAttendance as any).clockOut.imageUri }} style={styles.thumb} contentFit="cover" />
                </TouchableOpacity>
              )}
            </View>
            {((todayAttendance?.clockOut as any)?.siteName || (todayAttendance?.clockOut as any)?.projectName) && (
              <View style={styles.chipsRow}>
                {!!(todayAttendance as any)?.clockOut?.siteName && (
                  <Text style={styles.chip}>{(todayAttendance as any).clockOut.siteName}</Text>
                )}
                {!!(todayAttendance as any)?.clockOut?.projectName && (
                  <Text style={styles.chipAlt}>{(todayAttendance as any).clockOut.projectName}</Text>
                )}
              </View>
            )}
            {todayAttendance?.clockOut?.location && (
              <View style={styles.locationRow}>
                <MapPin size={14} color={colors.textSecondary} />
                <Text style={styles.locationText}>
                  {todayAttendance.clockOut.location.address || 'Location captured'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Your attendance is being tracked with accurate location data.
            {Platform.OS !== 'web' ? ' Clock In/Out provides secure verification.' : ''}
          </Text>
        </View>
      </ScrollView >
      {/* Fullscreen image viewer */}
      < Modal
        visible={!!viewer
        }
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setViewer(null)}>
          <View style={styles.modalContent}>
            {!!viewer?.uri && (
              <Image source={{ uri: viewer.uri }} style={styles.modalImage} contentFit="contain" />
            )}
            {!!viewer && (
              <View style={styles.modalOverlayBar}>
                <Text style={styles.modalOverlayText}>
                  {viewer.title} • {viewer.timestamp ? format(new Date(viewer.timestamp), 'EEE, MMM d yyyy, h:mm a') : ''}
                </Text>
                {!!viewer.location && (
                  <Text style={styles.modalOverlaySubText} numberOfLines={2}>
                    {viewer.location}
                  </Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal >

      <SiteProjectModal
        visible={siteModalVisible}
        onClose={() => setSiteModalVisible(false)}
        onConfirm={onSiteConfirm}
        initial={selectedMeta || undefined}
      />

      <ActionModal
        visible={profileActionVisible}
        onClose={() => setProfileActionVisible(false)}
        title="Profile Photo"
        options={[
          {
            label: 'View Profile',
            onPress: () => {
              if ((user as any)?.profileImageUri) {
                setViewer({
                  uri: (user as any).profileImageUri,
                  title: user?.name || 'Profile Photo',
                  timestamp: Date.now()
                });
              } else {
                showAlert('No Photo', 'You haven\'t set a profile photo yet.', 'info');
              }
            }
          },
          {
            label: 'Update Profile',
            variant: 'primary',
            onPress: onChangeProfileImage
          }
        ]}
      />

      {/* Missed Clock-out Alert Modal - Mandatory, user must clock out to proceed */}
      <Modal
        visible={showMissedClockoutAlert && !!missedClockoutData}
        transparent
        animationType="fade"
        onRequestClose={() => { }} // Prevent back button from closing
      >
        <View style={styles.modalBackdrop}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 24,
            marginHorizontal: 24,
            maxWidth: 400,
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8,
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#dc2626',
              textAlign: 'center',
              marginBottom: 12,
            }}>⚠️ Missed Clock-Out</Text>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.text,
              textAlign: 'center',
              marginBottom: 4,
            }}>
              EMP NO : {(user as any)?.empNo || (user as any)?.employeeNo || 'N/A'}
            </Text>
            <Text style={{
              fontSize: 15,
              color: colors.text,
              textAlign: 'center',
              marginBottom: 8,
            }}>
              You forgot to clock out on:
            </Text>
            <Text style={{
              fontSize: 17,
              fontWeight: '600',
              color: colors.primary,
              textAlign: 'center',
              marginBottom: 4,
            }}>
              {missedClockoutData?.clockInDate ? format(new Date(missedClockoutData.clockInDate), 'EEE, MMM d, yyyy') : ''}
            </Text>
            <Text style={{
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: 'center',
              marginBottom: 16,
            }}>
              Clock In: {missedClockoutData?.clockInTime}
              {missedClockoutData?.siteName ? ` at ${missedClockoutData.siteName}` : ''}
            </Text>
            <Text style={{
              fontSize: 13,
              color: colors.textSecondary,
              textAlign: 'center',
              marginBottom: 20,
              fontStyle: 'italic',
            }}>
              You must clock out before you can continue using the app. This will be marked as "Improper Clocking" in your history.
            </Text>
            <TouchableOpacity
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: colors.primary,
                alignItems: 'center',
              }}
              onPress={handleMissedClockout}
              disabled={isProcessingMissedClockout}
            >
              {isProcessingMissedClockout ? (
                <CustomLoader size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Clock Out Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Modal for professional alerts */}
      <StatusModal
        visible={statusModalVisible}
        type={statusModalType}
        title={statusModalTitle}
        message={statusModalMessage}
        buttons={statusModalButtons}
        onClose={() => setStatusModalVisible(false)}
      />
    </>
  );
}

// Keep all your existing styles - they remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  date: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Today's Sites
  todaysSitesSection: {
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  todaysSitesTitle: {
    fontSize: 16,
    marginBottom: 4,
    fontWeight: '700',
    color: colors.text,
  },
  entryCard: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  entryCardDefault: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  entryCardSelected: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  entryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryTitle: {
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
    paddingRight: 8,
  },
  entryStatus: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  entryTimesRow: {
    flexDirection: 'row',
    marginTop: 6,
    alignItems: 'center',
  },
  timeColLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  timeColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  timeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  alignRight: {
    textAlign: 'right',
  },
  timeDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 8,
    alignSelf: 'stretch',
  },
  locationRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  locationTextCompact: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.border,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  profileInfo: {
    marginLeft: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  role: {
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  statusSection: {
    gap: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    marginRight: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  clockSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  warningCard: {
    backgroundColor: colors.warning + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  warningText: {
    color: colors.text,
    fontSize: 14,
  },
  methodSection: {
    gap: 16,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  methodButtons: {
    gap: 16,
    alignItems: 'center',
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    width: '100%',
    gap: 8,
  },
  faceButton: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  methodButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  orText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  clockButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  disabledHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  clockHelpText: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  infoSection: {
    padding: 16,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Added styles
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaValue: {
    color: colors.text,
    fontWeight: '600',
  },
  subtleText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 12,
    marginLeft: 6,
  },
  // Redesign additions
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  badgeSuccess: {
    color: '#0A7',
  },
  badgeNeutral: {
    color: colors.textSecondary,
  },
  badgeWarn: {
    color: '#D9822B',
  },
  badgeInfo: {
    color: colors.primary,
  },
  eventCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  eventTime: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 4,
  },
  timeRowWithThumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thumbWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginLeft: 8,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalOverlayBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalOverlayText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlaySubText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },
  chipAlt: {
    backgroundColor: '#EEF1F5',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  methodBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    color: colors.text,
  },
  methodBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  methodFace: {
    backgroundColor: '#E8F7FF',
    color: '#0AA0FF',
    borderWidth: 1,
    borderColor: '#0AA0FF',
  },
  methodButtonBadge: {
    backgroundColor: '#F6F2FF',
    color: '#7A5AF8',
    borderWidth: 1,
    borderColor: '#7A5AF8',
  },
  // Name Card Styles
  nameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  nameCardInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  nameCardContent: {
    flex: 1,
  },
  nameCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  nameCardId: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Redesigned Profile & Status
  companyNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  profileSectionNew: {
    marginBottom: 16,
  },
  profileHeaderNew: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  largeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F2FF', // Light blueish/purple bg
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  largeAvatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  largeAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6', // Blue text
  },
  profileInfoNew: {
    flex: 1,
    justifyContent: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  profileNameNew: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginRight: 8,
  },
  companyCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#fff',
  },
  companyCodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  profileRoleNew: {
    fontSize: 14,
    color: '#94A3B8', // Grey
    marginBottom: 2,
  },
  profileEmpNoNew: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
    marginTop: 8,
  },
  // Status Box Styles
  statusBox: {
    backgroundColor: '#F8FAFC', // Light shaded background
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    // shadow logic if needed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusBoxLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  statusBoxValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 0,
  },
  textSuccess: {
    color: '#10B981', // Green
  },
  textNeutral: {
    color: '#64748B', // Grey
  },
  textWarn: {
    color: '#F59E0B', // Orange
  },
});
