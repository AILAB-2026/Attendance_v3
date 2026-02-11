import { http, API_BASE_URL } from './http';
import { validateAttendanceData, normalizeTimestamp, normalizeLocation, normalizeSiteProjectData, createSyncResponse } from './sync-utils';
import { secureStorage } from './secure-storage';

interface LoginCredentials {
  companyCode: string;
  employeeNo: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    employeeNo: string;
    name?: string;
    companyCode: string;
    sessionToken?: string;
  };
}

interface ApiError extends Error {
  status?: number;
  code?: string;
}

type UserProfile = {
  employeeNo: string;
  companyCode: string;
  name?: string;
  role?: string;
  profileImageUri?: string | null;
  leaveBalance?: {
    annual: number;
    medical: number;
    compensatory: number;
    hospitalised: number;
    childcare: number;
    others: number;
  };
  // Per-user schedule (may be null/undefined if not configured)
  workStartTime?: string | null; // 'HH:MM'
  workEndTime?: string | null;   // 'HH:MM'
  graceMin?: number | null;      // minutes
};

interface UserProfileResponse {
  success: boolean;
  message?: string;
  data?: UserProfile;
}

class ApiService {
  private baseUrl = API_BASE_URL;
  private verbose = String(process.env.EXPO_PUBLIC_VERBOSE_LOGS || '').toLowerCase() === 'true';
  private defaultTimeoutMs = 15000;

  constructor() {
    // Debug: Log the API URL being used
    console.log('🔧 API Service initialized');
    console.log('📡 API_BASE_URL (env):', process.env.API_BASE_URL);
    console.log('📡 EXPO_PUBLIC_API_BASE_URL (env):', process.env.EXPO_PUBLIC_API_BASE_URL);
    console.log('📡 EXPO_PUBLIC_DOMAIN (env):', (process as any).env?.EXPO_PUBLIC_DOMAIN);
    console.log('📡 EXPO_PUBLIC_SERVER_PORT (env):', (process as any).env?.EXPO_PUBLIC_SERVER_PORT);
    console.log('✅ Resolved baseUrl:', this.baseUrl);
  }

