import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { db } from "../../../../db/connection";

export default protectedProcedure
  .input(z.object({ empNo: z.string().optional() }))
  .query(async ({ input, ctx }) => {
    const empNo = input.empNo || ctx.user.empNo;

    if (!empNo) {
      throw new Error('User not found');
    }

    const result = await db.query(
      `SELECT 
        u.id, u.name, u.email, u.profile_image_uri, u.role,
        u.annual_leave_balance, u.medical_leave_balance, 
        u.emergency_leave_balance, u.unpaid_leave_balance,
        c.company_code, c.company_name
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.emp_no = $1 AND u.is_active = true`,
      [empNo]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0] as {
      id: string;
      name: string;
      email: string;
      profile_image_uri: string | null;
      role: string;
      annual_leave_balance: number;
      medical_leave_balance: number;
      emergency_leave_balance: number;
      unpaid_leave_balance: number;
      company_code: string;
      company_name: string;
    };

    return {
      id: user.id,
      empNo: empNo,
      name: user.name,
      email: user.email,
      profileImageUri: user.profile_image_uri,
      role: user.role,
      companyCode: user.company_code,
      companyName: user.company_name,
      leaveBalance: {
        annual: user.annual_leave_balance,
        medical: user.medical_leave_balance,
        emergency: user.emergency_leave_balance,
        unpaid: user.unpaid_leave_balance,
      },
    };
  });