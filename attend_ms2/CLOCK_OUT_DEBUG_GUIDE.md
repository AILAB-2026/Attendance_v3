# Clock Out Debugging Guide - AI Attendance App

**Date:** 2025-11-12  
**Issue:** Clock out not working - not stored in DB, not visible in mobile or ERP UI  
**Test Employee:** B1-W422 (SANKAR SAMBATH, ID: 245)

---

## 🔍 Current Status

### Backend Changes Applied:
1. ✅ Fixed timestamp calculation in `/attendance/today` endpoint
2. ✅ Fixed timestamp calculation in `/attendance/history` endpoint  
3. ✅ Added detailed logging to clock-out endpoint
4. ✅ Server restarted with fixes

### What We Need to Debug:
1. Is the mobile app sending the correct `projectName` and `siteName`?
2. Is the backend finding the open clock-in record?
3. Is the database update succeeding?

---

## 🧪 Debug Steps

### Step 1: Run Database Test Script

This will show us the current state of clock-ins for B1-W422:

```bash
cd C:\inetpub\wwwroot\attendance_api_mobile
node test_clock_out.js
```

**What to look for:**
- ✅ Employee found (ID: 245)
- ✅ Open clock-ins (records with no clock_out)
- ✅ Today's attendance records
- ✅ Whether the query would find the record for clock-out

### Step 2: Monitor Server Logs During Clock Out

Watch the terminal where the server is running. When the user tries to clock out, you should see:

```
⏰ Clock Out request received: {
  companyCode: '1',
  employeeNo: 'B1-W422',
  method: 'face' or 'button',
  projectName: 'Civil' or 'NOT PROVIDED',
  siteName: 'tower' or 'NOT PROVIDED',
  ...
}
```

**Check:**
- Is `projectName` being sent? (should match the project from clock-in)
- Is `siteName` being sent?
- Does the backend find the project ID?
- Does the backend find the open clock-in record?

### Step 3: Check Mobile App State

The mobile app tracks clock-in/out state in `sessionSites`. If this state is incorrect, the app might prevent clock-out.

**Potential Issue:** After the timestamp fix, the mobile app might have cached old data that doesn't match the new timestamps.

**Solution:** Force refresh the mobile app:
1. Pull down to refresh on Clock In/Out page
2. Or restart the mobile app completely

---

## 🐛 Possible Issues & Solutions

### Issue 1: Mobile App Not Sending Project Name

**Symptom:** Server logs show `projectName: 'NOT PROVIDED'`

**Cause:** The mobile app might not be passing the `meta` object correctly

**Solution:** Check that the mobile app is calling:
```typescript
await clockOut(method, imageUri, meta, faceTemplateBase64);
```
Where `meta` contains `{ siteName, projectName }`

### Issue 2: Backend Can't Find Open Clock-In

**Symptom:** Server logs show `Total open clockings found: 0`

**Possible Causes:**
1. **Project ID mismatch** - The project name from mobile doesn't match database
2. **Already clocked out** - The record already has a clock_out value
3. **Different date** - The clock_in_date is not today

**Debug:**
Run the test script to see actual database state:
```bash
node test_clock_out.js
```

### Issue 3: Project Name Mismatch

**Symptom:** Mobile sends "Civil" but database has "Civil Project" or different casing

**Solution:** Check the exact project name in database:
```sql
SELECT id, name->>'en_US' as project_name 
FROM project_project 
WHERE active = true
ORDER BY name->>'en_US';
```

Then verify mobile app is sending exact match.

### Issue 4: Cached State in Mobile App

**Symptom:** Mobile app thinks user is clocked out when they're actually clocked in

**Cause:** After timestamp fix, cached data has wrong timestamps

**Solution:**
1. Pull down to refresh on Clock In/Out page
2. Or restart mobile app
3. Or clear app data (Settings > Apps > AI Attendance > Clear Data)

---

## 📊 Expected Server Logs (Successful Clock Out)

```
⏰ Clock Out request received: {
  companyCode: '1',
  employeeNo: 'B1-W422',
  method: 'face',
  projectName: 'Civil',
  siteName: 'tower',
  ...
}

🔍 Looking up project for clock out: Civil
✅ Found project ID for clock out: 2

🔍 Finding open clocking for employee: 245 project: 2
📊 Query result for project 2: [
  {
    id: 123,
    clock_in: '09:49:00',
    clock_in_location: 'tower',
    clock_in_date: 2025-11-12,
    project_id: 2
  }
]
📊 Total open clockings found: 1

✅ Clock out successful: {
  id: 123,
  clock_in: '09:49:00',
  clock_out: '17:30:00'
}
```

---

## 🔧 Manual Database Check

If clock-out still fails, check database directly:

```sql
-- 1. Get employee ID
SELECT id, "x_Emp_No", name, active 
FROM hr_employee 
WHERE "x_Emp_No" = 'B1-W422' AND company_id = 1;
-- Should return: id = 245

-- 2. Check open clock-ins
SELECT 
  ecl.id,
  ecl.clock_in,
  ecl.clock_out,
  ecl.clock_in_date,
  ecl.project_id,
  ecl.clock_in_location,
  pp.name->>'en_US' as project_name
FROM employee_clocking_line ecl
LEFT JOIN project_project pp ON ecl.project_id = pp.id
WHERE ecl.employee_id = 245
  AND ecl.clock_out IS NULL
ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC;

-- 3. Check today's records
SELECT 
  ecl.id,
  ecl.clock_in,
  ecl.clock_out,
  ecl.clock_in_date,
  ecl.clock_out_date,
  ecl.project_id,
  ecl.clock_in_location,
  pp.name->>'en_US' as project_name
FROM employee_clocking_line ecl
LEFT JOIN project_project pp ON ecl.project_id = pp.id
WHERE ecl.employee_id = 245
  AND DATE(ecl.clock_in_date) = CURRENT_DATE
ORDER BY ecl.clock_in DESC;
```

---

## 🚀 Next Actions

1. **Run test script:**
   ```bash
   cd C:\inetpub\wwwroot\attendance_api_mobile
   node test_clock_out.js
   ```

2. **Restart backend server** (if not already done):
   ```bash
   npm start
   ```

3. **Test clock-out on mobile app:**
   - Pull down to refresh Clock In/Out page
   - Try to clock out
   - Watch server terminal for logs

4. **Share the results:**
   - Test script output
   - Server logs during clock-out attempt
   - Any error messages in mobile app

---

## 📝 Files Modified

1. `c:\inetpub\wwwroot\attendance_api_mobile\src\attendanceRoutes.js`
   - Added detailed logging to clock-out endpoint
   - Lines 160-170, 211-235

2. `c:\inetpub\wwwroot\attendance_api_mobile\test_clock_out.js`
   - New test script to check database state

---

**Status:** DEBUGGING IN PROGRESS 🔍  
**Backend:** Updated with detailed logging ✅  
**Test Script:** Created ✅  
**Next:** Run test script and monitor server logs during clock-out attempt
