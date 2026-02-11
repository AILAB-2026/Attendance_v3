export type ClockEvent = {
  id: string;
  empNo: string;
  timestamp: number;
  type: 'in' | 'out';
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
    accuracy?: number | null;
  };
  address?: {
    plot: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    full: string | null;
  };
  method: 'face' | 'button';
  imageUri: string | null;
  // Lazy-loading image support (for history to reduce payload)
  hasImage?: boolean;
  imageId?: number | string;
  // Optional site/project metadata
  siteName?: string;
  projectName?: string;
};

export interface AttendanceDay {
  date: string; // YYYY-MM-DD
  clockIn?: ClockEvent;
  clockOut?: ClockEvent;
  // New multi-entry model: multiple sessions per site/project
  entries?: AttendanceEntry[];
  normalHours: number;
  overtimeHours: number;
  breakHours?: number;
  status: string;
}

export type AttendanceEntry = {
  siteName?: string;
  projectName?: string;
  clockIn?: ClockEvent;
  clockOut?: ClockEvent;
};

export type LeaveType = 'annual' | 'medical' | 'compensatory' | 'hospitalised' | 'childcare' | 'unpaid' | 'others';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface Leave {
  id: string;
  empNo: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  attachmentUri?: string;
  approvedBy?: string;
  approvedAt?: number;
  rejectedReason?: string;
  // Optional half-day support for single-day leaves
  duration?: 'full' | 'half';
  halfDayPeriod?: 'AM' | 'PM';
  // Computed by backend to reflect actual leave units
  effectiveDays?: number;
}

export type LeaveBalance = {
  annual: number;
  medical: number;
  compensatory: number;
  hospitalised: number;
  childcare: number;
  unpaid: number;
  others: number;
};

export type User = {
  id: string;
  empNo: string;
  name: string;
  email: string;
  profileImageUri?: string;
  role: 'employee' | 'manager' | 'admin';
  companyCode: string;
  companyName: string;
  leaveBalance: LeaveBalance;
  // Optional per-employee schedule
  workStartTime?: string | null; // 'HH:MM'
  workEndTime?: string | null;   // 'HH:MM'
  graceMin?: number | null;      // minutes
  // Payroll feature toggle
  payrollEnable?: boolean;
  // Hours display toggle (false hides Normal Hours & Overtime)
  enableHours?: boolean;
  config?: {
    workingDays: number; // 5, 5.5, 6, 7
    holidays: string[];  // ['YYYY-MM-DD']
  };
};