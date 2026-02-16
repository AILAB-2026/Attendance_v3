import axios, { AxiosError } from 'axios';
import { secureStorage } from './secure-storage';

// Centralized HTTP client using axios
// Base URL prefers explicit API base env, then DOMAIN/SERVER_PORT fallbacks, then localhost
const envApiBase = (process.env.API_BASE_URL as string) || (process.env.EXPO_PUBLIC_API_BASE_URL as string);
const envDomain = (process.env.EXPO_PUBLIC_DOMAIN as string) || (process.env.DOMAIN as string);
const envServerPort = (process.env.EXPO_PUBLIC_SERVER_PORT as string) || (process.env.SERVER_PORT as string);

function buildBaseFromParts(domain?: string, port?: string): string {
  if (!domain) return '';
  // If domain is a full URL (may include path), prefer it as-is and do not append port if a path exists
  try {
    const u = new URL(domain);
    // If a path beyond root exists, treat as the full base and do not modify
    if (u.pathname && u.pathname !== '/') {
      return u.toString().replace(/\/$/, '');
    }
    if (port && !u.port) {
      u.port = String(port);
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    // domain might be bare host without protocol
    const protocolPrefixed = domain.startsWith('http://') || domain.startsWith('https://');
    const origin = `${protocolPrefixed ? '' : 'https://'}${domain}${port ? `:${port}` : ''}`;
    return origin.replace(/\/$/, '');
  }
}

export const API_BASE_URL = (envApiBase || buildBaseFromParts(envDomain, envServerPort) || 'http://localhost:3000').replace(/\/$/, '');

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token to all requests
http.interceptors.request.use(
  async (config) => {
    try {
      const tokens = await secureStorage.getAuthTokens();
      if (tokens?.sessionToken) {
        config.headers.Authorization = `Bearer ${tokens.sessionToken}`;
      }
    } catch (error) {
      // Silently fail if token retrieval fails
      console.warn('Failed to retrieve auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor ensures we always return data directly in most cases
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Normalize common error shapes to a friendly message
    if (error.response) {
      const status = error.response.status;
      const data: any = error.response.data;
      const text = (typeof data === 'string') ? data : (data?.message || data?.error || '');

      // Special case: company expired wording
      if (typeof text === 'string' && text.toLowerCase().includes('company has expired')) {
        const e = new Error('The company account has expired. Please contact your administrator.') as Error & { status?: number; code?: string };
        e.code = 'COMPANY_EXPIRED';
        e.status = status;
        return Promise.reject(e);
      }

      const e = new Error(text || `API request failed: ${status}`) as Error & { status?: number };
      e.status = status;
      return Promise.reject(e);
    }

    if (error.request) {
      const e = new Error('Network error: Please check your internet connection') as Error & { code?: string };
      e.code = 'NETWORK_ERROR';
      return Promise.reject(e);
    }

    return Promise.reject(error);
  }
);
