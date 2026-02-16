import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const JWT_EXPIRES_IN = "24h";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

const refreshTokenSchema = z.object({
  refreshToken: z.string().trim(),
});

interface DecodedRefreshToken {
  userId: string;
  type: string;
}

export default publicProcedure
  .input(refreshTokenSchema)
  .mutation(async ({ input }) => {
    const { refreshToken } = input;
    const client = await db.connect();

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as DecodedRefreshToken;
      
      if (decoded.type !== "refresh") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid refresh token",
        });
      }

      await client.query('BEGIN');

      // Find active session with this refresh token
      const sessionQuery = await client.query(`
        SELECT 
          s.id,
          s.user_id,
          s.expires_at,
          u.emp_no,
          u.name,
          u.email,
          u.role,
          u.is_active,
          c.company_code,
          c.company_name
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        JOIN companies c ON u.company_id = c.id
        WHERE s.refresh_token = $1 AND s.is_active = true AND u.is_active = true
      `, [refreshToken]);

      if (sessionQuery.rows.length === 0) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired refresh token",
        });
      }

      const session = sessionQuery.rows[0];

      // Check if session has expired
      if (new Date(session.expires_at) < new Date()) {
        // Invalidate expired session
        await client.query(`
          UPDATE user_sessions 
          SET is_active = false 
          WHERE id = $1
        `, [session.id]);

        await client.query('COMMIT');

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Session has expired",
        });
      }

      // Generate new tokens
      const newSessionToken = jwt.sign(
        { 
          userId: session.user_id, 
          empNo: session.emp_no, 
          role: session.role,
          companyCode: session.company_code 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const newRefreshToken = jwt.sign(
        { userId: session.user_id, type: "refresh" },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
      );

      // Update session with new tokens
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await client.query(`
        UPDATE user_sessions 
        SET session_token = $1, refresh_token = $2, expires_at = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [newSessionToken, newRefreshToken, newExpiresAt, session.id]);

      await client.query('COMMIT');

      return {
        user: {
          id: session.user_id,
          empNo: session.emp_no,
          name: session.name,
          email: session.email,
          role: session.role,
          companyCode: session.company_code,
          companyName: session.company_name,
        },
        sessionToken: newSessionToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt.toISOString(),
      };

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof TRPCError) {
        throw error;
      }
      
      console.error("Refresh token error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred while refreshing token",
      });
    } finally {
      client.release();
    }
  });
