import { query } from "../dbconn.js";
import { getCompanyPool } from "../multiCompanyDb.js";

export const logActivity = async (action, status, remark, metadata) => {
    const { companyCode, employeeNo, userId } = metadata || {};

    const insertQuery = `
      INSERT INTO app_audit_logs 
      (id, action, status, remark, company_code, emp_no, user_id, metadata, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
    `;

    const cleanMetadata = { ...metadata };
    delete cleanMetadata.companyCode;
    delete cleanMetadata.employeeNo;
    delete cleanMetadata.userId;

    const values = [
        action,
        status,
        remark,
        companyCode || null,
        employeeNo || null,
        userId ? String(userId) : null,
        JSON.stringify(cleanMetadata)
    ];

    // 1. Always log to Master DB
    try {
        await query(insertQuery, values);
    } catch (err) {
        console.error(`[AUDIT-MASTER] Failed to write log: ${err.message}`);
    }

    // 2. Also log to Company DB if companyCode is present
    if (companyCode) {
        try {
            const companyPool = await getCompanyPool(companyCode);
            if (companyPool) {
                await companyPool.query(insertQuery, values);
            }
        } catch (err) {
            console.error(`[AUDIT-COMPANY:${companyCode}] Failed to write log: ${err.message}`);
            // Non-fatal, just log to console fallback
            console.log(`[AUDIT-FALLBACK] ${action} - ${status}: ${remark} (Company: ${companyCode})`, metadata);
        }
    }
};
