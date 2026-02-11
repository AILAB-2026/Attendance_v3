
import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const masterPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'attendance_db',
});

async function insertMappings() {
    const client = await masterPool.connect();
    try {
        console.log("=== Inserting Schema Mappings ===\n");

        // BRK: Uses employee_payslip table (simple_table)
        const mapBRK = {
            type: "simple_table",
            table: "employee_payslip",
            id_column: "employee_id",
            columns: {
                id: "id",
                employeeId: "employee_id",
                employeeName: "employee_name",
                empNo: "x_emp_no",
                payYear: "pay_year",
                month: "month",
                payslipPeriod: "payslip_period",
                payDate: "x_pay_date",
                basicSalary: "x_basic_salary",
                allowance: "x_allowance",
                deduction: "deduction_amount",
                grossPay: "gross_pay_amount",
                netPay: "net_pay_amount",
                payslipUrl: "payslipurl",
                status: "status",
                createDate: "create_date"
            }
        };

        // SKK: Uses tbl_trans_payroll with JOIN to hr_employee (raw_sql)
        const mapSKK = {
            type: "raw_sql",
            query: `
        SELECT 
            t.id,
            e.id as "employeeId",
            t.empname as "employeeName",
            t.emp_no as "empNo", 
            CAST(t.pr_year AS INTEGER) as "payYear",
            t.pr_month as "month",
            t.pr_month || '-' || t.pr_year as "payslipPeriod",
            t.created_on as "payDate",
            t.tot_basic_payable as "basicSalary",
            t.alloawance_amount as "allowance",
            t.deduction_amount as "deduction",
            t.total_payable as "grossPay",
            t.grand_total_payable as "netPay",
            t.csv_filepath as "payslipUrl",
            COALESCE(t.pr_status, 'Processed') as "status",
            t.created_on as "createDate"
        FROM tbl_trans_payroll t
        JOIN hr_employee e ON t.emp_no = e."x_Emp_No"
        WHERE e.id = $1
        ORDER BY t.pr_year DESC, t.pr_month DESC
        LIMIT 12
      `
        };

        // AILAB: Uses standard Odoo tables (hr_payslip + hr_payslip_line) (raw_sql)
        const mapAILAB = {
            type: "raw_sql",
            query: `
        SELECT
          hp.id,
          hp.employee_id as "employeeId",
          he.name as "employeeName",
          he."x_Emp_No" as "empNo",
          CAST(EXTRACT(YEAR FROM hp.date_to) AS INTEGER) as "payYear",
          TRIM(TO_CHAR(hp.date_to, 'Month')) as "month",
          TO_CHAR(hp.date_from, 'DD/MM/YYYY') || ' - ' || TO_CHAR(hp.date_to, 'DD/MM/YYYY') as "payslipPeriod",
          hp.date_to as "payDate",
          COALESCE((SELECT SUM(total) FROM hr_payslip_line WHERE slip_id = hp.id AND code = 'BASIC'), 0) as "basicSalary",
          COALESCE((SELECT SUM(total) FROM hr_payslip_line WHERE slip_id = hp.id AND code IN ('HRA', 'ALW')), 0) as "allowance",
          COALESCE((SELECT SUM(ABS(total)) FROM hr_payslip_line WHERE slip_id = hp.id AND amount < 0), 0) as "deduction",
          COALESCE((SELECT SUM(total) FROM hr_payslip_line WHERE slip_id = hp.id AND code = 'GROSS'), 0) as "grossPay",
          COALESCE((SELECT SUM(total) FROM hr_payslip_line WHERE slip_id = hp.id AND code = 'NET'), 0) as "netPay",
          '' as "payslipUrl",
          hp.state as "status",
          hp.create_date as "createDate"
        FROM hr_payslip hp
        JOIN hr_employee he ON hp.employee_id = he.id
        WHERE hp.employee_id = $1
          AND hp.state IN ('done', 'paid')
        ORDER BY hp.date_to DESC
        LIMIT 12
      `
        };

        // Insert using simple INSERT (table is empty)
        console.log("Inserting BRK...");
        await client.query(
            `INSERT INTO schema_mappings (company_code, endpoint, mapping_json) VALUES ($1, $2, $3)`,
            ['BRK', 'payslips', JSON.stringify(mapBRK)]
        );
        console.log("✅ BRK done.");

        console.log("Inserting SKK...");
        await client.query(
            `INSERT INTO schema_mappings (company_code, endpoint, mapping_json) VALUES ($1, $2, $3)`,
            ['SKK', 'payslips', JSON.stringify(mapSKK)]
        );
        console.log("✅ SKK done.");

        console.log("Inserting AILAB...");
        await client.query(
            `INSERT INTO schema_mappings (company_code, endpoint, mapping_json) VALUES ($1, $2, $3)`,
            ['AILAB', 'payslips', JSON.stringify(mapAILAB)]
        );
        console.log("✅ AILAB done.");

        // Verify
        console.log("\nVerifying...");
        const result = await client.query("SELECT company_code, endpoint, mapping_json->>'type' as type FROM schema_mappings");
        console.table(result.rows);

        console.log("\n✅ All mappings inserted successfully!");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        client.release();
        await masterPool.end();
    }
}

insertMappings();
