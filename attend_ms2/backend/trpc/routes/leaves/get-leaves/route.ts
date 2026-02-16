import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import { TRPCError } from "@trpc/server";

interface LeaveRow {
  id: string;
  start_date: string;
  end_date: string;
  type: string;
  reason: string;
  status: string;
  attachment_uri: string;
  approved_by_name: string;
  approved_at: Date;
  rejected_reason: string;
}

export default protectedProcedure
  .input(z.object({
    empNo: z.string().trim(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  }))
  .query(async ({ input, ctx }) => {
    if (input.empNo !== ctx.user.empNo) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee number mismatch' });
    }

    try {
      // Find user by empNo
      const userResult = await db.query(
        `SELECT id FROM users WHERE emp_no = $1 AND is_active = true`,
        [input.empNo]
      );
      if (userResult.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found or inactive' });
      }
      const userId = userResult.rows[0].id;

      let query = `
        SELECT l.*, u.name as approved_by_name
        FROM leaves l
        LEFT JOIN users u ON l.approved_by = u.id
        WHERE l.user_id = $1
      `;
      const params: (string | number)[] = [userId];
      if (input.status) {
        query += ` AND l.status = ${params.length + 1}`;
        params.push(input.status);
      }
      query += ` ORDER BY l.created_at DESC`;
      const result = await db.query(query, params);
      return result.rows.map((row: LeaveRow) => ({
        id: row.id,
        empNo: input.empNo,
        startDate: row.start_date,
        endDate: row.end_date,
        type: row.type,
        reason: row.reason,
        status: row.status,
        attachmentUri: row.attachment_uri,
        approvedBy: row.approved_by_name,
        approvedAt: row.approved_at ? row.approved_at.getTime() : undefined,
        rejectedReason: row.rejected_reason,
      }));
    } catch (error) {
      console.error('Get Leaves Error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch leave data.' });
    }
  });