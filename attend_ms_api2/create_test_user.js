import bcrypt from 'bcrypt';

const password = 'password123';
const saltRounds = 5;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Password: password123');
    console.log('Hashed password:', hash);
    console.log('\nSQL to insert test user:');
    console.log(`INSERT INTO users (emp_no, name, password, company_id, role_id, is_active)`);
    console.log(`VALUES ('AILAB0014', 'Test User', '${hash}', (SELECT id FROM companies WHERE company_code = 'AILAB'), 1, true)`);
    console.log(`ON CONFLICT (emp_no) DO UPDATE SET password = '${hash}';`);
  }
  process.exit(0);
});
