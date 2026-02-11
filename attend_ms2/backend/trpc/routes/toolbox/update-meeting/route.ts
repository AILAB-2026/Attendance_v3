import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    presenterId: z.string().uuid().optional(),
    location: z.string().optional(),
    safetyTopics: z.array(z.string()).optional(),
    attachments: z.array(z.string()).optional(),
    isMandatory: z.boolean().optional(),
    // When provided, this will REPLACE the attendees set
    attendeeUserIds: z.array(z.string().uuid()).optional(),
  }))
  .mutation(async ({ input }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Build dynamic update
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      const setField = (col: string, val: any) => {
        fields.push(`${col} = $${idx++}`);
        values.push(val);
      };

      if (input.title !== undefined) setField('title', input.title);
      if (input.description !== undefined) setField('description', input.description);
      if (input.meetingDate !== undefined) setField('meeting_date', input.meetingDate);
      if (input.presenterId !== undefined) setField('presenter_id', input.presenterId);
      if (input.location !== undefined) setField('location', input.location || null);
      if (input.safetyTopics !== undefined) setField('safety_topics', input.safetyTopics);
      if (input.attachments !== undefined) setField('attachments', input.attachments);
      if (input.isMandatory !== undefined) setField('is_mandatory', input.isMandatory);
      // always bump updated_at
      setField('updated_at', new Date());

      if (fields.length > 0) {
        values.push(input.id);
        const res = await client.query(
          `UPDATE toolbox_meetings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`,
          values
        );
        if (res.rowCount === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      } else {
        // ensure meeting exists
        const check = await client.query(`SELECT 1 FROM toolbox_meetings WHERE id = $1`, [input.id]);
        if (check.rowCount === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      // Replace attendees if provided
      if (input.attendeeUserIds) {
        await client.query(`DELETE FROM toolbox_meeting_attendees WHERE meeting_id = $1`, [input.id]);
        if (input.attendeeUserIds.length > 0) {
          const vals: any[] = [];
          const tuples: string[] = [];
          input.attendeeUserIds.forEach((uid, i) => {
            vals.push(input.id, uid);
            tuples.push(`(app_gen_random_uuid(), $${i * 2 + 1}, $${i * 2 + 2}, false, NULL, NULL)`);
          });
          await client.query(
            `INSERT INTO toolbox_meeting_attendees (id, meeting_id, user_id, attended, acknowledged_at, signature_uri)
             VALUES ${tuples.join(', ')}`,
            vals
          );
        }
      }

      await client.query("NOTIFY toolbox_changes, $1", [JSON.stringify({ type: 'updated', meetingId: input.id })]);
      await client.query('COMMIT');
      return { id: input.id };
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Update meeting error:', e);
      if (e instanceof TRPCError) throw e;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update meeting' });
    } finally {
      client.release();
    }
  });
