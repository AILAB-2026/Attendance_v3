export type Payslip = {
  id: string;
  userId: string;
  payPeriodStart: string; // YYYY-MM-DD
  payPeriodEnd: string; // YYYY-MM-DD
  payDate: string; // YYYY-MM-DD
  basicSalary: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimePay: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  grossPay: number;
  taxDeduction: number;
  netPay: number;
  status: 'generated' | 'sent' | 'viewed';
  pdfUri?: string;
  createdAt: number;
  updatedAt: number;
};