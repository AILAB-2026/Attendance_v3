import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    presenterId: z.string().uuid(),
    location: z.string().optional(),
    safetyTopics: z.array(z.string()).default([]),
    attachments: z.array(z.string()).default([]),
    isMandatory: z.boolean().default(true),
    attendeeUserIds: z.array(z.string().uuid()).optional(),
  }))
  .mutation(async ({ input }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO toolbox_meetings (
           title, description, meeting_date, presenter_id, location, safety_topics, attachments, is_mandatory
         ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          input.title,
          input.description,
          input.meetingDate,
          input.presenterId,
          input.location || null,
          input.safetyTopics,
          input.attachments,
          input.isMandatory,
        ]
      );
      const meeting = res.rows[0];

      if (input.attendeeUserIds?.length) {
        const values: any[] = [];
        const params: string[] = [];
        input.attendeeUserIds.forEach((uid, i) => {
          values.push(meeting.id, uid);
          params.push(`(app_gen_random_uuid(), $${i * 2 + 1}, $${i * 2 + 2}, false, NULL, NULL)`);
        });
        await client.query(
          `INSERT INTO toolbox_meeting_attendees (id, meeting_id, user_id, attended, acknowledged_at, signature_uri)
           VALUES ${params.join(',')}
           ON CONFLICT (meeting_id, user_id) DO NOTHING`,
          values
        );
      }

      await client.query("NOTIFY toolbox_changes, $1", [JSON.stringify({ type: 'created', meetingId: meeting.id })]);
      await client.query('COMMIT');
      return { id: meeting.id };
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Create meeting error:', e);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create meeting' });
    } finally {
      client.release();
    }
  });
