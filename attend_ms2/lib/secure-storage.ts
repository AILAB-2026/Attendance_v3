import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditional import to handle cases where expo-secure-store might not be available
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEYS = {
  SESSION_TOKEN: 'session_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  EXPIRES_AT: 'expires_at',
} as const;

export interface UserData {
  employeeNo: string;
  name?: string;
  cmpcode: string;
  companyCode?: string;
  sessionToken?: string;
  payrollEnable?: boolean;
}

export interface AuthTokens {
  sessionToken: string;
  refreshToken: string;
  expiresAt: string;
}

class SecureStorage {
  private isSecureStoreAvailable(): boolean {
    return Platform.OS !== 'web' && SecureStore !== null;
  }

  private async setItem(key: string, value: string): Promise<void> {
    if (this.isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(key, value);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
      console.warn('No secure storage available');
    }
  }

  private async getItem(key: string): Promise<string | null> {
    if (this.isSecureStoreAvailable()) {
      return await SecureStore.getItemAsync(key);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
      console.warn('No secure storage available');
      return null;
    }
    return null;
  }

  private async deleteItem(key: string): Promise<void> {
    if (this.isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(key);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
      console.warn('No secure storage available');
    }
  }

  async storeAuthTokens(tokens: AuthTokens): Promise<void> {
    try {
      await Promise.all([
        this.setItem(STORAGE_KEYS.SESSION_TOKEN, tokens.sessionToken),
        this.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
        this.setItem(STORAGE_KEYS.EXPIRES_AT, tokens.expiresAt),
      ]);
    } catch (error) {
      console.error('Error storing auth tokens:', error);
      throw new Error('Failed to store authentication tokens securely');
    }
  }

  async getAuthTokens(): Promise<AuthTokens | null> {
    try {
      const [sessionToken, refreshToken, expiresAt] = await Promise.all([
        this.getItem(STORAGE_KEYS.SESSION_TOKEN),
        this.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        this.getItem(STORAGE_KEYS.EXPIRES_AT),
      ]);

      if (!sessionToken || !refreshToken || !expiresAt) {
        return null;
      }

      return {
        sessionToken,
        refreshToken,
        expiresAt,
      };
    } catch (error) {
      console.error('Error retrieving auth tokens:', error);
      return null;
    }
  }

  async storeUserData(userData: UserData): Promise<void> {
    try {
      // Store non-sensitive, potentially larger user profile data in AsyncStorage to avoid SecureStore 2KB limit
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing user data:', error);
      throw new Error('Failed to store user data securely');
    }
  }

  async getUserData(): Promise<UserData | null> {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error retrieving user data:', error);
      return null;
    }
  }

  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        this.deleteItem(STORAGE_KEYS.SESSION_TOKEN),
        this.deleteItem(STORAGE_KEYS.REFRESH_TOKEN),
        // Remove user data from AsyncStorage
        AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
        this.deleteItem(STORAGE_KEYS.EXPIRES_AT),
      ]);
    } catch (error) {
      console.error('Error clearing secure storage:', error);
      throw new Error('Failed to clear authentication data');
    }
  }

  async isTokenExpired(): Promise<boolean> {
    try {
      const expiresAt = await this.getItem(STORAGE_KEYS.EXPIRES_AT);
      if (!expiresAt) return true;

      const expirationDate = new Date(expiresAt);
      const now = new Date();
      
      // Consider token expired if it expires within the next 5 minutes
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      return (expirationDate.getTime() - now.getTime()) < bufferTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  }
}

export const secureStorage = new SecureStorage();
