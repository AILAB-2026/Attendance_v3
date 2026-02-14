import { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiService, LoginCredentials, LoginResponse, ApiError } from '@/lib/api';
import { secureStorage, UserData } from '@/lib/secure-storage';
// Demo mode removed: always use backend
import type { User } from '@/types/attendance';

// Conditional import for expo-device
import * as Device from 'expo-device';

interface AuthContextType {
  user: (UserData & Partial<User>) | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const [AuthProvider, useAuth] = createContextHook<AuthContextType>(() => {
  const [user, setUser] = useState<(UserData & Partial<User>) | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get device info for session tracking
  const getDeviceInfo = () => ({
    deviceId: Constants.sessionId || 'unknown',
    platform: Platform.OS,
    version: Platform.Version?.toString() || 'unknown',
    deviceName: Device?.deviceName || 'unknown',
  });

  const clearAuthState = useCallback(async () => {
    try {
      await secureStorage.clearAll();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error: unknown) {
      if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
        console.error('Error clearing auth state:', error);
      }
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const userData = await secureStorage.getUserData();
      if (!userData) {
        throw new Error('No user data available');
      }
      // Fetch latest profile (balances)
      if ((userData as any).companyCode && (userData as any).empNo) {
        const prof = await apiService.getUserProfile((userData as any).companyCode, (userData as any).empNo);
        const merged = { ...userData, ...(prof?.data || {}) } as any;
        await secureStorage.storeUserData(merged);
        setUser(merged);
      } else {
        setUser(userData);
      }
      setIsAuthenticated(true);
    } catch (error: unknown) {
      if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
        console.error('Session refresh error:', error);
      }
      await clearAuthState();
    }
  }, [clearAuthState]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Check for user data in secure storage
        const userData = await secureStorage.getUserData();
        if (isMounted) {
          if (userData) {
            // Verify session by refreshing profile; if invalid, clear
            try {
              await refreshSession();
            } catch {
              await clearAuthState();
            }
          }
          setIsLoading(false);
        }
      } catch (e) {
        // If there's an error, we'll default to an unauthenticated state
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to initialize auth:', e);
        }
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);

      // Normalize inputs then call the API validation endpoint
      const normalizedCompanyCode = String(credentials.companyCode ?? '').trim().toUpperCase();
      const normalizedEmployeeNoInput = String(credentials.employeeNo ?? '').trim();
      const response = await apiService.validateEmployee({
        companyCode: normalizedCompanyCode,
        employeeNo: normalizedEmployeeNoInput,
        password: credentials.password,
      });

      if (!response.success) {
        throw new Error(response.message || 'Invalid company code, employee number, or password.');
      }

      // After validation, enforce DB membership and allowed roles using profile endpoint
      // Prefer canonical employeeNo from server when available
      const canonicalEmpNo = String(response.data?.employeeNo ?? normalizedEmployeeNoInput).trim();
      const baseUser = {
        employeeNo: canonicalEmpNo,
        empNo: canonicalEmpNo,
        cmpcode: normalizedCompanyCode,
        companyCode: normalizedCompanyCode,
        name: response.data?.name || canonicalEmpNo,
        sessionToken: response.data?.sessionToken || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        modules: (response.data as any)?.modules,
      } as UserData & Partial<User>;

      console.log('📋 Fetching user profile for:', baseUser.companyCode, baseUser.empNo);
      const prof = await apiService.getUserProfile(baseUser.companyCode!, baseUser.empNo!);
      console.log('📋 Profile response:', prof);
      if (!prof?.success || !prof.data) {
        console.error('❌ Profile fetch failed:', prof);
        throw new Error('Invalid company code, employee number, or password.');
      }
      // Allowed roles from client env (Expo public), fallback to employee,manager
      const allowedRolesEnv = (process.env.EXPO_PUBLIC_LOGIN_ALLOWED_ROLES || 'employee,manager').toLowerCase();
      const allowedRoles = new Set(allowedRolesEnv.split(',').map(s => s.trim()).filter(Boolean));
      const role = String(prof.data.role || 'employee').toLowerCase();
      if (!allowedRoles.has(role)) {
        throw new Error('Invalid company code, employee number, or password.');
      }

      // Merge and store
      const userData: UserData & Partial<User> = { ...baseUser, ...prof.data } as any;

      console.log('✅ Login successful:', userData.empNo);

      // Log successful login
      apiService.logClientError(
        userData.companyCode || normalizedCompanyCode,
        userData.empNo || canonicalEmpNo,
        'login',
        'Login successful',
        'success',
        { role: userData.role }
      );

      // Store user data securely
      await secureStorage.storeUserData(userData);

      // Update state
      setUser(userData);
      setIsAuthenticated(true);

    } catch (error: any) {
      // Log failed login
      const companyCode = String(credentials.companyCode ?? '').trim().toUpperCase();
      const employeeNo = String(credentials.employeeNo ?? '').trim();

      apiService.logClientError(
        companyCode,
        employeeNo,
        'login',
        error.message || 'Login failed',
        'failure',
        { error: error.message || error }
      );

      // Intentionally suppress console errors for login failures to avoid noisy logs in UI
      // If needed for debugging, re-enable or use console.debug here.
      // Always present the specific validation failure to the UI
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await clearAuthState();
    } catch (error: unknown) {
      if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
        console.error('Logout error:', error);
      }
      // Clear local state even if there's an error
      await clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshSession,
  };
});
