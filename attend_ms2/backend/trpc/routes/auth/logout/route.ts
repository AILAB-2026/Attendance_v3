import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";
import { TRPCError } from "@trpc/server";

const logoutSchema = z.object({
  sessionToken: z.string().trim(),
});

export default protectedProcedure
  .input(logoutSchema)
  .mutation(async ({ input, ctx }) => {
    const { sessionToken } = input;
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Invalidate the session in database
      const result = await client.query(`
        UPDATE user_sessions 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE session_token = $1 AND user_id = $2 AND is_active = true
      `, [sessionToken, ctx.user.userId]);

      if (result.rowCount === 0) {
        // This could mean the session is already inactive or doesn't exist.
        // For logout, we can consider this a successful outcome to avoid user confusion.
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: "Logged out successfully",
      };

    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof TRPCError) {
        throw error;
      }
      
      console.error("Logout error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred during logout",
      });
    } finally {
      client.release();
    }
  });
