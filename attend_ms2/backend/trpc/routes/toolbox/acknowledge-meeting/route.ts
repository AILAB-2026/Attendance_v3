import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({
    meetingId: z.string().uuid(),
    attended: z.boolean(),
    signatureUri: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    try {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE toolbox_meeting_attendees 
           SET attended = $1, acknowledged_at = CURRENT_TIMESTAMP, signature_uri = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
           WHERE meeting_id = $4 AND user_id = $5
           RETURNING *`,
          [input.attended, input.signatureUri, input.notes, input.meetingId, ctx.user.id]
        );
        await client.query('COMMIT');
        if (result.rows.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting attendee not found.' });
        }
        const attendee = result.rows[0];
        return attendee;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Acknowledge Meeting Error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to acknowledge meeting.' });
    }
  });