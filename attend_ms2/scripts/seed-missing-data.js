const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedMissingData() {
  console.log('🌱 Seeding missing data for clock-in functionality...\n');
  
  try {
    // 1. Set user clock method preferences (inherit from company by default)
    console.log('👥 Setting user clock method preferences...');
    await db.query(`
      UPDATE users 
      SET allow_face = true, allow_button = true 
      WHERE allow_face IS NULL OR allow_button IS NULL
    `);
    console.log('✅ Updated user clock method preferences');
    
    // 2. Create schedules for today if missing
    console.log('\n📅 Creating today\'s schedules...');
    const today = new Date().toISOString().split('T')[0];
    
    // Check if schedules exist for today
    const existingSchedules = await db.query('SELECT COUNT(*) as count FROM schedules WHERE date = $1', [today]);
    
    if (existingSchedules.rows[0].count === 0) {
      console.log('Creating schedules for ' + today + '...');
      
      // Get all active users
      const users = await db.query('SELECT id, emp_no, name, company_id FROM users WHERE is_active = true');
      
      // Get sites and projects for assignments
      const sites = await db.query('SELECT id, name as site_name, company_id FROM sites ORDER BY id');
      const projects = await db.query('SELECT id, name as project_name, company_id FROM projects ORDER BY id');
      
      // Create schedules for each user
      for (const user of users.rows) {
        // Find sites and projects for this user's company
        const userSites = sites.rows.filter(s => s.company_id === user.company_id);
        const userProjects = projects.rows.filter(p => p.company_id === user.company_id);
        
        if (userSites.length > 0) {
          // Create basic schedule for each user
          const site = userSites[0];
          
          await db.query(`
            INSERT INTO schedules (user_id, date, start_time, end_time, location)
            VALUES ($1, $2, '09:00', '18:00', $3)
          `, [user.id, today, site.site_name]);
          
          console.log('  ✓ ' + user.name + ' (' + user.emp_no + ') → ' + site.site_name);
        }
      }
    } else {
      console.log('Schedules already exist for today (' + existingSchedules.rows[0].count + ' found)');
    }
    
    // 3. Ensure employee assignments exist
    console.log('\n📝 Checking employee assignments...');
    const assignments = await db.query('SELECT COUNT(*) as count FROM employee_assignments');
    
    if (assignments.rows[0].count === 0) {
      console.log('Creating employee assignments...');
      
      const users = await db.query('SELECT id, emp_no, name, company_id FROM users WHERE is_active = true AND role = \'employee\'');
      const sites = await db.query('SELECT id, name as site_name, company_id FROM sites ORDER BY id');
      const projects = await db.query('SELECT id, name as project_name, company_id FROM projects ORDER BY id');
      
      for (const user of users.rows) {
        const userSites = sites.rows.filter(s => s.company_id === user.company_id);
        const userProjects = projects.rows.filter(p => p.company_id === user.company_id);
        
        if (userSites.length > 0 && userProjects.length > 0) {
          await db.query(`
            INSERT INTO employee_assignments (user_id, site_id, project_id, start_date)
            VALUES ($1, $2, $3, $4)
          `, [user.id, userSites[0].id, userProjects[0].id, today]);
          
          console.log('  ✓ Assigned ' + user.name + ' to ' + userSites[0].site_name + ' / ' + userProjects[0].project_name);
        }
      }
    } else {
      console.log('Employee assignments already exist (' + assignments.rows[0].count + ' found)');
    }
    
    // 4. Create project tasks for better testing
    console.log('\n📋 Creating project tasks...');
    const projects = await db.query('SELECT id, name as project_name FROM projects');
    
    for (const project of projects.rows) {
      // Check if tasks exist for this project
      const existingTasks = await db.query('SELECT COUNT(*) as count FROM project_tasks WHERE project_id = $1', [project.id]);
      
      if (existingTasks.rows[0].count === 0) {
        const tasks = [
          { name: 'Safety Inspection', status: 'pending' },
          { name: 'Equipment Check', status: 'in-progress' },
          { name: 'Documentation Review', status: 'done' },
          { name: 'Quality Audit', status: 'pending' }
        ];
        
        for (const task of tasks) {
          await db.query(`
            INSERT INTO project_tasks (project_id, name, status, description)
            VALUES ($1, $2, $3, $4)
          `, [project.id, task.name, task.status, 'Auto-generated task for ' + project.project_name]);
        }
        
        console.log('  ✓ Created tasks for ' + project.project_name);
      }
    }
    
    // 5. Verify the setup
    console.log('\n🔍 Verifying setup...');
    
    const userCount = await db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    const scheduleCount = await db.query('SELECT COUNT(*) as count FROM schedules WHERE date = $1', [today]);
    const assignmentCount = await db.query('SELECT COUNT(*) as count FROM employee_assignments');
    const taskCount = await db.query('SELECT COUNT(*) as count FROM project_tasks');
    
    console.log('📊 Summary:');
    console.log('  Active Users: ' + userCount.rows[0].count);
    console.log('  Today\'s Schedules: ' + scheduleCount.rows[0].count);
    console.log('  Employee Assignments: ' + assignmentCount.rows[0].count);
    console.log('  Project Tasks: ' + taskCount.rows[0].count);
    
    // Show sample data for testing
    console.log('\n📋 Sample data for testing:');
    const sampleUser = await db.query(`
      SELECT u.name, u.emp_no, u.email, s.location, s.start_time, s.end_time,
             ea.site_name, ea.project_name
      FROM users u
      LEFT JOIN schedules s ON u.id = s.user_id AND s.date = $1
      LEFT JOIN employee_assignments ea ON u.id = ea.user_id
      WHERE u.emp_no = 'E001'
      LIMIT 1
    `, [today]);
    
    if (sampleUser.rows.length > 0) {
      const user = sampleUser.rows[0];
      console.log('  User: ' + user.name + ' (' + user.emp_no + ')');
      console.log('  Email: ' + user.email);
      console.log('  Schedule: ' + (user.location || 'No schedule') + ' (' + (user.start_time || 'N/A') + ' - ' + (user.end_time || 'N/A') + ')');
      console.log('  Assignment: ' + (user.site_name || 'No site') + ' / ' + (user.project_name || 'No project'));
      console.log('\n✅ Ready for clock-in testing!');
      console.log('💡 Try logging in as charlie.brown@abccorp.com / employee123');
    }
    
    console.log('\n🎉 Data seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Data seeding failed:', error);
  } finally {
    await db.end();
  }
}

seedMissingData();
