import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function findEmployee() {
  try {
    console.log("=== Finding Employee B1-W422 ===");
    
    // Test connection
    await pool.query("SELECT 1");
    console.log("✅ Database connected");
    
    const employeeNo = "B1-W422";
    const companyCode = 1;
    
    // Search for the employee using the correct column names
    console.log(`\nSearching for: ${employeeNo} in company ${companyCode}`);
    
    const searchQuery = `
      SELECT 
        id,
        "x_Emp_No" as employee_no,
        name,
        company_id,
        active
      FROM hr_employee 
      WHERE "x_Emp_No" = $1
        AND company_id = $2
    `;
    
    const result = await pool.query(searchQuery, [employeeNo, companyCode]);
    
    if (result.rows.length > 0) {
      console.log("✅ Employee found:");
      result.rows.forEach(emp => {
        console.log(`  ID: ${emp.id}`);
        console.log(`  Employee Number: ${emp.employee_no}`);
        console.log(`  Name: ${emp.name}`);
        console.log(`  Company ID: ${emp.company_id}`);
        console.log(`  Active: ${emp.active}`);
      });
    } else {
      console.log("❌ Employee not found with exact match");
      
      // Try case-insensitive search
      console.log("\n🔍 Trying case-insensitive search...");
      const caseInsensitiveResult = await pool.query(`
        SELECT 
          id,
          "x_Emp_No" as employee_no,
          name,
          company_id,
          active
        FROM hr_employee 
        WHERE LOWER("x_Emp_No") = LOWER($1)
          AND company_id = $2
      `, [employeeNo, companyCode]);
      
      if (caseInsensitiveResult.rows.length > 0) {
        console.log("✅ Employee found with case-insensitive search:");
        caseInsensitiveResult.rows.forEach(emp => {
          console.log(`  ID: ${emp.id}`);
          console.log(`  Employee Number: ${emp.employee_no}`);
          console.log(`  Name: ${emp.name}`);
          console.log(`  Company ID: ${emp.company_id}`);
          console.log(`  Active: ${emp.active}`);
        });
      } else {
        console.log("❌ Employee not found even with case-insensitive search");
        
        // Search without company filter
        console.log("\n🔍 Searching without company filter...");
        const noCompanyResult = await pool.query(`
          SELECT 
            id,
            "x_Emp_No" as employee_no,
            name,
            company_id,
            active
          FROM hr_employee 
          WHERE LOWER("x_Emp_No") = LOWER($1)
        `, [employeeNo]);
        
        if (noCompanyResult.rows.length > 0) {
          console.log("✅ Employee found in different company:");
          noCompanyResult.rows.forEach(emp => {
            console.log(`  ID: ${emp.id}`);
            console.log(`  Employee Number: ${emp.employee_no}`);
            console.log(`  Name: ${emp.name}`);
            console.log(`  Company ID: ${emp.company_id}`);
            console.log(`  Active: ${emp.active}`);
          });
        } else {
          console.log("❌ Employee B1-W422 does not exist in the database");
          
          // Show employees in company 1
          console.log("\n📋 Employees in company 1:");
          const company1Result = await pool.query(`
            SELECT 
              id,
              "x_Emp_No" as employee_no,
              name,
              active
            FROM hr_employee 
            WHERE company_id = $1
            ORDER BY id
            LIMIT 10
          `, [companyCode]);
          
          company1Result.rows.forEach(emp => {
            console.log(`  ${emp.employee_no} - ${emp.name} (ID: ${emp.id}, Active: ${emp.active})`);
          });
        }
      }
    }
    
    pool.end();
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Error code:", error.code);
    pool.end();
  }
}

findEmployee();
