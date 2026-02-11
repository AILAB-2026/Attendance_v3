import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({
    meetingId: z.string().uuid(),
    userId: z.string().uuid(),
    attended: z.boolean().optional(),
    signatureUri: z.string().optional(),
    notes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // Ensure meeting exists
      const m = await client.query(`SELECT 1 FROM toolbox_meetings WHERE id = $1`, [input.meetingId]);
      if (m.rowCount === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });

      const res = await client.query(
        `INSERT INTO toolbox_meeting_attendees (id, meeting_id, user_id, attended, acknowledged_at, signature_uri, notes)
         VALUES (app_gen_random_uuid(), $1, $2, COALESCE($3,false), CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END, $4, $5)
         ON CONFLICT (meeting_id, user_id) DO UPDATE SET
           attended = COALESCE(EXCLUDED.attended, toolbox_meeting_attendees.attended),
           acknowledged_at = CASE WHEN EXCLUDED.attended THEN CURRENT_TIMESTAMP ELSE toolbox_meeting_attendees.acknowledged_at END,
           signature_uri = COALESCE(EXCLUDED.signature_uri, toolbox_meeting_attendees.signature_uri),
           notes = COALESCE(EXCLUDED.notes, toolbox_meeting_attendees.notes),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [input.meetingId, input.userId, input.attended ?? null, input.signatureUri ?? null, input.notes ?? null]
      );

      await client.query("NOTIFY toolbox_changes, $1", [JSON.stringify({ type: 'attendee-upsert', meetingId: input.meetingId, userId: input.userId })]);
      await client.query('COMMIT');
      return res.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Upsert attendee error:', e);
      if (e instanceof TRPCError) throw e;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upsert attendee' });
    } finally {
      client.release();
    }
  });
