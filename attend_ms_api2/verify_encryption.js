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

async function verifyEncryption() {
  try {
    const query = `
      SELECT 
        id,
        "x_Emp_No" AS "employeeNo",
        name,
        password AS "passwordPlain",
        l_password_encrypted AS "passwordEncrypted"
      FROM hr_employee 
      WHERE "x_Emp_No" = 'ARDI-0008'
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log("Employee:", user.employeeNo);
      console.log("Name:", user.name);
      console.log("Plain Password:", user.passwordPlain);
      console.log("Encrypted Password:", user.passwordEncrypted ? "✓ Set" : "✗ Not set");
      if (user.passwordEncrypted) {
        console.log("Encrypted Hash:", user.passwordEncrypted.substring(0, 50) + "...");
      }
    }
    
    pool.end();
  } catch (error) {
    console.error("Error:", error.message);
    pool.end();
  }
}

verifyEncryption();
