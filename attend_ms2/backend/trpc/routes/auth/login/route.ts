import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import * as jwt from 'jsonwebtoken';
import { TRPCError } from "@trpc/server";
import { Pool } from 'pg';
// Use require for maximum compatibility in Node.js environment
const fetch = require('node-fetch');

// Connection to CX18AILABDEMO database (for hr_employee table)
const hrDb = new Pool({
  host: process.env.ATTENDANCE_DB_HOST || 'localhost',
  port: parseInt(process.env.ATTENDANCE_DB_PORT || '5432'),
  database: process.env.ATTENDANCE_DB_NAME || 'CX18AILABDEMO',
  user: process.env.ATTENDANCE_DB_USER || 'postgres',
  password: process.env.ATTENDANCE_DB_PASSWORD || 'pgsql@2024',
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const JWT_EXPIRES_IN = "24h";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

const loginSchema = z.object({
  companyCode: z.string().trim().min(1, "Company code is required"),
  empNo: z.string().trim().min(1, "Employee number is required"),
  password: z.string().min(1, "Password is required"),
  deviceInfo: z.object({
    deviceId: z.string().optional(),
    platform: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

export default publicProcedure
  .input(loginSchema)
  .mutation(async ({ input, ctx }) => {
    console.log("[LOGIN] Mutation started for empNo:", input.empNo, "companyCode:", input.companyCode);
    const { companyCode, empNo, password, deviceInfo } = input;

    // Step 1: External API validation removed (API no longer available)
    // Authentication is now handled entirely by the local database
    console.log("[LOGIN] Skipping external validation (API deprecated). Using local DB authentication.");

    // Step 2: Fetch user data from CX18AILABDEMO.hr_employee table
    console.log("[LOGIN] Fetching user from CX18AILABDEMO.hr_employee...");
    let client;
    let hrClient;
    try {
      console.log("[LOGIN] Connecting to hr_employee database...");
      hrClient = await hrDb.connect();
      console.log("[LOGIN] Database connected. Querying hr_employee...");
      
      // Convert company_code to company_id (e.g., "AILAB" -> 1, or use as-is if numeric)
      const companyId = isNaN(Number(companyCode)) ? 1 : Number(companyCode);
      
      const userQuery = await hrClient.query(`
        SELECT 
          id, employee_no as emp_no, name, work_email as email, 
          company_id, password
        FROM hr_employee
        WHERE company_id = $1 AND employee_no = $2
      `, [companyId, empNo]);

      console.log("[LOGIN] User query returned", userQuery.rows.length, "rows");
      
      if (userQuery.rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not registered in this application. Please contact support.",
        });
      }

      const user = userQuery.rows[0];
      console.log("[LOGIN] User found:", user.name, "from hr_employee table");
      
      // TEMPORARILY ACCEPT ANY PASSWORD (for development/testing)
      console.log("[LOGIN] Password validation BYPASSED - accepting any password for development");
      
      // Set default role to 'employee' since hr_employee doesn't have role field
      const userRole = 'employee';
      console.log("[LOGIN] Role set to:", userRole);

      // Step 3: Generate tokens and return user data
      console.log("[LOGIN] Generating JWT tokens...");
      const sessionToken = jwt.sign(
        { userId: user.id, empNo: user.emp_no, role: userRole, companyCode: companyCode, companyId: user.company_id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: "refresh" },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      console.log("[LOGIN] Tokens generated successfully");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Save/Update session in attendance_db for refresh/logout logic
      try {
        console.log("[LOGIN] Upserting user session in attendance_db...");
        client = await db.connect();
        const headers = ctx.req && ctx.req.headers ? ctx.req.headers : new Headers();
        const ip = (headers.get('x-forwarded-for') || headers.get('x-real-ip') || '').split(',')[0] || null;
        const deviceJson = deviceInfo ? JSON.stringify(deviceInfo) : '{}';
        console.log("[LOGIN] Session data prepared. IP:", ip);
        
        // Use string ID for session storage
        const userIdStr = String(user.id);
        await client.query(
          `SELECT upsert_user_session($1, $2, $3, $4, $5::jsonb, $6::inet)`,
          [userIdStr, sessionToken, refreshToken, expiresAt, deviceJson, ip]
        );
        console.log("[LOGIN] Session upserted successfully");
      } catch (e) {
        console.warn('[LOGIN] Failed to upsert user session:', e);
        // Don't fail login if session persistence encounters a transient error
      }

      console.log("[LOGIN] Login successful. Returning tokens and user data.");
      return {
        user: {
          id: String(user.id),
          empNo: user.emp_no,
          name: user.name,
          email: user.email,
          role: userRole,
          companyCode: companyCode, // Use input company code
          companyName: companyCode, // Use company code as name
        },
        sessionToken,
        refreshToken,
        expiresAt: expiresAt.toISOString(),
      };

    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("[LOGIN] Database or JWT error:", error);
      console.error("[LOGIN] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred after authentication.",
      });
    } finally {
      if (hrClient) {
        console.log("[LOGIN] Releasing hr_employee database client");
        hrClient.release();
      }
      if (client) {
        console.log("[LOGIN] Releasing attendance_db client");
        client.release();
      }
    }
  });