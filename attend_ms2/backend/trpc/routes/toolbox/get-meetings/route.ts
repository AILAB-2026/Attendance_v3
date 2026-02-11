import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "@/backend/db";
import { TRPCError } from "@trpc/server";

interface MeetingRow {
  id: string;
  title: string;
  description: string;
  meeting_date: string;
  presenter_id: string;
  presenter_name: string;
  location: string;
  safety_topics: string[];
  attachments: string[];
  is_mandatory: boolean;
  created_at: Date;
  updated_at: Date;
  attendee_id: string;
  attended: boolean;
  acknowledged_at: Date;
  signature_uri: string;
  notes: string;
  total_attendees: string;
  attended_count: string;
}

export default protectedProcedure
  .input(z.object({
    upcoming: z.boolean().optional(),
    assignedOnly: z.boolean().optional(),
  }))
  .query(async ({ input, ctx }) => {
    try {
      const userId = ctx.user.id;

      let query = `
        SELECT 
          tm.*,
          u.name as presenter_name,
          tma.id as attendee_id,
          tma.attended,
          tma.acknowledged_at,
          tma.signature_uri,
          tma.notes,
          (SELECT COUNT(*) FROM toolbox_meeting_attendees WHERE meeting_id = tm.id) as total_attendees,
          (SELECT COUNT(*) FROM toolbox_meeting_attendees WHERE meeting_id = tm.id AND attended = true) as attended_count
        FROM toolbox_meetings tm
        LEFT JOIN users u ON tm.presenter_id = u.id
        LEFT JOIN toolbox_meeting_attendees tma ON tm.id = tma.meeting_id AND tma.user_id = $1
      `;
      
      const params: (string | number)[] = [userId];
      const whereClauses: string[] = [];

      if (input.upcoming) {
        whereClauses.push(`tm.meeting_date >= CURRENT_DATE`);
      }

      // By default, only show meetings assigned to the current user
      const assignedOnly = input.assignedOnly !== false; // default true
      if (assignedOnly) {
        whereClauses.push(`tma.user_id IS NOT NULL`);
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      
      query += ` ORDER BY tm.meeting_date DESC`;
      
      const result = await db.query(query, params);
      
      return result.rows.map((row: MeetingRow) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        meetingDate: row.meeting_date,
        presenterId: row.presenter_id,
        presenterName: row.presenter_name,
        location: row.location,
        safetyTopics: row.safety_topics || [],
        attachments: row.attachments || [],
        isMandatory: row.is_mandatory,
        createdAt: row.created_at.getTime(),
        updatedAt: row.updated_at.getTime(),
        attendee: row.attendee_id ? {
          id: row.attendee_id,
          meetingId: row.id,
          userId: userId,
          attended: row.attended!,
          acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.getTime() : undefined,
          signatureUri: row.signature_uri,
          notes: row.notes,
          createdAt: row.created_at.getTime(),
          updatedAt: row.updated_at.getTime(),
        } : undefined,
        totalAttendees: parseInt(row.total_attendees),
        attendedCount: parseInt(row.attended_count),
      }));
    } catch (error) {
      console.error('Get Meetings Error:', error);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch meetings.' });
    }
  });