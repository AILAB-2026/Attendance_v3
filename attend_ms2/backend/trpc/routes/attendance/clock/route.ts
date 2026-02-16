import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import { TRPCError } from "@trpc/server";
const fetch = require('node-fetch');

// In-memory lightweight rate limiter per employee no.
// Limits face verification attempts to MAX_ATTEMPTS within WINDOW_MS.
const FACE_VERIFY_RATE: Map<string, { count: number; windowStart: number }> = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;

function rateLimitKey(empNo: string) {
  return `face:${String(empNo).trim()}`;
}

function ensureRateLimit(empNo: string) {
  const key = rateLimitKey(empNo);
  const now = Date.now();
  const entry = FACE_VERIFY_RATE.get(key);
  if (!entry) {
    FACE_VERIFY_RATE.set(key, { count: 1, windowStart: now });
    return;
  }
  // Reset window if expired
  if (now - entry.windowStart > WINDOW_MS) {
    FACE_VERIFY_RATE.set(key, { count: 1, windowStart: now });
    return;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many face verification attempts. Please wait and try again.' });
  }
  entry.count += 1;
}

function isValidImageUri(uri?: string | null): boolean {
  if (!uri) return false;
  const s = String(uri).trim();
  if (!s) return false;
  // Allow https URLs and data URLs with image mime
  if (/^https:\/\//i.test(s)) return true;
  if (/^data:image\/(png|jpeg|jpg);base64,/i.test(s)) return true;
  return false;
}

export default protectedProcedure
  .input(z.object({
    empNo: z.string(),
    type: z.enum(['in', 'out']),
    method: z.enum(['face', 'button']),
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
    imageUri: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    if (input.empNo !== ctx.user.empNo) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT id, company_id FROM users WHERE emp_no = $1 AND is_active = true',
        [input.empNo]
      );

      if (userResult.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      }
      const { id: userId, company_id: companyId } = userResult.rows[0];

      // Face verification for face-based clocking
      if (input.method === 'face') {
        // Basic rate limit to prevent abuse
        ensureRateLimit(input.empNo);

        // Strict validation of provided image
        if (!isValidImageUri(input.imageUri)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'A valid face image is required (HTTPS URL or image data URL).' });
        }

        // Fetch stored face template
        const faceResult = await client.query(
          'SELECT face_template FROM users WHERE id = $1',
          [userId]
        );
        const storedTemplate = faceResult.rows[0]?.face_template;

        // Call face verification webhook or use fallback
        const webhook = process.env.FACE_VERIFY_WEBHOOK;
        const strict = String(process.env.FACE_ENFORCE_STRICT || 'true').toLowerCase() === 'true';
        const threshold = Math.max(0, Math.min(1, parseFloat(String(process.env.FACE_MATCH_THRESHOLD || '0.75')) || 0.75));

        if (!webhook) {
          if (strict) {
            throw new TRPCError({ code: 'FAILED_PRECONDITION', message: 'Face verification service unavailable. Please contact administrator.' });
          } else {
            // Even when not strict, do not auto-approve to avoid unauthorized submissions
            throw new TRPCError({ code: 'FAILED_PRECONDITION', message: 'Face verification service is not configured.' });
          }
        }

        let verified = false;
        try {
          console.log(`[Clock] Calling face verification webhook for user ${userId}`);
          const response = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              imageUri: input.imageUri,
              storedTemplate: storedTemplate ? storedTemplate.toString('base64') : null,
              faceTemplateB64: null
            })
          });
          if (!response.ok) {
            console.warn(`[Clock] Face verification webhook failed: ${response.status}`);
            throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Face verification service error.' });
          }
          const data = await response.json().catch(() => ({}));
          // Expected fields from verifier
          const detected = !!(data.detectedFace ?? data.detected ?? false);
          const live = !!(data.liveness ?? data.live ?? false);
          const score = Number(data.matchScore ?? data.score ?? 0);
          verified = !!data.verified && detected && live && score >= threshold;
          console.log(`[Clock] Face verification result: verified=${verified}, detected=${detected}, live=${live}, score=${score}, threshold=${threshold}`);
          if (!detected) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'No face detected. Ensure your face is fully visible and well-lit.' });
          }
          if (!live) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Liveness check failed. Real person detection required.' });
          }
          if (score < threshold || !verified) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Face mismatch. Please try again ensuring a clear, front-facing photo.' });
          }
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          console.error('[Clock] Face verification error:', err);
          throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Face verification failed due to service error. Please try again.' });
        }
      }

      const companyResult = await client.query(
        'SELECT work_start_time, work_end_time, work_hours_per_day FROM companies WHERE id = $1 AND is_active = true',
        [companyId]
      );

      if (companyResult.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found or inactive.' });
      }
      const companyPolicy = companyResult.rows[0];
      const standardWorkHours = parseFloat(companyPolicy.work_hours_per_day) || 8;

      const timestamp = Date.now();
      const today = new Date().toISOString().split('T')[0];
      
      const clockEventResult = await client.query(
        `INSERT INTO clock_events (user_id, timestamp, type, latitude, longitude, address, method, image_uri)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [userId, timestamp, input.type, input.latitude, input.longitude, input.address, input.method, input.imageUri]
      );
      
      const clockEventId = clockEventResult.rows[0].id;
      
      let attendanceResult = await client.query(
        `SELECT id FROM attendance_days WHERE user_id = $1 AND date = $2`,
        [userId, today]
      );
      
      let attendanceId: string;
      if (attendanceResult.rows.length === 0) {
        const newAttendanceResult = await client.query(
          `INSERT INTO attendance_days (user_id, date, ${input.type === 'in' ? 'clock_in_id' : 'clock_out_id'}) VALUES ($1, $2, $3) RETURNING id`,
          [userId, today, clockEventId]
        );
        attendanceId = newAttendanceResult.rows[0].id;
      } else {
        attendanceId = attendanceResult.rows[0].id;
        await client.query(
          `UPDATE attendance_days SET ${input.type === 'in' ? 'clock_in_id' : 'clock_out_id'} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [clockEventId, attendanceId]
        );
      }
      
      const updatedAttendance = await client.query(
        `SELECT ad.*, 
          ci.timestamp as clock_in_timestamp, ci.latitude as clock_in_lat, ci.longitude as clock_in_lng, ci.address as clock_in_address, ci.method as clock_in_method, ci.image_uri as clock_in_image,
          co.timestamp as clock_out_timestamp, co.latitude as clock_out_lat, co.longitude as clock_out_lng, co.address as clock_out_address, co.method as clock_out_method, co.image_uri as clock_out_image
         FROM attendance_days ad
         LEFT JOIN clock_events ci ON ad.clock_in_id = ci.id
         LEFT JOIN clock_events co ON ad.clock_out_id = co.id
         WHERE ad.id = $1`,
        [attendanceId]
      );
      
      const attendance = updatedAttendance.rows[0];
      
      if (attendance.clock_in_timestamp && attendance.clock_out_timestamp) {
        const inTime = new Date(parseInt(attendance.clock_in_timestamp));
        const outTime = new Date(parseInt(attendance.clock_out_timestamp));
        const diffHours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
        
        const normalHours = Math.min(standardWorkHours, diffHours);
        const overtimeHours = Math.max(0, diffHours - standardWorkHours);
        
        let status = 'present';
        if (companyPolicy.work_start_time) {
          const [startHour, startMinute] = companyPolicy.work_start_time.split(':').map(Number);
          if (inTime.getHours() > startHour || (inTime.getHours() === startHour && inTime.getMinutes() > startMinute)) {
            status = 'late';
          }
        }
        if (companyPolicy.work_end_time) {
          const [endHour, endMinute] = companyPolicy.work_end_time.split(':').map(Number);
          if (outTime.getHours() < endHour || (outTime.getHours() === endHour && outTime.getMinutes() < endMinute)) {
            status = 'early-exit';
          }
        }
        
        await client.query(
          `UPDATE attendance_days SET normal_hours = $1, overtime_hours = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [normalHours, overtimeHours, status, attendanceId]
        );
      } else if (attendance.clock_in_timestamp) {
        await client.query(
          `UPDATE attendance_days SET status = 'present', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [attendanceId]
        );
      }
      
      await client.query('COMMIT');
      
      const finalResultQuery = await client.query(
        `SELECT ad.*, 
          ci.timestamp as clock_in_timestamp, ci.latitude as clock_in_lat, ci.longitude as clock_in_lng, ci.address as clock_in_address, ci.method as clock_in_method, ci.image_uri as clock_in_image,
          co.timestamp as clock_out_timestamp, co.latitude as clock_out_lat, co.longitude as clock_out_lng, co.address as clock_out_address, co.method as clock_out_method, co.image_uri as clock_out_image
         FROM attendance_days ad
         LEFT JOIN clock_events ci ON ad.clock_in_id = ci.id
         LEFT JOIN clock_events co ON ad.clock_out_id = co.id
         WHERE ad.id = $1`,
        [attendanceId]
      );
      
      const result = finalResultQuery.rows[0];
      
      return {
        date: result.date,
        clockIn: result.clock_in_timestamp ? {
          id: result.clock_in_id!,
          userId: userId,
          timestamp: parseInt(result.clock_in_timestamp),
          type: 'in' as const,
          location: {
            latitude: parseFloat(result.clock_in_lat!),
            longitude: parseFloat(result.clock_in_lng!),
            address: result.clock_in_address,
          },
          method: result.clock_in_method as 'face' | 'button',
          imageUri: result.clock_in_image,
        } : undefined,
        clockOut: result.clock_out_timestamp ? {
          id: result.clock_out_id!,
          userId: userId,
          timestamp: parseInt(result.clock_out_timestamp),
          type: 'out' as const,
          location: {
            latitude: parseFloat(result.clock_out_lat!),
            longitude: parseFloat(result.clock_out_lng!),
            address: result.clock_out_address,
          },
          method: result.clock_out_method as 'face' | 'button',
          imageUri: result.clock_out_image,
        } : undefined,
        normalHours: parseFloat(result.normal_hours),
        overtimeHours: parseFloat(result.overtime_hours),
        status: result.status,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Clock Error:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' });
    } finally {
      client.release();
    }
  });