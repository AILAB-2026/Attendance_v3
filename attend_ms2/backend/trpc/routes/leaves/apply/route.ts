import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import { TRPCError } from "@trpc/server";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export default protectedProcedure
  .input(z.object({
    empNo: z.string().trim(),
    startDate: dateSchema,
    endDate: dateSchema,
    type: z.enum(['annual', 'medical', 'emergency', 'unpaid', 'other']),
    reason: z.string().trim(),
    attachmentUri: z.string().trim().optional(),
    duration: z.enum(['full','half']).optional(),
    halfDayPeriod: z.enum(['AM','PM']).optional(),
  }).refine((v) => {
    // If half-day is selected, it must be a single-day range and AM/PM must be provided
    if (v.duration === 'half') {
      return v.startDate === v.endDate && !!v.halfDayPeriod;
    }
    return true;
  }, { message: 'Half-day leave must be a single day and include AM/PM selection' }))
  .mutation(async ({ input, ctx }) => {
    try {
      // Find user by empNo
      if (input.empNo !== ctx.user.empNo) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee number mismatch' });
      }
      const userResult = await db.query(
        `SELECT id FROM users WHERE emp_no = $1 AND is_active = true`,
        [input.empNo]
      );
      if (userResult.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found or inactive' });
      }
      const userId = userResult.rows[0].id;
      // Compute effective days server-side for consistency
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      const dayMs = 1000 * 60 * 60 * 24;
      const daysInclusive = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
      const effectiveDays = (input.duration === 'half' && input.startDate === input.endDate) ? 0.5 : daysInclusive;
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        // Overlap check: prevent overlapping leaves (pending or approved)
        const overlapRes = await client.query(
          `SELECT 1
           FROM leaves
           WHERE user_id = $1
             AND status IN ('pending','approved')
             AND NOT ($4 < start_date OR $3 > end_date)
           LIMIT 1`,
          [userId, /* unused */ null, input.startDate, input.endDate]
        );
        if (overlapRes.rows.length > 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Overlapping leave request exists' });
        }

        // Quota validation (feature-flagged)
        const enforceQuota = (process.env.LEAVE_QUOTA_ENFORCE || '').toLowerCase() === 'true';
        const requireEntitlement = (process.env.LEAVE_QUOTA_REQUIRE_ENTITLEMENT || '').toLowerCase() === 'true';
        if (enforceQuota) {
          const year = new Date(input.startDate).getFullYear();
          const typeLower = input.type.toLowerCase();

          // Read entitlement for this user/type/year
          const entRes = await client.query(
            `SELECT days_allocated, COALESCE(days_carried, 0) AS days_carried
             FROM leave_entitlements
             WHERE user_id = $1 AND lower(leave_type) = $2 AND year = $3
             LIMIT 1`,
            [userId, typeLower, year]
          );

          if (entRes.rows.length === 0) {
            if (requireEntitlement) {
              throw new TRPCError({ code: 'FORBIDDEN', message: `No entitlement configured for ${input.type} (${year}). Contact HR.` });
            }
          } else {
            const alloc = Number(entRes.rows[0].days_allocated) + Number(entRes.rows[0].days_carried);
            const usedRes = await client.query(
              `SELECT COALESCE(SUM(effective_days), 0) AS used
               FROM leaves
               WHERE user_id = $1 AND lower(type) = $2 AND EXTRACT(YEAR FROM start_date) = $3
                 AND status IN ('pending','approved')`,
              [userId, typeLower, year]
            );
            const used = Number(usedRes.rows[0].used);
            const remaining = alloc - used;
            if (effectiveDays > remaining + 1e-6) {
              throw new TRPCError({ code: 'FORBIDDEN', message: `Allocated days exceeded for ${input.type}. Remaining: ${Math.max(0, remaining)} day(s).` });
            }
          }
        }

        const result = await client.query(
          `INSERT INTO leaves (user_id, start_date, end_date, type, reason, attachment_uri, duration, half_day_period, effective_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            userId,
            input.startDate,
            input.endDate,
            input.type,
            input.reason,
            input.attachmentUri ?? null,
            input.duration ?? 'full',
            input.duration === 'half' ? input.halfDayPeriod ?? null : null,
            effectiveDays,
          ]
        );
        await client.query('COMMIT');
        const leave = result.rows[0];
        return {
          id: leave.id,
          empNo: input.empNo,
          startDate: leave.start_date,
          endDate: leave.end_date,
          type: leave.type,
          reason: leave.reason,
          status: leave.status,
          attachmentUri: leave.attachment_uri,
          approvedBy: leave.approved_by,
          approvedAt: leave.approved_at ? leave.approved_at.getTime() : undefined,
          rejectedReason: leave.rejected_reason,
          duration: leave.duration,
          halfDayPeriod: leave.half_day_period,
          effectiveDays: leave.effective_days,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        // Handle duplicate active leave (unique violation)
        if ((err as any)?.code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'A leave request for these dates already exists.' });
        }
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Apply Leave Error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to apply for leave.' });
    }
  });