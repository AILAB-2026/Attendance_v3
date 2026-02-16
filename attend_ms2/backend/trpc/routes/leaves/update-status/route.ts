import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({
    leaveId: z.string().uuid(),
    status: z.enum(['approved', 'rejected']),
    rejectedReason: z.string().trim().optional(),
    approvedBy: z.string().trim(), // In a real app, you'd verify this is a manager
  }))
  .mutation(async ({ input, ctx }) => {
    // In a real-world app, you would add logic here to verify 
    // that ctx.user.id has the authority to approve/reject leaves.
    if (input.approvedBy !== ctx.user.empNo) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Approver employee number mismatch' });
    }

    try {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const approverResult = await client.query(`SELECT id FROM users WHERE emp_no = $1`, [input.approvedBy]);
        if (approverResult.rows.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Approver not found.' });
        }
        const approverId = approverResult.rows[0].id;
        const result = await client.query(
          `UPDATE leaves
           SET 
             status = $1, 
             rejected_reason = CASE WHEN $1 = 'rejected' THEN $2 ELSE NULL END,
             approved_by = $3,
             approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING *`,
          [input.status, input.rejectedReason, approverId, input.leaveId]
        );
        await client.query('COMMIT');
        if (result.rows.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found.' });
        }
        const updatedLeave = result.rows[0];
        return {
          ...updatedLeave,
          approvedAt: updatedLeave.approved_at ? updatedLeave.approved_at.getTime() : undefined,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update Leave Status Error:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update leave status.' });
    }
  });