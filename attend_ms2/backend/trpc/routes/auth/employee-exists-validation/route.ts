
import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";

const employeeExistsSchema = z.object({
  companyCode: z.string().trim().min(1, "Company code is required"),
  empNo: z.string().trim().min(1, "Employee number is required"),
});

export default publicProcedure
  .input(employeeExistsSchema)
  .query(async ({ input }) => {
    const { companyCode, empNo } = input;

    try {
      const response = await fetch('/api/Clocking/EmployeeExistsValidation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "strCompanyCode": companyCode,
            "strEmpNo": empNo
        }),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to validate employee existence",
        });
      }

      const data = await response.json();

      return {
        exists: data.success,
        message: data.message,
      };
    } catch (error) {
      console.error("Employee validation error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred during employee validation",
      });
    }
  });
