/**
 * Data Synchronization Utilities
 * Ensures consistent data flow between frontend, backend, and database
 */

export interface SyncResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface DataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates attendance data structure consistency
 */
export function validateAttendanceData(data: any): DataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data) {
    errors.push('Attendance data is null or undefined');
    return { isValid: false, errors, warnings };
  }

  // Required fields validation
  if (!data.date) {
    errors.push('Missing required field: date');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('Invalid date format, expected YYYY-MM-DD');
  }

  if (typeof data.normalHours !== 'number' || data.normalHours < 0) {
    errors.push('Invalid normalHours: must be a non-negative number');
  }

  if (typeof data.overtimeHours !== 'number' || data.overtimeHours < 0) {
    errors.push('Invalid overtimeHours: must be a non-negative number');
  }

  if (!data.status || typeof data.status !== 'string') {
    errors.push('Missing or invalid status field');
  }

  // Validate entries structure
  if (data.entries && Array.isArray(data.entries)) {
    data.entries.forEach((entry: any, index: number) => {
      if (entry.clockIn && (!entry.clockIn.timestamp || typeof entry.clockIn.timestamp !== 'number')) {
        errors.push(`Entry ${index}: clockIn timestamp is invalid`);
      }
      if (entry.clockOut && (!entry.clockOut.timestamp || typeof entry.clockOut.timestamp !== 'number')) {
        errors.push(`Entry ${index}: clockOut timestamp is invalid`);
      }
      
      // Validate clock sequence
      if (entry.clockIn && entry.clockOut && entry.clockIn.timestamp >= entry.clockOut.timestamp) {
        warnings.push(`Entry ${index}: clockOut timestamp should be after clockIn`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates user data structure consistency
 */
export function validateUserData(data: any): DataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data) {
    errors.push('User data is null or undefined');
    return { isValid: false, errors, warnings };
  }

  if (!data.empNo || typeof data.empNo !== 'string') {
    errors.push('Missing or invalid employee number');
  }

  if (!data.companyCode || typeof data.companyCode !== 'string') {
    errors.push('Missing or invalid company code');
  }

  if (data.leaveBalance) {
    const balanceFields = ['annual', 'medical', 'emergency', 'unpaid'];
    balanceFields.forEach(field => {
      if (data.leaveBalance[field] !== undefined && 
          (typeof data.leaveBalance[field] !== 'number' || data.leaveBalance[field] < 0)) {
        errors.push(`Invalid ${field} leave balance: must be a non-negative number`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Normalizes timestamp formats across the application
 */
export function normalizeTimestamp(timestamp: any): number | null {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  if (typeof timestamp === 'number') {
    // Handle both seconds and milliseconds
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
  }

  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    return isNaN(parsed) ? null : parsed;
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  return null;
}

/**
 * Normalizes location data structure
 */
export function normalizeLocation(location: any): { latitude: number; longitude: number; address?: string } | null {
  if (!location) return null;

  const lat = typeof location.latitude === 'number' ? location.latitude : 
               typeof location.lat === 'number' ? location.lat : null;
  
  const lng = typeof location.longitude === 'number' ? location.longitude :
               typeof location.lng === 'number' ? location.lng :
               typeof location.lon === 'number' ? location.lon : null;

  if (lat === null || lng === null || 
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
    address: typeof location.address === 'string' ? location.address : undefined
  };
}

/**
 * Creates a standardized API response format
 */
export function createSyncResponse<T>(
  success: boolean, 
  data?: T, 
  error?: string,
  metadata?: Record<string, any>
): SyncResult<T> {
  return {
    success,
    data,
    error,
    timestamp: Date.now(),
    ...metadata
  };
}

/**
 * Debounces function calls to prevent excessive API requests
 */
export function createDebouncer<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout>;
  let resolvePromise: (value: ReturnType<T>) => void;
  let rejectPromise: (reason: any) => void;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      resolvePromise = resolve;
      rejectPromise = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

/**
 * Retries failed operations with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Validates and normalizes site/project data
 */
export function normalizeSiteProjectData(data: any): { siteName?: string; projectName?: string } {
  return {
    siteName: typeof data?.siteName === 'string' && data.siteName.trim() 
      ? data.siteName.trim() 
      : typeof data?.site_name === 'string' && data.site_name.trim()
      ? data.site_name.trim()
      : undefined,
    projectName: typeof data?.projectName === 'string' && data.projectName.trim()
      ? data.projectName.trim()
      : typeof data?.project_name === 'string' && data.project_name.trim()
      ? data.project_name.trim()
      : undefined
  };
}
