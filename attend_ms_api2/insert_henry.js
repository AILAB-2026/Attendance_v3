import dotenv from "dotenv";
dotenv.config();
import { query } from "./src/dbconn.js";

async function insertHenry() {
  try {
    console.log("Inserting new user: Henry\n");
    
    // Check if Henry already exists
    const existing = await query(`
      SELECT id, "x_Emp_No", name
      FROM hr_employee
      WHERE "x_Emp_No" = 'HENRY-001'
    `);
    
    if (existing.rows.length > 0) {
      console.log("❌ User HENRY-001 already exists!");
      console.table(existing.rows);
      console.log("\nIf you want to recreate, delete first:");
      console.log("DELETE FROM hr_employee WHERE \"x_Emp_No\" = 'HENRY-001';");
      process.exit(1);
    }
    
    // Insert Henry
    const result = await query(`
      INSERT INTO hr_employee (
        "x_Emp_No",
        name,
        company_id,
        active,
        password,
        l_role_id,
        ai_enable_clocking
      )
      VALUES (
        'HENRY-001',
        'Henry',
        1,
        true,
        'Test@123',
        null,
        true
      )
      RETURNING id, "x_Emp_No", name, company_id, password;
    `);
    
    console.log("✅ SUCCESS! Henry created!\n");
    console.table(result.rows);
    
    // Get company name
    const company = await query(`
      SELECT name FROM res_company WHERE id = 1
    `);
    
    console.log("\n📱 Login Credentials for Mobile App:");
    console.log("=====================================");
    console.log("Company Code:    1");
    console.log("Company Name:   ", company.rows[0].name);
    console.log("Employee Number: HENRY-001");
    console.log("Password:        Test@123");
    console.log("=====================================\n");
    
    console.log("🎯 Next Steps:");
    console.log("1. Login to mobile app with above credentials");
    console.log("2. Go to Profile → Enroll Facial Auth");
    console.log("3. Capture your face");
    console.log("4. Go to Home → Clock In with face");
    console.log("\n✅ Done!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

insertHenry();
