import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // ensure exists
      const exists = await client.query(`SELECT 1 FROM toolbox_meetings WHERE id = $1`, [input.id]);
      if (exists.rowCount === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }
      // cascade delete attendees (if FK not set to cascade)
      await client.query(`DELETE FROM toolbox_meeting_attendees WHERE meeting_id = $1`, [input.id]);
      await client.query(`DELETE FROM toolbox_meetings WHERE id = $1`, [input.id]);

      await client.query("NOTIFY toolbox_changes, $1", [JSON.stringify({ type: 'deleted', meetingId: input.id })]);
      await client.query('COMMIT');
      return { id: input.id };
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Delete meeting error:', e);
      if (e instanceof TRPCError) throw e;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete meeting' });
    } finally {
      client.release();
    }
  });
