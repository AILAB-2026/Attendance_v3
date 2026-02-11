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

async function debugDatabase() {
  try {
    console.log("=== Database Connection Debug ===");
    console.log("Host:", process.env.DB_HOST);
    console.log("Database:", process.env.DB_NAME);
    console.log("User:", process.env.DB_USER);
    console.log("Port:", process.env.DB_PORT);
    
    // Test basic connection
    console.log("\n1. Testing basic connection...");
    const testResult = await pool.query("SELECT NOW() as current_time");
    console.log("✅ Connection successful:", testResult.rows[0].current_time);
    
    // Check if hr_employee table exists
    console.log("\n2. Checking hr_employee table...");
    try {
      const hrEmployeeCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = 'hr_employee'
      `);
      
      if (hrEmployeeCheck.rows[0].count > 0) {
        console.log("✅ hr_employee table exists");
        
        // Check if employee B1-W422 exists
        console.log("\n3. Checking for employee B1-W422...");
        const employeeCheck = await pool.query(`
          SELECT 
            id, 
            "x_Emp_No" as employee_no, 
            name, 
            company_id, 
            active 
          FROM hr_employee 
          WHERE LOWER("x_Emp_No") = LOWER($1)
        `, ['B1-W422']);
        
        if (employeeCheck.rows.length > 0) {
          console.log("✅ Employee B1-W422 found:");
          employeeCheck.rows.forEach(emp => {
            console.log(`  ID: ${emp.id}, Name: ${emp.name}, Company: ${emp.company_id}, Active: ${emp.active}`);
          });
        } else {
          console.log("❌ Employee B1-W422 not found");
          
          // Show sample employees
          const sampleEmployees = await pool.query(`
            SELECT 
              id, 
              "x_Emp_No" as employee_no, 
              name, 
              company_id, 
              active 
            FROM hr_employee 
            WHERE company_id = 1 
            ORDER BY id 
            LIMIT 5
          `);
          
          console.log("\n📋 Sample employees in company 1:");
          sampleEmployees.rows.forEach(emp => {
            console.log(`  ${emp.employee_no} - ${emp.name} (ID: ${emp.id}, Active: ${emp.active})`);
          });
        }
        
      } else {
        console.log("❌ hr_employee table does not exist");
      }
    } catch (error) {
      console.log("❌ Error checking hr_employee table:", error.message);
    }
    
    // Check hr_employee_roles table
    console.log("\n4. Checking hr_employee_roles table...");
    try {
      const rolesCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = 'hr_employee_roles'
      `);
      
      if (rolesCheck.rows[0].count > 0) {
        console.log("✅ hr_employee_roles table exists");
      } else {
        console.log("❌ hr_employee_roles table does not exist");
      }
    } catch (error) {
      console.log("❌ Error checking hr_employee_roles table:", error.message);
    }
    
    // Check res_company table
    console.log("\n5. Checking res_company table...");
    try {
      const companyCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = 'res_company'
      `);
      
      if (companyCheck.rows[0].count > 0) {
        console.log("✅ res_company table exists");
        
        // Check company 1
        const company1Check = await pool.query(`
          SELECT id, name 
          FROM res_company 
          WHERE id = 1
        `);
        
        if (company1Check.rows.length > 0) {
          console.log(`✅ Company 1 exists: ${company1Check.rows[0].name}`);
        } else {
          console.log("❌ Company with ID 1 does not exist");
        }
      } else {
        console.log("❌ res_company table does not exist");
      }
    } catch (error) {
      console.log("❌ Error checking res_company table:", error.message);
    }
    
    pool.end();
    
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.error("Error code:", error.code);
    pool.end();
  }
}

debugDatabase();
