import { Payslip } from "@/types/payslip";
import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({
    empNo: z.string().trim(),
    year: z.number().int().min(2000).max(2100).optional(),
  }))
  .query(async ({ input, ctx }) => {
    if (input.empNo !== ctx.user.empNo) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee number mismatch' });
    }

    try {
      let query = `
        SELECT * FROM payslips
        WHERE user_id = $1
      `;
      
      const params: (string | number)[] = [ctx.user.id];
      
      if (input.year) {
        query += ` AND EXTRACT(YEAR FROM pay_date) = $${params.length + 1}`;
        params.push(input.year);
      }
      
      query += ` ORDER BY pay_date DESC`;
      
      const result = await db.query(query, params);
      
      return result.rows.map((row: {
        id: string;
        user_id: string;
        pay_period_start: string;
        pay_period_end: string;
        pay_date: string;
        basic_salary: string;
        overtime_hours: string;
        overtime_rate: string;
        overtime_pay: string;
        allowances: Record<string, number>;
        deductions: Record<string, number>;
        gross_pay: string;
        tax_deduction: string;
        net_pay: string;
        status: string;
        pdf_uri: string | null;
        created_at: Date;
        updated_at: Date;
      }) => ({
        id: row.id,
        userId: row.user_id,
        payPeriodStart: row.pay_period_start,
        payPeriodEnd: row.pay_period_end,
        payDate: row.pay_date,
        basicSalary: parseFloat(row.basic_salary),
        overtimeHours: parseFloat(row.overtime_hours),
        overtimeRate: parseFloat(row.overtime_rate),
        overtimePay: parseFloat(row.overtime_pay),
        allowances: row.allowances || {},
        deductions: row.deductions || {},
        grossPay: parseFloat(row.gross_pay),
        taxDeduction: parseFloat(row.tax_deduction),
        netPay: parseFloat(row.net_pay),
        status: row.status as Payslip['status'],
        pdfUri: row.pdf_uri || undefined,
        createdAt: row.created_at.getTime(),
        updatedAt: row.updated_at.getTime(),
      }));
    } catch (error) {
      console.error('Get Payslips Error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch payslips.' });
    }
  });