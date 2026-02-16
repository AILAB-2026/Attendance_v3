const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixClockInData() {
  console.log('🔧 Fixing clock-in data for proper functionality...\n');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. First, let's see what we have
    console.log('🔍 Current data status:');
    
    const sites = await db.query('SELECT id, name, company_id FROM sites ORDER BY company_id, name');
    console.log('Sites available:');
    sites.rows.forEach(site => {
      console.log('  ' + site.id + ': ' + site.name + ' (Company: ' + site.company_id + ')');
    });
    
    const projects = await db.query('SELECT id, name, company_id FROM projects ORDER BY company_id, name');
    console.log('\nProjects available:');
    projects.rows.forEach(project => {
      console.log('  ' + project.id + ': ' + project.name + ' (Company: ' + project.company_id + ')');
    });
    
    // 2. Fix employee assignments to have proper site_id references
    console.log('\n📝 Fixing employee assignments...');
    
    const assignments = await db.query(`
      SELECT ea.id, ea.user_id, ea.site_id, ea.project_id, ea.site_name, ea.project_name,
             u.name as user_name, u.emp_no, u.company_id
      FROM employee_assignments ea
      JOIN users u ON ea.user_id = u.id
      WHERE ea.site_id IS NULL OR ea.project_id IS NULL
    `);
    
    for (const assignment of assignments.rows) {
      console.log('Fixing assignment for ' + assignment.user_name + ' (' + assignment.emp_no + ')');
      
      // Find a site for this user's company
      const companySites = sites.rows.filter(s => s.company_id === assignment.company_id);
      const companyProjects = projects.rows.filter(p => p.company_id === assignment.company_id);
      
      if (companySites.length > 0 && companyProjects.length > 0) {
        const site = companySites[0];
        const project = companyProjects[0];
        
        // Update only if site_id or project_id is null
        if (!assignment.site_id || !assignment.project_id) {
          await db.query(`
            UPDATE employee_assignments 
            SET site_id = COALESCE(site_id, $1), 
                project_id = COALESCE(project_id, $2), 
                site_name = COALESCE(site_name, $3), 
                project_name = COALESCE(project_name, $4)
            WHERE id = $5
          `, [site.id, project.id, site.name, project.name, assignment.id]);
          
          console.log('  ✓ Updated: ' + site.name + ' / ' + project.name);
        } else {
          console.log('  ✓ Already has assignment: ' + assignment.site_name + ' / ' + assignment.project_name);
        }
      }
    }
    
    // 3. Create today's schedules with proper site/project info if missing
    console.log('\n📅 Ensuring proper schedules for today...');
    
    const users = await db.query('SELECT id, name, emp_no, company_id FROM users WHERE is_active = true');
    
    for (const user of users.rows) {
      // Check if user has schedule for today
      const existingSchedule = await db.query('SELECT id FROM schedules WHERE user_id = $1 AND date = $2', [user.id, today]);
      
      if (existingSchedule.rows.length === 0) {
        // Create schedule for this user
        const companySites = sites.rows.filter(s => s.company_id === user.company_id);
        
        if (companySites.length > 0) {
          await db.query(`
            INSERT INTO schedules (user_id, date, start_time, end_time, location)
            VALUES ($1, $2, '09:00', '18:00', $3)
          `, [user.id, today, companySites[0].name]);
          
          console.log('  ✓ Created schedule for ' + user.name + ' at ' + companySites[0].name);
        }
      }
    }
    
    // 4. Create project tasks if missing
    console.log('\n📋 Creating project tasks...');
    
    for (const project of projects.rows) {
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
          `, [project.id, task.name, task.status, 'Task for ' + project.name]);
        }
        
        console.log('  ✓ Created tasks for ' + project.name);
      }
    }
    
    // 5. Final verification
    console.log('\n🔍 Final verification...');
    
    const testUser = await db.query(`
      SELECT u.name, u.emp_no, u.email, u.allow_face, u.allow_button,
             s.location, s.start_time, s.end_time,
             ea.site_name, ea.project_name,
             sites.name as actual_site_name,
             projects.name as actual_project_name
      FROM users u
      LEFT JOIN schedules s ON u.id = s.user_id AND s.date = $1
      LEFT JOIN employee_assignments ea ON u.id = ea.user_id
      LEFT JOIN sites ON ea.site_id = sites.id
      LEFT JOIN projects ON ea.project_id = projects.id
      WHERE u.emp_no = 'E001'
      LIMIT 1
    `, [today]);
    
    if (testUser.rows.length > 0) {
      const user = testUser.rows[0];
      console.log('📋 Test User Data (E001):');
      console.log('  Name: ' + user.name);
      console.log('  Email: ' + user.email);
      console.log('  Clock Methods - Face: ' + user.allow_face + ', Button: ' + user.allow_button);
      console.log('  Schedule: ' + (user.location || 'No location') + ' (' + (user.start_time || 'N/A') + ' - ' + (user.end_time || 'N/A') + ')');
      console.log('  Assignment Site: ' + (user.site_name || 'No site'));
      console.log('  Assignment Project: ' + (user.project_name || 'No project'));
      console.log('  Actual Site: ' + (user.actual_site_name || 'No site'));
      console.log('  Actual Project: ' + (user.actual_project_name || 'No project'));
      
      // Check if user can clock in
      const canClockIn = user.allow_face || user.allow_button;
      const hasAssignment = user.actual_site_name && user.actual_project_name;
      
      console.log('\n✅ Clock-in Status:');
      console.log('  Can use clock methods: ' + (canClockIn ? 'YES' : 'NO'));
      console.log('  Has site/project assignment: ' + (hasAssignment ? 'YES' : 'NO'));
      console.log('  Ready for clock-in: ' + (canClockIn && hasAssignment ? 'YES ✅' : 'NO ❌'));
      
      if (canClockIn && hasAssignment) {
        console.log('\n🎉 SUCCESS! User E001 is ready for clock-in testing');
        console.log('💡 Login: charlie.brown@abccorp.com / employee123');
        console.log('📍 Expected site/project: ' + user.actual_site_name + ' / ' + user.actual_project_name);
      }
    }
    
    // Show summary
    const summary = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM schedules WHERE date = $1) as todays_schedules,
        (SELECT COUNT(*) FROM employee_assignments WHERE site_id IS NOT NULL AND project_id IS NOT NULL) as complete_assignments,
        (SELECT COUNT(*) FROM project_tasks) as total_tasks
    `, [today]);
    
    const stats = summary.rows[0];
    console.log('\n📊 Final Summary:');
    console.log('  Active Users: ' + stats.active_users);
    console.log('  Today\'s Schedules: ' + stats.todays_schedules);
    console.log('  Complete Assignments: ' + stats.complete_assignments);
    console.log('  Project Tasks: ' + stats.total_tasks);
    
    console.log('\n🎉 Clock-in data fix completed!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await db.end();
  }
}

fixClockInData();
