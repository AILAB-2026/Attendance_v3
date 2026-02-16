import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import { TRPCError } from "@trpc/server";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional();

export default protectedProcedure
  .input(z.object({
    empNo: z.string().trim(),
    startDate: dateSchema,
    endDate: dateSchema,
  }))
  .query(async ({ input, ctx }) => {
    if (input.empNo !== ctx.user.empNo) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Employee number mismatch' });
    }

    try {
      const userResult = await db.query(
        `SELECT u.id, u.emp_no, u.name, c.company_code 
         FROM users u 
         JOIN companies c ON u.company_id = c.id 
         WHERE u.emp_no = $1 AND u.is_active = true AND c.is_active = true`,
        [input.empNo]
      );
      
      if (userResult.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found or inactive' });
      }
      
      const userId = userResult.rows[0].id;
      
      let query = `
        SELECT ad.*, 
          ci.timestamp as clock_in_timestamp, ci.latitude as clock_in_lat, ci.longitude as clock_in_lng, ci.address as clock_in_address, ci.method as clock_in_method, ci.image_uri as clock_in_image,
          co.timestamp as clock_out_timestamp, co.latitude as clock_out_lat, co.longitude as clock_out_lng, co.address as clock_out_address, co.method as clock_out_method, co.image_uri as clock_out_image
        FROM attendance_days ad
        LEFT JOIN clock_events ci ON ad.clock_in_id = ci.id
        LEFT JOIN clock_events co ON ad.clock_out_id = co.id
        WHERE ad.user_id = $1
      `;
      
      const params: (string | number)[] = [userId];
      
      if (input.startDate) {
        query += ` AND ad.date >= $${params.length + 1}`;
        params.push(input.startDate);
      }
      
      if (input.endDate) {
        query += ` AND ad.date <= $${params.length + 1}`;
        params.push(input.endDate);
      }
      
      query += ` ORDER BY ad.date DESC`;
      
      const result = await db.query(query, params);
      
      return result.rows.map((row: {
        id: string;
        user_id: string;
        date: string;
        clock_in_id: string | null;
        clock_out_id: string | null;
        normal_hours: string;
        overtime_hours: string;
        status: string;
        clock_in_timestamp: string | null;
        clock_in_lat: string | null;
        clock_in_lng: string | null;
        clock_in_address: string | null;
        clock_in_method: string | null;
        clock_in_image: string | null;
        clock_out_timestamp: string | null;
        clock_out_lat: string | null;
        clock_out_lng: string | null;
        clock_out_address: string | null;
        clock_out_method: string | null;
        clock_out_image: string | null;
      }) => ({
        date: row.date,
        clockIn: row.clock_in_timestamp ? {
          id: row.clock_in_id!,
          empNo: input.empNo,
          timestamp: parseInt(row.clock_in_timestamp),
          type: 'in' as const,
          location: {
            latitude: parseFloat(row.clock_in_lat!),
            longitude: parseFloat(row.clock_in_lng!),
            address: row.clock_in_address,
          },
          method: row.clock_in_method as 'face' | 'button',
          imageUri: row.clock_in_image,
        } : undefined,
        clockOut: row.clock_out_timestamp ? {
          id: row.clock_out_id!,
          empNo: input.empNo,
          timestamp: parseInt(row.clock_out_timestamp),
          type: 'out' as const,
          location: {
            latitude: parseFloat(row.clock_out_lat!),
            longitude: parseFloat(row.clock_out_lng!),
            address: row.clock_out_address,
          },
          method: row.clock_out_method as 'face' | 'button',
          imageUri: row.clock_out_image,
        } : undefined,
        normalHours: parseFloat(row.normal_hours),
        overtimeHours: parseFloat(row.overtime_hours),
        status: row.status,
      }));
    } catch (error) {
      console.error('Get Attendance Error:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch attendance data.' });
    }
  });