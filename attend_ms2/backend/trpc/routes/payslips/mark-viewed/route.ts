import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({
    payslipId: z.string().uuid(),
  }))
  .mutation(async ({ input, ctx }) => {
    try {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE payslips 
           SET status = 'viewed', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2
           RETURNING *`,
          [input.payslipId, ctx.user.id]
        );
        await client.query('COMMIT');
        if (result.rows.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Payslip not found or you do not have permission to view it.' });
        }
        const payslip = result.rows[0];
        return {
          id: payslip.id,
          userId: payslip.user_id,
          payPeriodStart: payslip.pay_period_start,
          payPeriodEnd: payslip.pay_period_end,
          payDate: payslip.pay_date,
          basicSalary: parseFloat(payslip.basic_salary),
          overtimeHours: parseFloat(payslip.overtime_hours),
          overtimeRate: parseFloat(payslip.overtime_rate),
          overtimePay: parseFloat(payslip.overtime_pay),
          allowances: payslip.allowances || {},
          deductions: payslip.deductions || {},
          grossPay: parseFloat(payslip.gross_pay),
          taxDeduction: parseFloat(payslip.tax_deduction),
          netPay: parseFloat(payslip.net_pay),
          status: payslip.status,
          pdfUri: payslip.pdf_uri,
          createdAt: payslip.created_at.getTime(),
          updatedAt: payslip.updated_at.getTime(),
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Mark Payslip Viewed Error:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark payslip as viewed.' });
    }
  });