  // Fetch with timeout wrapper for RN/web without adding new libraries
  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = this.defaultTimeoutMs): Promise<Response> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined as any;
    const id = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
    try {
      const resp = await fetch(url, { ...(options || {}), signal: ctrl?.signal });
      return resp;
    } finally {
      if (id) clearTimeout(id as any);
    }
  }

  // Safely parse JSON when server might return empty body or non-JSON
  private async parseJsonSafe(response: Response): Promise<any> {
    try {
      const ct = response.headers.get('content-type') || '';
      const text = await response.text();
      if (!text || !text.trim().length) return {};
      if (ct.toLowerCase().includes('application/json')) {
        try { return JSON.parse(text); } catch { /* fallthrough */ }
      }
      // Best effort: attempt JSON parse regardless of content-type
      try { return JSON.parse(text); } catch { return { message: text }; }
    } catch {
      return {};
    }
  }

  // Normalize backend-provided status strings to canonical UI categories
  private normalizeStatus(s: any): 'present' | 'absent' | 'late' | 'early-exit' | 'leave' | string {
    const raw = String(s || '').trim().toLowerCase();
    if (!raw) return 'absent';
    const x = raw.replace(/[_\s]+/g, '-');
    // Direct known values
    if (['present', 'absent', 'late', 'early-exit', 'leave'].includes(x)) return x as any;
    // Common aliases
    if (x === 'on-leave' || x === 'leave-day' || x === 'onleave') return 'leave';
    if (x === 'early_exit' || x === 'earlyexit' || x === 'early-out' || x === 'earlyout' || x === 'early-departure') return 'early-exit';
    if (x === 'no-show' || x === 'noshow' || x === 'not-attended' || x === 'not-attendance') return 'absent';
    // Composite/keyword mapping (order matters)
    if (x.includes('leave')) return 'leave';
    if (x.includes('early')) return 'early-exit';
    if (x.includes('late')) return 'late';
    if (x.includes('absent') || x.includes('no-show') || x.includes('noshow') || x.includes('not-attend')) return 'absent';
    if (x.includes('present')) return 'present';
    return x; // fallback to backend value (kebab-cased)
  }

  // Admin: attendance corrections
  async adminListAttendanceCorrections(companyCode: string, employeeNo: string, opts?: { status?: 'pending' | 'approved' | 'rejected'; query?: string; page?: number; limit?: number; startDate?: string; endDate?: string; }) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (opts?.status) params.set('status', opts.status);
    if (opts?.query) params.set('query', opts.query);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.startDate && opts?.endDate) { params.set('startDate', opts.startDate); params.set('endDate', opts.endDate); }
    return this.makeRequest<{ success: boolean; data?: { rows: Array<{ id: string; userId: string; empNo: string; name: string; date: string; fromTime?: string; toTime?: string; reason?: string; status: string; reviewerId?: string; reviewedAt?: string; note?: string }>; total: number; page: number; limit: number } }>(`/admin/attendance-corrections?${params.toString()}`, { method: 'GET' });
  }

  async adminDecideAttendanceCorrection(companyCode: string, employeeNo: string, correctionId: string, decision: 'approved' | 'rejected', note?: string) {
    return this.makeRequest<{ success: boolean }>(`/admin/attendance-corrections/decide`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, employeeNo, correctionId, decision, note }),
    });
  }

  async adminListAuditLogs(companyCode: string, employeeNo: string, opts?: { action?: string; targetType?: string; actorEmpNo?: string; query?: string; page?: number; limit?: number; startDate?: string; endDate?: string; }) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (opts?.action) params.set('action', opts.action);
    if (opts?.targetType) params.set('targetType', opts.targetType);
    if (opts?.actorEmpNo) params.set('actorEmpNo', opts.actorEmpNo);
    if (opts?.query) params.set('query', opts.query);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.startDate && opts?.endDate) { params.set('startDate', opts.startDate); params.set('endDate', opts.endDate); }
    return this.makeRequest<{ success: boolean; data?: { rows: Array<{ id: string; action: string; targetType: string; targetId?: string; metadata: any; createdAt: string; actor: { userId: string; empNo?: string; name?: string } }>; total: number; page: number; limit: number } }>(`/admin/audit-logs?${params.toString()}`, { method: 'GET' });
  }

  // Admin: Users management (manager/admin only)
  async adminListUsers(companyCode: string, employeeNo: string, opts?: { query?: string; role?: 'employee' | 'manager' | 'admin'; active?: boolean; page?: number; limit?: number; }) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (opts?.query) params.set('query', opts.query);
    if (opts?.role) params.set('role', opts.role);
    if (typeof opts?.active === 'boolean') params.set('active', String(opts.active));
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    return this.makeRequest<{ success: boolean; data?: { rows: Array<{ id: string; empNo: string; name: string; email: string; role: string; isActive: boolean; profileImageUri?: string }>; total: number; page: number; limit: number } }>(`/admin/users?${params.toString()}`, { method: 'GET' });
  }

  async adminUpdateUser(companyCode: string, employeeNo: string, id: string, payload: { role?: 'employee' | 'manager' | 'admin'; isActive?: boolean; allowFace?: boolean; allowButton?: boolean }) {
    return this.makeRequest<{ success: boolean }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ companyCode, employeeNo, ...payload }),
    });
  }

  async adminListLeaves(companyCode: string, employeeNo: string, opts?: { status?: 'pending' | 'approved' | 'rejected'; query?: string; page?: number; limit?: number; startDate?: string; endDate?: string; }) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (opts?.status) params.set('status', opts.status);
    if (opts?.query) params.set('query', opts.query);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.startDate && opts?.endDate) { params.set('startDate', opts.startDate); params.set('endDate', opts.endDate); }
    return this.makeRequest<{ success: boolean; data?: { rows: Array<{ id: string; empNo: string; name: string; startDate: string; endDate: string; type: string; reason: string; status: string; effectiveDays?: number }>; total: number; page: number; limit: number } }>(`/admin/leaves?${params.toString()}`, { method: 'GET' });
  }

  // Helper to normalize image URIs
  private normalizeImageUri(uri?: string | null): string | null | undefined {
    if (!uri) return uri;
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('file://') || uri.startsWith('data:')) {
      return uri;
    }
    // Clean potential double slashes if baseUrl ends with / and uri starts with /
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const path = uri.startsWith('/') ? uri : `/${uri}`;
    return `${base}${path}`;
  }

  // Users: update profile image URI
  async updateProfileImage(companyCode: string, employeeNo: string, imageUri: string) {
    try {
      console.log('📸 Updating profile image for:', employeeNo);
      const userData = await secureStorage.getUserData();
      const sessionToken = userData?.sessionToken;

      const formData = new FormData();
      formData.append('companyCode', companyCode);
      formData.append('employeeNo', employeeNo);
      formData.append('profileImage', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);

      const url = `${this.baseUrl}/users/profile-image`;
      console.log('📡 Calling update profile image:', url);

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {},
        body: formData,
      });

      const result: any = await this.parseJsonSafe(response);
      if (result?.data?.profileImageUri) {
        result.data.profileImageUri = this.normalizeImageUri(result.data.profileImageUri);
      }
      return result;
    } catch (e: any) {
      console.error('❌ Update profile image error:', e);
      return { success: false, message: e.message || 'Failed to update profile image' };
    }
  }

  // Settings: clock methods availability (supports per-user override)
  async getClockMethodSettings(companyCode?: string, employeeNo?: string) {
    const params = new URLSearchParams();
    if (companyCode) params.set('companyCode', companyCode);
    if (employeeNo) params.set('employeeNo', employeeNo);
    return this.makeRequest<{ success: boolean; data?: { allowFace: boolean; allowButton: boolean; sitePopup?: boolean } }>(
      `/settings/clock-methods?${params.toString()}`,
      { method: 'GET' }
    );
  }

  // Get company name by company code
  async getCompanyName(companyCode: string) {
    const params = new URLSearchParams({ companyCode });
    const url = `/settings/company-name?${params.toString()}`;
    console.log('📡 Fetching company name from:', `${this.baseUrl}${url}`, 'with companyCode:', companyCode);
    const res = await this.makeRequest<{ success: boolean; data?: { companyName: string } }>(url, { method: 'GET' });
    console.log('📡 Company name response:', res);
    return res;
  }

  // Admin: Check assignment synchronization
  async adminCheckAssignmentSync(companyCode: string, employeeNo: string) {
    return this.makeRequest<{ success: boolean; data?: any }>(
      `/admin/consistency-check?companyCode=${companyCode}&employeeNo=${employeeNo}`,
      { method: 'GET' }
    );
  }

  // Admin: Fix assignment synchronization issues
  async adminFixAssignmentSync(companyCode: string, employeeNo: string) {
    return this.makeRequest<{ success: boolean; data?: { fixed: number; errors: string[] } }>(
      `/admin/fix-inconsistencies`,
      {
        method: 'POST',
        body: JSON.stringify({ companyCode, employeeNo })
      }
    );
  }

  private async makeRequest<T extends { success: boolean }>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as any),
    };

    // Convert fetch-style body to axios data
    let data: any = undefined;
    const anyOptions = options as any;
    if (anyOptions.body != null) {
      const raw = anyOptions.body;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
      } else {
        data = raw;
      }
    }

    const method = (options.method || 'GET') as any;

    try {
      if (this.verbose && endpoint !== '/auth/login') {
        console.log(`Making request to: ${this.baseUrl}${endpoint}`);
      }
      const response = await http.request({
        url: endpoint,
        method,
        data,
        headers: defaultHeaders,
      });

      const respData: any = response.data;
      if (respData && typeof respData === 'object' && 'success' in respData) {
        return respData as T;
      }

      if (typeof respData === 'string') {
        return { success: true, message: respData } as unknown as T;
      }

      return (respData ?? { success: true }) as T;
    } catch (error) {
      // Suppress console noise for login attempts and when verbose logging is disabled
      if (this.verbose && endpoint !== '/auth/login') {
        console.error('Request failed:', error);
      }
      // Errors are normalized by axios interceptor in http.ts
      throw error as ApiError;
    }
  }

  async validateEmployee(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const companyCode = String(credentials.companyCode ?? '').trim().toUpperCase();
      const employeeNo = String(credentials.employeeNo ?? '').trim();
      const password = String(credentials.password ?? '');
      console.log('🔐 Login attempt:', {
        url: `${this.baseUrl}/auth/login-multi`,
        companyCode,
        employeeNo
      });

      const response = await this.makeRequest<LoginResponse>(
        '/auth/login-multi',
        {
          method: 'POST',
          body: JSON.stringify({
            companyCode,
            employeeNo,
            password,
          }),
        }
      );

      console.log('✅ Login response:', response);
      return response;
    } catch (_err: any) {
      console.error('❌ Login error:', _err);
      // Return the specific error message from the backend if available
      return { success: false, message: _err?.message || 'Invalid company code, employee number, or password.' };
    }
  }

  // DB-backed endpoints
  async getTodayAttendance(employeeNo: string, companyCode: string) {
    const params = new URLSearchParams({ employeeNo, companyCode });
    const res = await this.makeRequest<any>(`/attendance/today?${params.toString()}`, { method: 'GET' });
    // Normalize date to YYYY-MM-DD (LOCAL) for client store comparisons
    try {
      if (res?.data) {
        const d = res.data as any;
        const toLocalYMD = (v: any) => {
          if (!v) return undefined;
          const dt = new Date(v);
          if (Number.isNaN(dt.getTime())) return undefined;
          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, '0');
          const day = String(dt.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        const normalizeStatus = (s: any) => this.normalizeStatus(s);

        // Ensure consistent data structure for entries
        const entries = Array.isArray(d.entries)
          ? d.entries.map((e: any) => ({
            siteName: e.siteName || e.site_name || undefined,
            projectName: e.projectName || e.project_name || undefined,
            clockIn: e.clockIn ? {
              ...e.clockIn,
              timestamp: Number(e.clockIn.timestamp),
              location: e.clockIn.location || { latitude: e.clockIn.latitude, longitude: e.clockIn.longitude }
            } : undefined,
            clockOut: e.clockOut ? {
              ...e.clockOut,
              timestamp: Number(e.clockOut.timestamp),
              location: e.clockOut.location || { latitude: e.clockOut.latitude, longitude: e.clockOut.longitude }
            } : undefined,
          }))
          : [];

        const normalized = {
          date: toLocalYMD(d.date) ?? d.date,
          clockIn: d.clockIn ? {
            ...d.clockIn,
            timestamp: Number(d.clockIn.timestamp),
            location: d.clockIn.location || { latitude: d.clockIn.latitude, longitude: d.clockIn.longitude }
          } : undefined,
          clockOut: d.clockOut ? {
            ...d.clockOut,
            timestamp: Number(d.clockOut.timestamp),
            location: d.clockOut.location || { latitude: d.clockOut.latitude, longitude: d.clockOut.longitude }
          } : undefined,
          entries,
          normalHours: Number(d.normalHours ?? d.normal_hours ?? 0),
          overtimeHours: Number(d.overtimeHours ?? d.overtime_hours ?? 0),
          status: normalizeStatus(d.status),
        };
        return { ...res, data: normalized } as typeof res;
      }
    } catch (e) {
      console.warn('Failed to normalize attendance date:', e);
    }
    return res;
  }

  async getAttendanceHistory(companyCode: string, employeeNo: string, startDate: string, endDate: string) {
    const params = new URLSearchParams({ companyCode, employeeNo, startDate, endDate });
    const res = await this.makeRequest<any>(`/attendance/history?${params.toString()}`, { method: 'GET' });
    try {
      const list = Array.isArray(res?.data) ? res.data : [];
      const toLocalYMD = (v: any) => {
        if (!v) return undefined;
        const dt = new Date(v);
        if (Number.isNaN(dt.getTime())) return undefined;
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      const normalizeStatus = (s: any) => this.normalizeStatus(s);
      const normalized = list.map((d: any) => ({
        date: toLocalYMD(d.date) ?? d.date,
        clockIn: d.clockIn ? { ...d.clockIn } : undefined,
        clockOut: d.clockOut ? { ...d.clockOut } : undefined,
        normalHours: Number(d.normalHours ?? 0),
        overtimeHours: Number(d.overtimeHours ?? 0),
        status: normalizeStatus(d.status),
        entries: Array.isArray(d.entries) ? d.entries.map((e: any) => ({
          siteName: e.siteName || undefined,
          projectName: e.projectName || undefined,
          clockIn: e.clockIn ? { ...e.clockIn } : undefined,
          clockOut: e.clockOut ? { ...e.clockOut } : undefined,
          isImproperClocking: e.isImproperClocking || false,
        })) : undefined,
      }));
      return { ...res, data: normalized } as typeof res;
    } catch (e) {
      console.warn('Failed to normalize attendance history:', e);
    }
    return res;
  }

  // Fetch attendance image on demand (to reduce history payload)
  async getAttendanceImage(companyCode: string, imageId: number | string, type: 'clock_in' | 'clock_out') {
    const params = new URLSearchParams({ companyCode, type });
    return this.makeRequest<{ success: boolean; data?: { imageUri: string } }>(`/attendance/image/${imageId}?${params.toString()}`, { method: 'GET' });
  }

  async clockIn(
    employeeNo: string,
    companyCode: string,
    location: { latitude: number; longitude: number; address?: string | null; accuracy?: number | null },
    method: 'face' | 'button' = 'button',
    meta?: { siteName?: string; projectName?: string },
    imageUri?: string,
    faceTemplateBase64?: string
  ) {
    const baseData: any = {
      employeeNo,
      companyCode,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      accuracy: location.accuracy,
      method,
      siteName: meta?.siteName,
      projectName: meta?.projectName,
      faceTemplate: faceTemplateBase64
    };

    try {
      let body: any;
      // Check if imageUri is a local file (candidate for Multipart) vs Base64/HTTP
      const isMultipart = imageUri && !imageUri.startsWith('data:') && !imageUri.startsWith('http') && !imageUri.startsWith('https');

      if (isMultipart && imageUri) {
        console.log('📡 [API] Sending clockIn as Multipart/FormData (Lighter Format)');
        const formData = new FormData();
        Object.entries(baseData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
        formData.append('image', {
          uri: imageUri,
          name: 'clockin.jpg',
          type: 'image/jpeg',
        } as any);
        body = formData;
      } else {
        body = JSON.stringify({ ...baseData, imageUri });
      }

      // Pass undefined Content-Type for FormData to let axios/browser handle boundary
      const headers: any = isMultipart ? { 'Content-Type': undefined } : {};

      const result = await this.makeRequest(`/attendance/clock-in`, {
        method: 'POST',
        headers: headers,
        body: body,
      });
      console.log('📡 [API] clockIn response:', JSON.stringify(result));
      return result;
    } catch (error: any) {
      console.error('❌ [API] clockIn error:', error?.message || error);
      throw error;
    }
  }

  async clockOut(
    employeeNo: string,
    companyCode: string,
    location: { latitude: number; longitude: number; address?: string | null; accuracy?: number | null },
    method: 'face' | 'button' = 'button',
    meta?: { siteName?: string; projectName?: string },
    imageUri?: string,
    faceTemplateBase64?: string,
    isImproperClocking?: boolean
  ) {
    const baseData: any = {
      employeeNo,
      companyCode,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      accuracy: location.accuracy,
      method,
      siteName: meta?.siteName,
      projectName: meta?.projectName,
      faceTemplate: faceTemplateBase64,
      isImproperClocking: isImproperClocking || false
    };

    try {
      let body: any;
      const isMultipart = imageUri && !imageUri.startsWith('data:') && !imageUri.startsWith('http') && !imageUri.startsWith('https');

      if (isMultipart && imageUri) {
        console.log('📡 [API] Sending clockOut as Multipart/FormData (Lighter Format)');
        const formData = new FormData();
        Object.entries(baseData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
        formData.append('image', {
          uri: imageUri,
          name: 'clockout.jpg',
          type: 'image/jpeg',
        } as any);
        body = formData;
      } else {
        body = JSON.stringify({ ...baseData, imageUri });
      }

      const headers: any = isMultipart ? { 'Content-Type': undefined } : {};

      const result = await this.makeRequest(`/attendance/clock-out`, {
        method: 'POST',
        headers: headers,
        body: body,
      });
      console.log('📡 [API] clockOut response:', JSON.stringify(result));
      return result;
    } catch (error: any) {
      console.error('❌ [API] clockOut error:', error?.message || error);
      throw error;
    }
  }
  // Leaves
  async applyLeave(
    companyCode: string,
    employeeNo: string,
    data: { startDate: string; endDate: string; type: string; reason: string; attachmentUri?: string; attachmentName?: string; attachmentMimeType?: string; duration?: 'full' | 'half'; halfDayPeriod?: 'AM' | 'PM' }
  ) {
    // Prepare attachment data if URI is provided
    let attachmentData: string | undefined;
    let attachmentMimeType: string | undefined = data.attachmentMimeType;
    let attachmentName: string | undefined = data.attachmentName;

    if (data.attachmentUri) {
      try {
        // Import FileSystem dynamically to read the file
        const FileSystem = await import('expo-file-system');

        // Read file as base64
        const base64Content = await FileSystem.readAsStringAsync(data.attachmentUri, {
          encoding: 'base64',
        });

        // Determine MIME type from URI extension if not provided
        if (!attachmentMimeType) {
          const extension = data.attachmentUri.split('.').pop()?.toLowerCase() || '';
          const mimeTypes: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          };
          attachmentMimeType = mimeTypes[extension] || 'application/octet-stream';
        }

        if (!attachmentName) {
          attachmentName = data.attachmentUri.split('/').pop() || 'attachment';
        }

        attachmentData = base64Content;

        console.log(`📎 Attachment prepared: ${attachmentName}, ${Math.round(base64Content.length / 1024)}KB, type: ${attachmentMimeType}`);
      } catch (err) {
        console.warn('⚠️ Failed to read attachment file:', err);
        // Continue without attachment data
      }
    }

    return this.makeRequest(`/leave/apply`, {
      method: 'POST',
      body: JSON.stringify({
        companyCode,
        employeeNo,
        ...data,
        attachmentData,
        attachmentMimeType,
        attachmentName,
      }),
    });
  }

  async getLeaves(companyCode: string, employeeNo: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    const res = await this.makeRequest<any>(`/leave?${params.toString()}`, { method: 'GET' });
    const raw = Array.isArray(res?.data) ? res.data : [];
    const data = raw.map((r: any) => ({
      id: r.id,
      empNo: employeeNo,
      startDate: r.start_date,
      endDate: r.end_date,
      type: r.type,
      reason: r.reason,
      status: r.status,
      attachmentUri: r.attachment_uri ?? undefined,
      duration: r.duration ?? undefined,
      halfDayPeriod: r.half_day_period ?? undefined,
      effectiveDays: typeof r.effective_days === 'number' ? Number(r.effective_days) : (r.effective_days != null ? Number(r.effective_days) : undefined),
      approvedBy: r.approved_by ?? undefined,
      approvedAt: r.approved_at ?? undefined,
      rejectedReason: r.rejected_reason ?? undefined,
      createdAt: r.created_at ?? undefined,
      updatedAt: r.updated_at ?? undefined,
    }));
    return { ...res, data } as typeof res;
  }

  async getLeaveBalance(sessionToken: string) {
    return this.makeRequest<any>('/leave/balance', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
  }

  async getLeaveRequests(sessionToken: string) {
    return this.makeRequest<any>('/leave/requests', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
  }

  async updateLeaveStatus(
    leaveId: string,
    status: 'approved' | 'rejected',
    rejectedReason: string | undefined,
    approverCompanyCode: string,
    approverEmployeeNo: string
  ) {
    return this.makeRequest(`/leaves/update-status`, {
      method: 'POST',
      body: JSON.stringify({ leaveId, status, rejectedReason, approverCompanyCode, approverEmployeeNo }),
    });
  }

  async getUserProfile(companyCode: string, employeeNo: string): Promise<UserProfileResponse> {
    const params = new URLSearchParams({ companyCode, employeeNo });
    const res = await this.makeRequest<UserProfileResponse>(`/users/profile?${params.toString()}`, { method: 'GET' });
    if (res?.data?.profileImageUri) {
      res.data.profileImageUri = this.normalizeImageUri(res.data.profileImageUri) as string;
    }
    return res;
  }

  // Payslips
  async getPayslips(
    companyCode: string,
    employeeNo: string,
    opts?: { year?: number; startDate?: string; endDate?: string }
  ) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (opts?.startDate && opts?.endDate) {
      params.set('startDate', opts.startDate);
      params.set('endDate', opts.endDate);
    } else if (typeof opts?.year === 'number') {
      params.set('year', String(opts.year));
    }
    const res = await this.makeRequest<any>(`/payslips?${params.toString()}`, { method: 'GET' });
    const raw = Array.isArray(res?.data) ? res.data : [];
    const data = raw.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      payPeriodStart: r.pay_period_start,
      payPeriodEnd: r.pay_period_end,
      payDate: r.pay_date,
      basicSalary: Number(r.basic_salary ?? 0),
      overtimeHours: Number(r.overtime_hours ?? 0),
      overtimeRate: Number(r.overtime_rate ?? 0),
      overtimePay: Number(r.overtime_pay ?? 0),
      allowances: r.allowances || {},
      deductions: r.deductions || {},
      grossPay: Number(r.gross_pay ?? 0),
      taxDeduction: Number(r.tax_deduction ?? 0),
      netPay: Number(r.net_pay ?? 0),
      status: r.status,
      pdfUri: r.pdf_uri ?? undefined,
      createdAt: r.created_at ?? undefined,
      updatedAt: r.updated_at ?? undefined,
    }));
    return { ...res, data } as typeof res;
  }

  async markPayslipViewed(companyCode: string, employeeNo: string, payslipId: string) {
    return this.makeRequest(`/payslips/mark-viewed`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, employeeNo, payslipId }),
    });
  }

  async getPayslipsNew(sessionToken: string) {
    return this.makeRequest<any>('/payroll/payslips', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
  }

  // Toolbox (Safety)
  async getToolboxMeetings(companyCode: string, employeeNo: string, upcoming?: boolean, assignedOnly: boolean = true) {
    const params = new URLSearchParams({ companyCode, employeeNo, ...(upcoming != null ? { upcoming: String(upcoming) } : {}), assignedOnly: String(assignedOnly) });
    return this.makeRequest(`/toolbox/meetings?${params.toString()}`, { method: 'GET' });
  }

  async acknowledgeMeeting(companyCode: string, employeeNo: string, payload: { meetingId: string; attended: boolean; signatureUri?: string; notes?: string; }) {
    return this.makeRequest(`/toolbox/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, employeeNo, ...payload }),
    });
  }

  // Toolbox: assign meeting to selected employee (manager/admin)
  async assignToolboxMeeting(
    approverCompanyCode: string,
    approverEmployeeNo: string,
    targetEmployeeNo: string,
    meetingId: string
  ) {
    return this.makeRequest<{ success: boolean; data?: { attendee: { id: string; meeting_id: string; user_id: string } } }>(`/toolbox/assign-attendee`, {
      method: 'POST',
      body: JSON.stringify({ companyCode: approverCompanyCode, employeeNo: approverEmployeeNo, targetEmployeeNo, meetingId })
    });
  }

  // Reports
  async getAttendanceStats(companyCode: string, employeeNo: string, startDate: string, endDate: string) {
    const params = new URLSearchParams({ companyCode, employeeNo, startDate, endDate });
    return this.makeRequest(`/reports/attendance-stats?${params.toString()}`, { method: 'GET' });
  }

  getAttendanceExportUrl(companyCode: string, employeeNo: string, startDate: string, endDate: string) {
    const params = new URLSearchParams({ companyCode, employeeNo, startDate, endDate });
    return `${this.baseUrl}/reports/attendance-export?${params.toString()}`;
  }

  // PDF URLs
  getAttendanceExportPdfUrl(companyCode: string, employeeNo: string, startDate: string, endDate: string) {
    const params = new URLSearchParams({ companyCode, employeeNo, startDate, endDate });
    return `${this.baseUrl}/reports/attendance-export-pdf?${params.toString()}`;
  }

  // Team Reports (Admin)
  async adminReportsSummary(
    companyCode: string,
    employeeNo: string,
    opts: { startDate: string; endDate: string; groupBy?: 'employee'; thresholdMinutes?: number; query?: string; page?: number; limit?: number }
  ) {
    const params = new URLSearchParams({ companyCode, employeeNo, startDate: opts.startDate, endDate: opts.endDate });
    if (opts.groupBy) params.set('groupBy', opts.groupBy);
    if (typeof opts.thresholdMinutes === 'number') params.set('thresholdMinutes', String(opts.thresholdMinutes));
    if (opts.query) params.set('query', opts.query);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    return this.makeRequest<{ success: boolean; data?: { rows: Array<{ emp_no: string; name: string; lates: number; absents: number }>; total: number; page: number; limit: number; pageTotals: { lates: number; absents: number } } }>(
      `/admin/reports/summary?${params.toString()}`,
      { method: 'GET' }
    );
  }

  getAdminReportsExportUrl(
    companyCode: string,
    employeeNo: string,
    opts: { startDate: string; endDate: string; groupBy?: 'employee'; thresholdMinutes?: number; query?: string; format?: 'csv' }
  ) {
    const params = new URLSearchParams({ companyCode, employeeNo, startDate: opts.startDate, endDate: opts.endDate });
    if (opts.groupBy) params.set('groupBy', opts.groupBy);
    if (typeof opts.thresholdMinutes === 'number') params.set('thresholdMinutes', String(opts.thresholdMinutes));
    if (opts.query) params.set('query', opts.query);
    params.set('format', opts.format || 'csv');
    return `${this.baseUrl}/admin/reports/export?${params.toString()}`;
  }

  getPayslipPdfDownloadUrl(id: string, companyCode: string, employeeNo: string) {
    const params = new URLSearchParams({ id, companyCode, employeeNo });
    return `${this.baseUrl}/payslips/download?${params.toString()}`;
  }

  // Schedule
  async getAssignedSchedule(companyCode: string, employeeNo: string, date?: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (date) params.set('date', date);
    const res = await this.makeRequest<any>(`/schedule/assigned?${params.toString()}`, { method: 'GET' });
    const list = Array.isArray(res?.data) ? res.data : [];
    const data = list.map((r: any) => ({
      id: r.id,
      siteName: r.siteName || r.site_name || undefined,
      projectName: r.projectName || r.project_name || undefined,
      startDate: r.startDate || r.start_date || undefined,
      endDate: r.endDate || r.end_date || undefined,
    }));
    return { ...res, data } as typeof res;
  }

  async getScheduleOptions(companyCode: string) {
    const params = new URLSearchParams({ companyCode });
    return this.makeRequest<{ success: boolean; data?: { sites: Array<{ id: string; code?: string; name: string }>; projects: Array<{ id: string; code?: string; name: string; site_id?: string }>; } }>(
      `/schedule/options?${params.toString()}`,
      { method: 'GET' }
    );
  }

  async getProjectTasks(companyCode: string, projectName: string, employeeNo?: string) {
    const params = new URLSearchParams({ companyCode, projectName });
    if (employeeNo) params.set('employeeNo', employeeNo);
    return this.makeRequest<{ success: boolean; data?: Array<{ id: string; name: string; status: string }> }>(
      `/schedule/project-tasks?${params.toString()}`,
      { method: 'GET' }
    );
  }

  async updateProjectTaskStatus(companyCode: string, taskId: string, status: 'pending' | 'in-progress' | 'done' | 'blocked') {
    return this.makeRequest<{ success: boolean; data?: { id: string; status: string } }>(`/schedule/update-task-status`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, taskId, status }),
    });
  }

  async assignSchedule(payload: { approverCompanyCode: string; approverEmployeeNo: string; employeeNo: string; siteName?: string; projectName?: string; startDate?: string; endDate?: string; notes?: string; }) {
    return this.makeRequest<{ success: boolean; data?: { id: string } }>(`/schedule/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Face Recognition - Sites and Projects
  async getFaceRecognitionSitesProjects(companyCode: string) {
    // Use the simple sites endpoint that directly reads from project_project.name
    const res = await this.makeRequest<{
      success: boolean;
      message?: string;
      data?: {
        sites: Array<{
          siteId: number;
          siteName: string;
        }>;
      };
    }>(`/api/simple-sites?companyCode=${encodeURIComponent(companyCode)}`, { method: 'GET' });
    return res;
  }

  // OPTIMIZED: Get all sites WITH their projects in a single API call
  // This eliminates N+1 queries and significantly improves loading time
  // When employeeNo is provided, filters by employee assignment (if x_site_popup=true)
  async getSitesWithProjects(companyCode: string, employeeNo?: string) {
    const params = new URLSearchParams({ companyCode });
    if (employeeNo) params.set('employeeNo', employeeNo);

    const res = await this.makeRequest<{
      success: boolean;
      message?: string;
      data?: {
        sites: Array<{
          siteId: number;
          siteName: string;
        }>;
        siteProjectMap: Record<string, string[]>;
      };
    }>(`/api/simple-sites-with-projects?${params.toString()}`, { method: 'GET' });
    return res;
  }

  async getFaceRecognitionProjects(siteId: number | string, companyCode: string) {
    // Use the simple projects endpoint
    const res = await this.makeRequest<{
      success: boolean;
      message?: string;
      data?: {
        siteId: number | string;
        projects: Array<{
          projectId: number;
          projectName: string;
          isOpen: boolean;
          siteId?: number;
          siteName?: string;
        }>;
      };
    }>(`/api/simple-projects/${siteId}?companyCode=${encodeURIComponent(companyCode)}`, { method: 'GET' });
    return res;
  }

  // Admin schedules
  async adminListSchedules(companyCode: string, employeeNo: string, opts?: { startDate?: string; endDate?: string; query?: string; page?: number; limit?: number; }) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (opts?.startDate && opts?.endDate) { params.set('startDate', opts.startDate); params.set('endDate', opts.endDate); }
    if (opts?.query) params.set('query', opts.query);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    return this.makeRequest<{ success: boolean; data?: { rows: Array<{ id: string; userId: string; empNo: string; name: string; date: string; startTime: string; endTime: string; shiftCode?: string; location?: string; notes?: string }>; total: number; page: number; limit: number } }>(`/admin/schedules?${params.toString()}`, { method: 'GET' });
  }

  async adminBulkAssignSchedules(companyCode: string, employeeNo: string, payload: { employeeNos: string[]; startDate: string; endDate: string; startTime: string; endTime: string; shiftCode?: string; location?: string; notes?: string; }) {
    return this.makeRequest<{ success: boolean; data?: { upserted: number } }>(`/admin/schedules/bulk-assign`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, employeeNo, ...payload }),
    });
  }

  async adminImportSchedulesCsv(companyCode: string, employeeNo: string, csv: string) {
    return this.makeRequest<{ success: boolean; data?: { upserted: number; errors: Array<{ line: number; message: string }> } }>(`/admin/schedules/import-csv`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, employeeNo, csv }),
    });
  }

  // Check clock in/out status for a project
  async checkClockStatus(companyCode: string, employeeNo: string, projectName?: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    if (projectName) {
      params.append('projectName', projectName);
    }
    return this.makeRequest<{
      success: boolean;
      isClockedIn: boolean;
      action: 'clock_in' | 'clock_out';
      data?: {
        clockingLineId: number;
        clockInTime: string;
        siteName: string;
      };
    }>(
      `/attendance/status?${params.toString()}`,
      { method: 'GET' }
    );
  }

  // Check for missed clock-outs from previous days
  async checkMissedClockout(companyCode: string, employeeNo: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    return this.makeRequest<{
      success: boolean;
      hasMissedClockout: boolean;
      data?: {
        clockingLineId: number;
        clockInDate: string;
        clockInTime: string;
        siteName?: string;
        projectName?: string;
        employeeName?: string;
      };
    }>(
      `/attendance/missed-clockout?${params.toString()}`,
      { method: 'GET' }
    );
  }

  // Face recognition
  async getFaceModelsReady() {
    return this.makeRequest<{ success: boolean; ready: boolean }>(`/facialAuth/ready`, { method: 'GET' });
  }
  async getFaceStatus(companyCode: string, employeeNo: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    return this.makeRequest<{ success: boolean; data?: { registered: boolean; imageUri?: string | null; templateVersion?: string | null }; message?: string }>(
      `/face/status?${params.toString()}`,
      { method: 'GET' }
    );
  }

  async registerFace(companyCode: string, employeeNo: string, payload: { imageUri?: string; faceTemplateBase64?: string; templateVersion?: string }) {
    try {
      console.log('📝 Enrolling face for:', employeeNo);

      // Retrieve session token from secure storage (must be logged in)
      const userData = await secureStorage.getUserData();
      const sessionToken = userData?.sessionToken;
      if (!sessionToken) {
        return { success: false, message: 'Failed to authenticate user' };
      }

      // Prepare FormData with face image (React Native compatible)
      const formData = new FormData();

      // React Native FormData expects { uri, type, name } format
      if (payload?.imageUri) {
        formData.append('faceImage', {
          uri: payload.imageUri,
          type: 'image/jpeg',
          name: 'face.jpg',
        } as any);
      } else if (payload?.faceTemplateBase64) {
        // For base64, we need to convert to file URI or use data URI
        formData.append('faceImage', {
          uri: payload.faceTemplateBase64.startsWith('data:')
            ? payload.faceTemplateBase64
            : `data:image/jpeg;base64,${payload.faceTemplateBase64}`,
          type: 'image/jpeg',
          name: 'face.jpg',
        } as any);
      } else {
        return { success: false, message: 'No image provided' };
      }

      // Call attend_ms_api_2 backend
      const url = `${this.baseUrl}/facialAuth/enroll`;
      console.log('📡 Calling enroll:', url);

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      console.log('📡 Enroll response status:', response.status);
      const result: any = await this.parseJsonSafe(response);
      console.log('📋 Face enrollment result:', result);

      if (result.message === 'Face enrolled successfully') {
        return {
          success: true,
          message: 'Face enrolled successfully!'
        };
      } else if (result.error) {
        return {
          success: false,
          message: result.error
        };
      } else {
        return {
          success: false,
          message: 'Face enrollment failed'
        };
      }
    } catch (error: any) {
      console.error('❌ Face enrollment error:', error);
      return {
        success: false,
        message: error.message || 'Face enrollment failed'
      };
    }
  }

  async verifyFace(companyCode: string, employeeNo: string, payload?: { imageUri?: string; faceTemplateBase64?: string; livenessFrames?: string[] }) {
    try {
      console.log('🔐 Verifying face for:', employeeNo);

      // Retrieve session token from secure storage (must be logged in)
      const userData = await secureStorage.getUserData();
      const sessionToken = userData?.sessionToken;
      if (!sessionToken) {
        return { success: false, message: 'Failed to authenticate user' };
      }

      // Prepare FormData with face image (React Native compatible)
      const formData = new FormData();

      // React Native FormData expects { uri, type, name } format
      if (payload?.imageUri) {
        formData.append('faceImage', {
          uri: payload.imageUri,
          type: 'image/jpeg',
          name: 'face.jpg',
        } as any);
      } else if (payload?.faceTemplateBase64) {
        // For base64, we need to convert to file URI or use data URI
        formData.append('faceImage', {
          uri: payload.faceTemplateBase64.startsWith('data:')
            ? payload.faceTemplateBase64
            : `data:image/jpeg;base64,${payload.faceTemplateBase64}`,
          type: 'image/jpeg',
          name: 'face.jpg',
        } as any);
      } else {
        return { success: false, message: 'No image provided' };
      }

      // SECURITY: Add liveness frames for server-side verification
      if (payload?.livenessFrames && payload.livenessFrames.length > 0) {
        // Send frame data as JSON string for server-side analysis
        formData.append('livenessData', JSON.stringify({
          frameCount: payload.livenessFrames.length,
          frames: payload.livenessFrames.map((frame, idx) => ({
            index: idx,
            // Send a hash/signature of each frame for verification
            signature: frame.slice(0, 100) + frame.slice(-100),
            length: frame.length
          }))
        }));
      }

      // Call attend_ms_api_2 backend
      const url = `${this.baseUrl}/facialAuth/authenticate`;
      console.log('📡 Calling authenticate:', url);

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      console.log('📡 Authenticate response status:', response.status);
      const result: any = await this.parseJsonSafe(response);
      console.log('📋 Face verification result:', result);

      // Backend returns status_code: 0 for match, 1 for no match
      if (result.status_code === 0) {
        return {
          success: true,
          message: `Face verified! Confidence: ${(result.confidence * 100).toFixed(1)}%`
        };
      } else if (result.status_code === 1) {
        return {
          success: false,
          message: 'Face does not match enrolled face. Please try again.'
        };
      } else if (result.error) {
        return {
          success: false,
          message: result.error
        };
      } else {
        return {
          success: false,
          message: 'Face verification failed'
        };
      }
    } catch (error: any) {
      console.error('❌ Face verification error:', error);
      return {
        success: false,
        message: error.message || 'Face verification failed'
      };
    }
  }

  async reportUnauthorizedAccess(companyCode: string, payload: { imageUri: string; timestamp: string; attemptType: string; detectedEmployee?: string }) {
    return this.makeRequest<{ success: boolean; message?: string }>(`/security/unauthorized-access`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, ...payload }),
    });
  }

  async getCompanyInfo(companyCode: string): Promise<{ success: boolean; data?: { companyCode: string; companyName: string; hasLogo: boolean; active: boolean; payrollEnable: boolean }; message?: string }> {
    try {
      const url = `${this.baseUrl}/company/info?companyCode=${encodeURIComponent(companyCode)}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' });
      const result = await this.parseJsonSafe(response);
      return result;
    } catch (error: any) {
      console.error('❌ Get company info error:', error);
      return { success: false, message: error.message || 'Failed to fetch company info' };
    }
  }

  getCompanyLogoUrl(companyCode: string): string {
    return `${this.baseUrl}/company/logo/${encodeURIComponent(companyCode)}`;
  }

  // Surveys
  async getSurveys(companyCode: string, employeeNo: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    return this.makeRequest<any>(`/surveys/list?${params.toString()}`, { method: 'GET' });
  }

  async getSurveyDetails(companyCode: string, surveyId: number | string, employeeNo: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    return this.makeRequest<any>(`/surveys/${surveyId}?${params.toString()}`, { method: 'GET' });
  }

  async submitSurvey(companyCode: string, employeeNo: string, surveyId: number | string, answers: any[]) {
    return this.makeRequest<any>(`/surveys/${surveyId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ companyCode, employeeNo, answers })
    });
  }
  // Feedback
  async checkFeedbackStatus(companyCode: string, employeeNo: string) {
    const params = new URLSearchParams({ companyCode, employeeNo });
    return this.makeRequest<any>(`/feedback/check?${params.toString()}`, { method: 'GET' });
  }

  async submitFeedback(payload: { companyCode: string; employeeNo: string; employeeName?: string; rating: number; workEnvironment?: string; supervisorSupport?: number; comments?: string; isAnonymous?: boolean; submittedAt?: string }) {
    return this.makeRequest<any>(`/feedback/submit`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Manager Feedback
  async getFeedbackStats(companyCode: string) {
    const params = new URLSearchParams({ companyCode });
    return this.makeRequest<any>(`/feedback/stats?${params.toString()}`, { method: 'GET' });
  }

  async getFeedbackList(companyCode: string, page: number = 1) {
    const params = new URLSearchParams({ companyCode, page: String(page) });
    return this.makeRequest<any>(`/feedback/list?${params.toString()}`, { method: 'GET' });
  }
}

export const apiService = new ApiService();
export type { LoginCredentials, LoginResponse, ApiError };
export type { UserProfile, UserProfileResponse };
