# AI Attend - User Guide

**Version:** 2.0  
**Last Updated:** January 2, 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
   - [Installation](#installation)
   - [Logging In](#logging-in)
3. [Home Screen - Clock In/Out](#home-screen---clock-inout)
   - [Quick Clock (Button)](#quick-clock-button)
   - [Facial Recognition Clock](#facial-recognition-clock)
   - [Site & Project Selection](#site--project-selection)
4. [History](#history)
   - [Viewing Attendance Records](#viewing-attendance-records)
   - [Filtering Records](#filtering-records)
   - [Understanding Status Indicators](#understanding-status-indicators)
5. [Leave Management](#leave-management)
   - [Viewing Leave Balance](#viewing-leave-balance)
   - [Submitting a Leave Request](#submitting-a-leave-request)
   - [Tracking Leave Status](#tracking-leave-status)
   - [Leave Types](#leave-types)
6. [Schedule & Assignments](#schedule--assignments)
   - [Viewing Your Schedule](#viewing-your-schedule)
   - [Calendar Navigation](#calendar-navigation)
   - [Filtering by Status](#filtering-by-status)
   - [Managing Tasks](#managing-tasks)
7. [Payroll](#payroll)
   - [Viewing Payslips](#viewing-payslips)
   - [Downloading Payslips](#downloading-payslips)
8. [Reports](#reports)
   - [Attendance Statistics](#attendance-statistics)
   - [Date Range Selection](#date-range-selection)
   - [Exporting Reports](#exporting-reports)
9. [Manager Features](#manager-features)
   - [Employee Management](#employee-management)
   - [Leave Approvals](#leave-approvals)
   - [Attendance Corrections](#attendance-corrections)
   - [Activity Logs](#activity-logs)
   - [Assignment Sync](#assignment-sync)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Introduction

**AI Attend** is a modern, AI-powered mobile attendance management application designed to streamline employee time tracking. The app offers multiple ways to clock in and out, including secure **facial recognition** technology, and provides comprehensive tools for leave management, schedule tracking, and payroll access.

### Key Features

- ✅ **Dual Clock Methods**: Quick button clock OR secure facial recognition
- 🔒 **Liveness Detection**: Anti-spoofing technology prevents photo/video attacks
- 📊 **Real-time Attendance Tracking**: View your complete attendance history
- 🗓️ **Leave Management**: Submit, track, and manage leave requests
- 📋 **Schedule & Projects**: View assigned projects and tasks
- 💰 **Payroll Access**: View and download payslips
- 📈 **Detailed Reports**: Attendance statistics and analytics
- 👔 **Manager Dashboard**: Approve leaves, manage employees, view logs

---

## Getting Started

### Installation

1. **Android**: Download the APK file or install via your company's app distribution channel
2. **iOS**: Install via TestFlight or your company's MDM solution
3. **Expo Go (Development)**: Scan the QR code from your Expo development server

### Logging In

<p align="center">
  <strong>Login Screen</strong>
</p>

1. **Open the AI Attend app**
2. Enter your credentials:
   - **Company Code**: Your organization's unique identifier (e.g., `BRK`, `SKK`)
   - **Employee Number**: Your employee ID (e.g., `EMP-001`)
   - **Password**: Your account password
3. Tap **Sign In**

> 💡 **Tip**: Your credentials are provided by your HR department or system administrator.

If you forget your password, contact your manager or HR department for a password reset.

---

## Home Screen - Clock In/Out

The home screen is your primary interface for recording attendance. It displays:

- Your **profile picture** and **name**
- Your **employee number** and **company**
- Current **clock status** (Clocked In / Clocked Out)
- Today's **clock-in time** and **total working hours**

### Quick Clock (Button)

The simplest way to record your attendance:

1. **Clock In**:
   - Tap the **Clock In** button (blue)
   - If required, select your **Site** and **Project**
   - Your location will be recorded automatically

2. **Clock Out**:
   - Tap the **Clock Out** button (red)
   - Confirm your clock-out action
   - Your total working hours for the day will be calculated

### Facial Recognition Clock

For enhanced security, use facial recognition:

1. Tap the **📷 Face** button next to Clock In/Out
2. Position your face within the **oval guide**
3. Look directly at the camera
4. Keep still while the system scans your face
5. Wait for verification:
   - ✅ **Green checkmark**: Face verified successfully
   - ❌ **Red X**: Verification failed

> 🔒 **Security Features**:
> - **Multi-frame capture**: The system takes 3 photos to ensure you're a live person
> - **Liveness detection**: Prevents spoofing with photos, videos, or masks
> - **Face matching**: Verifies your identity against your registered face template

### Site & Project Selection

If your organization uses site-based attendance:

1. Before clocking in/out, a modal will appear
2. Select your **Work Site** from the dropdown
3. Select your **Project** (if applicable)
4. Confirm your selection
5. Proceed with clock-in or clock-out

---

## History

The History tab provides a complete record of your attendance.

### Viewing Attendance Records

1. Tap the **History** tab at the bottom
2. Records are grouped by date (most recent first)
3. Each record shows:
   - 📅 **Date**
   - ⏰ **Clock-in** and **Clock-out** times
   - ⏱️ **Total hours** worked
   - 📍 **Site/Project** information
   - 🟢 **Status** indicator

### Filtering Records

Use the **date range picker** to filter records:

| Preset | Description |
|--------|-------------|
| **Today** | View today's records only |
| **This Month** | Current month's records |
| **Last Month** | Previous month's records |
| **Last 30 Days** | Rolling 30-day window |
| **Custom** | Select specific start/end dates |

### Understanding Status Indicators

| Status | Color | Description |
|--------|-------|-------------|
| **Present** | 🟢 Green | Full attendance, on-time |
| **Late** | 🟡 Yellow | Clocked in after scheduled start time |
| **Early Exit** | 🟠 Orange | Clocked out before scheduled end time |
| **Absent** | 🔴 Red | No attendance recorded |
| **Leave** | 🔵 Blue | Approved leave day |
| **Holiday** | 🟣 Purple | Public holiday |

---

## Leave Management

Manage your time-off requests directly from the app.

### Viewing Leave Balance

At the top of the Leave screen, you'll see your **remaining leave balances**:

| Leave Type | Description |
|------------|-------------|
| **Annual Leave** | Paid vacation days |
| **Medical Leave** | Sick leave / health-related absences |
| **Emergency Leave** | Urgent personal matters |
| **Unpaid Leave** | Leave without pay |

### Submitting a Leave Request

1. Tap the **Leave** tab
2. Tap the **+ Request Leave** button (floating action button)
3. Fill in the leave request form:
   - **Leave Type**: Select from dropdown
   - **Start Date**: When your leave begins
   - **End Date**: When your leave ends
   - **Reason**: Brief description of why you need leave
   - **Attachment** (optional): Upload supporting documents (e.g., medical certificate)
4. Tap **Submit**
5. Your request will be sent to your manager for approval

### Tracking Leave Status

Your leave requests are displayed in a list with status indicators:

| Status | Description |
|--------|-------------|
| ⏳ **Pending** | Awaiting manager approval |
| ✅ **Approved** | Leave request approved |
| ❌ **Rejected** | Leave request denied (reason provided) |

Tap on any leave request to view full details, including:
- Date range and duration
- Reason for leave
- Attachments
- Rejection reason (if applicable)
- Approver name and approval date

### Leave Types

| Type | Description | Typical Allowance |
|------|-------------|-------------------|
| **Annual** | Vacation / personal time | Varies by company policy |
| **Medical** | Health-related absences | Usually requires documentation after 2+ days |
| **Emergency** | Urgent unforeseen circumstances | Limited allocation |
| **Unpaid** | Leave without salary deduction | No fixed limit, requires approval |

---

## Schedule & Assignments

Track your work assignments and project schedules.

### Viewing Your Schedule

1. Tap the **Schedule** tab
2. Your assigned projects appear in a list
3. Each assignment shows:
   - 📁 **Project Name**
   - 🏢 **Site/Location**
   - 📅 **Start Date** - **End Date**
   - Current **Status** (Active/Upcoming/Past)

### Calendar Navigation

- **Swipe left/right** or use arrows to navigate between dates
- Tap on any date in the calendar to view assignments for that day
- The **badge** on the tab icon shows pending tasks

### Filtering by Status

| Filter | Shows |
|--------|-------|
| **All** | All assignments regardless of status |
| **Active** | Currently active assignments |
| **Upcoming** | Future assignments |
| **Past** | Completed assignments |
| **With Tasks** | Assignments with pending tasks |

### Managing Tasks

If your assignments have associated tasks:

1. Tap on an assignment to expand it
2. View the list of tasks with their status
3. Tap on a task to view details
4. Mark tasks as complete when finished
5. Tasks can be filtered by status: Todo, In Progress, Done

---

## Payroll

Access your payslips directly from the app.

> ℹ️ **Note**: The Payroll tab is only visible if enabled for your account.

### Viewing Payslips

1. Tap the **Payroll** tab
2. Your payslips are listed by pay period
3. Each payslip card shows:
   - 📅 **Pay Period** (e.g., "Jan 2026")
   - 💵 **Gross Pay**
   - ➕ **Allowances**
   - ➖ **Deductions**
   - 💰 **Net Pay**

### Downloading Payslips

1. Tap on a payslip card
2. Tap the **Download** button
3. The PDF payslip will open in your device's browser or PDF viewer
4. Save or share the document as needed

---

## Reports

View detailed analytics about your attendance.

### Attendance Statistics

The Reports screen provides:

- **Total Days**: Working days in the selected period
- **Present Days**: Days you attended
- **Absent Days**: Days you were absent
- **Late Arrivals**: Number of late clock-ins
- **Early Exits**: Number of early clock-outs
- **Leave Days**: Days on approved leave

**Visual Charts**:
- 📊 **Donut chart**: Status distribution breakdown
- 📈 **Weekly/Monthly trends**: Hours worked over time

### Date Range Selection

| Preset | Time Range |
|--------|------------|
| **Today** | Current day |
| **This Month** | Current calendar month |
| **Last Month** | Previous calendar month |
| **Last 30 Days** | Rolling 30-day window |
| **Custom** | User-defined date range |

### Exporting Reports

1. Tap the **Export** button
2. Choose export format:
   - **PDF**: Formatted report document
   - **CSV**: Spreadsheet-compatible data
3. The file will be downloaded or shared

---

## Manager Features

> 👔 The **Manage** tab is only visible to users with **Manager** or **Admin** roles.

### Employee Management

View and manage your team members:

1. Tap **Manage** > **Employees**
2. View employee list with:
   - Name and employee number
   - Role (Employee/Manager/Admin)
   - Current status (Active/Inactive)
3. Tap on an employee to view details
4. Search employees using the search bar

### Leave Approvals

Process pending leave requests:

1. Tap **Manage** > **Approvals**
2. View pending leave requests from your team
3. Tap on a request to see details
4. Actions:
   - ✅ **Approve**: Accept the leave request
   - ❌ **Reject**: Deny with reason (required)

### Attendance Corrections

Handle attendance discrepancies:

1. Tap **Manage** > **Corrections**
2. View correction requests from employees
3. Review the original vs. requested times
4. Approve or reject corrections

### Activity Logs

Monitor system activity:

1. Tap **Manage** > **Logs**
2. View chronological activity log:
   - Clock-in/out events
   - Leave submissions
   - Profile updates
   - System events

### Assignment Sync

Synchronize project assignments with ERP:

1. Tap **Manage** > **Sync**
2. View sync status
3. Trigger manual sync if needed
4. Review sync history and errors

---

## Troubleshooting

### Common Issues & Solutions

#### ❌ "Face Verification Failed"

- **Cause**: Face not matched or liveness check failed
- **Solution**:
  1. Ensure good lighting (avoid backlighting)
  2. Remove face coverings (masks, sunglasses)
  3. Position face within the oval guide
  4. Keep still during scanning
  5. If issue persists, re-register your face with your manager

#### ❌ "Network Error"

- **Cause**: No internet connection or server unreachable
- **Solution**:
  1. Check your internet connection
  2. Try switching between WiFi and mobile data
  3. Wait a few moments and retry
  4. Contact IT if the issue persists

#### ❌ "Location Permission Required"

- **Cause**: GPS/location access not granted
- **Solution**:
  1. Go to your device's Settings
  2. Find AI Attend in the app list
  3. Enable Location permissions
  4. Return to the app and retry

#### ❌ "Camera Permission Required"

- **Cause**: Camera access not granted for facial recognition
- **Solution**:
  1. Go to your device's Settings
  2. Find AI Attend in the app list
  3. Enable Camera permissions
  4. Return to the app and retry

#### ❌ "Invalid Credentials"

- **Cause**: Incorrect company code, employee number, or password
- **Solution**:
  1. Double-check your company code
  2. Verify your employee number with HR
  3. Request a password reset if needed

---

## FAQ

### General Questions

**Q: Can I clock in/out from home?**  
A: This depends on your company's policy. Some organizations restrict clock-in to specific locations. Contact your HR department for details.

**Q: How accurate is the facial recognition?**  
A: The system uses advanced facial recognition with liveness detection, achieving over 99% accuracy while preventing photo/video spoofing.

**Q: Can I edit my clock-in/out time after submission?**  
A: Only managers can approve attendance corrections. Submit a correction request through the History screen if needed.

**Q: Why can't I see the Payroll tab?**  
A: The Payroll feature must be enabled by your administrator. Contact HR if you believe you should have access.

**Q: How do weekends and holidays affect leave calculations?**  
A: The system automatically excludes weekends and public holidays from leave duration calculations, so you only use leave for actual working days.

### Technical Questions

**Q: What mobile platforms are supported?**  
A: AI Attend works on both **iOS** (iPhone) and **Android** devices.

**Q: Does the app work offline?**  
A: Limited offline functionality is available. Attendance records will sync when connectivity is restored.

**Q: How is my data protected?**  
A: All data is encrypted in transit and at rest. Face templates are stored securely and cannot be reverse-engineered into actual photos.

---

## Support

For additional assistance:

- **Email**: support@ailabtech.com
- **Phone**: Contact your HR department
- **In-App**: Use the Help section (coming soon)

---

<p align="center">
  <strong>AI Attend v2.0</strong> | Powered by AI Lab Technology
</p>
