/**
 * Face Recognition Adapter Service
 * 
 * This adapter bridges AIAttend_v2 with the existing attend_ms_api_2 face recognition API.
 * It maintains 100% of the original face recognition functionality without any changes.
 * 
 * Flow:
 * 1. AIAttend_v2 UI -> AIAttend_v2 Backend -> Face Adapter (this file)
 * 2. Face Adapter -> attend_ms_api_2 API (port 3001)
 * 3. attend_ms_api_2 -> PostgreSQL (CX18AILABDEMO.hr_employee)
 * 4. Response flows back through the chain
 */

import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { pool as aiattendPool } from './db/connection';

// Configuration
const FACE_API_URL = process.env.FACE_API_URL || 'http://192.168.1.5:7010';
const FACE_API_SECRET = process.env.FACE_API_SECRET || 'change-this-dev-secret';
const ATTENDANCE_DB_CONFIG = {
  host: process.env.ATTENDANCE_DB_HOST || '192.168.1.5',
  port: parseInt(process.env.ATTENDANCE_DB_PORT || '5432'),
  database: process.env.ATTENDANCE_DB_NAME || 'CX18AILABDEMO',
  user: process.env.ATTENDANCE_DB_USER || 'postgres',
  password: process.env.ATTENDANCE_DB_PASSWORD || 'pgsql@2024',
};

// PostgreSQL pool for attend_ms_api_2 database (CX18AILABDEMO)
import pkg from 'pg';
const { Pool } = pkg;
const attendanceDbPool = new Pool(ATTENDANCE_DB_CONFIG);

/**
 * User Mapping: Maps AIAttend_v2 user identifiers to attend_ms_api_2 employee IDs
 */
interface UserMapping {
  aiattendUserId: string;
  employeeId: number;
  employeeNo?: string;
  companyCode?: string;
}

/**
 * Get or create employee ID mapping for AIAttend_v2 user
 */
async function getEmployeeMapping(
  aiattendUserId: string,
  employeeNo?: string,
  companyCode?: string
): Promise<number | null> {
  try {
    // First, check if mapping exists in AIAttend_v2 database
    const mappingResult = await aiattendPool.query(
      `SELECT attendance_employee_id FROM user_face_mapping WHERE aiattend_user_id = $1`,
      [aiattendUserId]
    );

    if (mappingResult.rows.length > 0) {
      console.log(`[FaceAdapter] Found existing mapping: AIAttend user ${aiattendUserId} -> Employee ID ${mappingResult.rows[0].attendance_employee_id}`);
      return mappingResult.rows[0].attendance_employee_id;
    }

    // If no mapping exists, try to find employee by employee_no in attendance database
    if (employeeNo) {
      const employeeResult = await attendanceDbPool.query(
        `SELECT id FROM hr_employee WHERE employee_no = $1 LIMIT 1`,
        [employeeNo]
      );

      if (employeeResult.rows.length > 0) {
        const employeeId = employeeResult.rows[0].id;

        // Create mapping
        await aiattendPool.query(
          `INSERT INTO user_face_mapping (aiattend_user_id, attendance_employee_id, employee_no, company_code, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (aiattend_user_id) DO UPDATE SET updated_at = NOW()`,
          [aiattendUserId, employeeId, employeeNo, companyCode]
        );

        console.log(`[FaceAdapter] Created new mapping: AIAttend user ${aiattendUserId} -> Employee ID ${employeeId}`);
        return employeeId;
      }
    }

    console.warn(`[FaceAdapter] No employee mapping found for AIAttend user ${aiattendUserId}`);
    return null;
  } catch (error) {
    console.error('[FaceAdapter] Error getting employee mapping:', error);
    return null;
  }
}

/**
 * Generate JWT token for attend_ms_api_2 authentication
 */
function generateAttendanceApiToken(employeeId: number, customerId?: number): string {
  const payload = {
    employeeId,
    customerId: customerId || 1, // Default customer ID if not provided
  };

  return jwt.sign(payload, FACE_API_SECRET, { expiresIn: '1h' });
}

/**
 * Convert base64 image to Buffer for multipart/form-data upload
 */
