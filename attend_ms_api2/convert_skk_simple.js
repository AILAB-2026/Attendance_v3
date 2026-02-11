
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

async function convertSKKToSimpleTable() {
    const client = await masterPool.connect();
    try {
        console.log("=== Converting SKK to simple_table format ===\n");

        // 1. Get SKK database connection details
        const companyRes = await client.query("SELECT * FROM companies WHERE company_code = 'SKK'");
        const company = companyRes.rows[0];

        const skkPool = new Pool({
            host: company.server_host === 'localhost' ? '127.0.0.1' : company.server_host,
            port: parseInt(company.server_port || '5432'),
            user: company.server_user,
            password: company.server_password,
            database: company.database_name,
        });

        // 2. Create the VIEW in SKK database
        console.log("1. Creating mobile_payslip_view in SKK database...");
        await skkPool.query(`
      CREATE OR REPLACE VIEW mobile_payslip_view AS
      SELECT
          t.id,
          e.id AS employee_id,
          t.empname AS employee_name,
          t.emp_no AS x_emp_no,
          CAST(t.pr_year AS INTEGER) AS pay_year,
          t.pr_month AS month,
          t.pr_month || '-' || t.pr_year AS payslip_period,
          t.created_on AS x_pay_date,
          t.tot_basic_payable AS x_basic_salary,
          t.alloawance_amount AS x_allowance,
          t.deduction_amount AS deduction_amount,
          t.total_payable AS gross_pay_amount,
          t.grand_total_payable AS net_pay_amount,
          t.csv_filepath AS payslipurl,
          COALESCE(t.pr_status, 'Processed') AS status,
          t.created_on AS create_date
      FROM tbl_trans_payroll t
      JOIN hr_employee e ON t.emp_no = e."x_Emp_No";
    `);
        console.log("   ✅ View created successfully.");
        await skkPool.end();

        // 3. Update SKK mapping to simple_table format (same structure as BRK)
        console.log("\n2. Updating SKK schema mapping to simple_table...");

        const mapSKK = {
            type: "simple_table",
            table: "mobile_payslip_view",
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

        await client.query(
            `UPDATE schema_mappings SET mapping_json = $1 WHERE company_code = 'SKK' AND endpoint = 'payslips'`,
            [JSON.stringify(mapSKK)]
        );
        console.log("   ✅ Mapping updated.");

        // 4. Verify
        console.log("\n3. Verifying mappings...");
        const result = await client.query(
            "SELECT company_code, mapping_json->>'type' as type, mapping_json->>'table' as table FROM schema_mappings WHERE endpoint = 'payslips'"
        );
        console.table(result.rows);

        console.log("\n✅ SKK converted to simple_table format successfully!");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.release();
        await masterPool.end();
    }
}

convertSKKToSimpleTable();