function base64ToBuffer(base64String: string): Buffer {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Enroll face - Proxies to attend_ms_api_2 /facialAuth/enroll
 * 
 * @param aiattendUserId - User ID from AIAttend_v2 system
 * @param imageBase64 - Base64 encoded face image
 * @param employeeNo - Employee number for mapping
 * @param companyCode - Company code for mapping
 */
export async function enrollFace(
  aiattendUserId: string,
  imageBase64: string,
  employeeNo?: string,
  companyCode?: string
): Promise<{ success: boolean; message: string; statusCode?: number }> {
  try {
    console.log(`[FaceAdapter] Starting face enrollment for AIAttend user: ${aiattendUserId}`);

    // Get or create employee mapping
    const employeeId = await getEmployeeMapping(aiattendUserId, employeeNo, companyCode);

    if (!employeeId) {
      return {
        success: false,
        message: 'Employee mapping not found. Please ensure employee exists in the system.',
        statusCode: 1,
      };
    }

    // Generate JWT token for attendance API
    const token = generateAttendanceApiToken(employeeId);

    // Convert base64 to buffer
    const imageBuffer = base64ToBuffer(imageBase64);

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('faceImage', imageBuffer, {
      filename: 'face.jpg',
      contentType: 'image/jpeg',
    });

    // Call attend_ms_api_2 enroll endpoint
    const response = await fetch(`${FACE_API_URL}/facialAuth/enroll`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    const result = await response.json();

    console.log(`[FaceAdapter] Enrollment response:`, result);

    return {
      success: result.status_code === 0,
      message: result.message || 'Face enrollment completed',
      statusCode: result.status_code,
    };
  } catch (error) {
    console.error('[FaceAdapter] Face enrollment error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Face enrollment failed',
      statusCode: 1,
    };
  }
}

/**
 * Authenticate face - Proxies to attend_ms_api_2 /facialAuth/authenticate
 * 
 * @param aiattendUserId - User ID from AIAttend_v2 system
 * @param imageBase64 - Base64 encoded face image for verification
 * @param employeeNo - Employee number for mapping
 * @param companyCode - Company code for mapping
 */
export async function authenticateFace(
  aiattendUserId: string,
  imageBase64: string,
  employeeNo?: string,
  companyCode?: string
): Promise<{
  success: boolean;
  message: string;
  confidence?: number;
  statusCode?: number;
  details?: any;
}> {
  try {
    console.log(`[FaceAdapter] Starting face authentication for AIAttend user: ${aiattendUserId}`);

    // Get employee mapping
    const employeeId = await getEmployeeMapping(aiattendUserId, employeeNo, companyCode);

    if (!employeeId) {
      return {
        success: false,
        message: 'Employee mapping not found. Please enroll your face first.',
        statusCode: 1,
      };
    }

    // Check if employee has enrolled face data
    const faceDataCheck = await attendanceDbPool.query(
      `SELECT l_face_descriptor FROM hr_employee WHERE id = $1`,
      [employeeId]
    );

    if (faceDataCheck.rows.length === 0 || !faceDataCheck.rows[0].l_face_descriptor) {
      return {
        success: false,
        message: 'No face data enrolled for this user. Please enroll your face first.',
        statusCode: 1,
      };
    }

    // Generate JWT token for attendance API
    const token = generateAttendanceApiToken(employeeId);

    // Convert base64 to buffer
    const imageBuffer = base64ToBuffer(imageBase64);

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('faceImage', imageBuffer, {
      filename: 'face.jpg',
      contentType: 'image/jpeg',
    });

    // Call attend_ms_api_2 authenticate endpoint
    const response = await fetch(`${FACE_API_URL}/facialAuth/authenticate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    const result = await response.json();

    console.log(`[FaceAdapter] Authentication response:`, result);

    // The original API returns:
    // - status_code: 0 (success) or 1 (failure)
    // - confidence: confidence score (0-1)
    const isMatch = result.status_code === 0;
    const confidence = result.confidence || 0;

    return {
      success: isMatch,
      message: isMatch
        ? '✅ Face Recognition Successful'
        : '❌ Face Does Not Match - Unauthorized',
      confidence,
      statusCode: result.status_code,
      details: {
        threshold: 0.5, // Original API uses 0.5 threshold
        score: confidence,
      },
    };
  } catch (error) {
    console.error('[FaceAdapter] Face authentication error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Face authentication failed',
      statusCode: 1,
    };
  }
}

/**
 * Health check for face recognition API
 */
export async function checkFaceApiHealth(): Promise<boolean> {
  try {
    // Use 127.0.0.1 instead of localhost to force IPv4
    const healthUrl = FACE_API_URL.replace('localhost', '127.0.0.1');
    const response = await fetch(`${healthUrl}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('[FaceAdapter] Face API health check failed:', error);
    return false;
  }
}

/**
 * Get face enrollment status for a user
 */
export async function getFaceEnrollmentStatus(
  aiattendUserId: string
): Promise<{ enrolled: boolean; employeeId?: number }> {
  try {
    const mappingResult = await aiattendPool.query(
      `SELECT attendance_employee_id FROM user_face_mapping WHERE aiattend_user_id = $1`,
      [aiattendUserId]
    );

    if (mappingResult.rows.length === 0) {
      return { enrolled: false };
    }

    const employeeId = mappingResult.rows[0].attendance_employee_id;

    const faceDataCheck = await attendanceDbPool.query(
      `SELECT l_face_descriptor FROM hr_employee WHERE id = $1`,
      [employeeId]
    );

    const hasEnrolledFace = faceDataCheck.rows.length > 0 &&
      faceDataCheck.rows[0].l_face_descriptor !== null;

    return {
      enrolled: hasEnrolledFace,
      employeeId: hasEnrolledFace ? employeeId : undefined,
    };
  } catch (error) {
    console.error('[FaceAdapter] Error checking enrollment status:', error);
    return { enrolled: false };
  }
}

// Cleanup on module unload
process.on('exit', () => {
  attendanceDbPool.end();
});


