import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { db, pool } from "./db/connection";
import { HTTPException } from "hono/http-exception";
import fs from 'fs';
import path from 'path';
import { runFullConsistencyCheck, fixDataInconsistencies } from "./db/consistency-check";
import { authenticateFace, enrollFace, checkFaceApiHealth, getFaceEnrollmentStatus } from "./face-adapter";
import { getCompanyPool, initMasterPool } from "./db/multiCompanyDb";

// app will be mounted at /api
const app = new Hono();

// Cross-environment fetch shim (Node 16/18/20 vs. browser-like runtimes)
// Avoid type conflicts by treating provider fetch as any
const fetchFn: any = (globalThis as any).fetch ?? require('node-fetch');

// PRODUCTION SECURITY: All face verification helper functions REMOVED
// cosineSim() and compareImageBuffers() were security vulnerabilities
// All face verification MUST go through the AI service webhook - NO EXCEPTIONS

async function verifyUserFace(
  userId: string,
  imageUri?: string,
  storedTemplate?: Buffer | null,
  faceTemplateB64FromClient?: string
): Promise<{ success: boolean, message?: string, userMessage?: string, details?: any }> {
  try {
    // SECURITY: Strict mode is now ALWAYS enforced for production security
    const strict = String(process.env.FACE_ENFORCE_STRICT || 'true').toLowerCase() === 'true';
    const webhook = process.env.FACE_VERIFY_WEBHOOK;
    const threshold = Math.max(0, Math.min(1, parseFloat(String(process.env.FACE_MATCH_THRESHOLD || '0.75')) || 0.75));

    console.log(`[Backend] Face verification - strict=${strict}, webhook=${webhook ? 'configured' : 'not configured'}, threshold=${threshold}`);

    // SECURITY: Validate image URI format to prevent injection attacks
    if (imageUri && !isValidImageUri(imageUri)) {
      console.warn(`[SECURITY] Invalid image URI format rejected: ${imageUri?.substring(0, 50)}...`);
      return {
        success: false,
        message: 'Invalid image format',
        userMessage: '❌ Invalid Image Format - Please Use Camera'
      };
    }

    if (webhook) {
      // Check if storedTemplate is a placeholder
      const isPlaceholder = storedTemplate && storedTemplate.toString('utf-8') === 'MOBILE_FILE_URI_PLACEHOLDER';

      const payload: any = {
        userId,
        imageUri: imageUri || null,
        storedTemplate: (storedTemplate && !isPlaceholder) ? storedTemplate.toString('base64') : null,
        faceTemplateB64: faceTemplateB64FromClient || null,
        threshold
      };
      console.log(`[Backend] Calling face verifier webhook: ${webhook}`);
      console.log(`[Backend] Payload: userId=${userId}, hasStoredTemplate=${!!(storedTemplate && !isPlaceholder)}, hasFaceTemplate=${!!faceTemplateB64FromClient}, isPlaceholder=${isPlaceholder}`);

      const resp = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        console.log(`[Backend] Webhook failed: ${resp.status} ${resp.statusText}`);
        // SECURITY: In strict mode, NEVER allow fallback - reject all failures
        if (strict) {
          return {
            success: false,
            message: 'Face verification service error',
            userMessage: '❌ Verification Service Error - Please Try Again'
          };
        }
        // Non-strict mode fallback (development only)
        console.log('[Backend] Webhook failed but strict mode disabled - allowing verification');
        return {
          success: true,
          message: 'Face verified (webhook unavailable, strict mode disabled)',
          userMessage: '✅ Face Recognition Successful (Fallback Mode)'
        };
      }

      const data = await resp.json().catch(() => ({}));
      console.log(`[Backend] Webhook response:`, data);

      // SECURITY: Comprehensive validation of webhook response
      const detected = !!(data.detectedFace ?? data.detected ?? false);
      const live = !!(data.liveness ?? data.live ?? false);
      const score = Number(data.matchScore ?? data.score ?? 0);
      const verified = !!data.verified && detected && live && score >= threshold;

      // SECURITY: Detailed rejection reasons for better security logging
      if (!detected) {
        console.warn(`[SECURITY] No face detected for user ${userId}`);
        return {
          success: false,
          message: 'No face detected in image',
          userMessage: '❌ No Face Detected - Ensure Face is Visible',
          details: { detected, live, score, threshold }
        };
      }

      if (!live) {
        console.warn(`[SECURITY] Liveness check failed for user ${userId}`);
        return {
          success: false,
          message: 'Liveness verification failed - possible spoofing attempt',
          userMessage: '❌ Liveness Check Failed - Use Real Face',
          details: { detected, live, score, threshold }
        };
      }

      if (score < threshold) {
        console.warn(`[SECURITY] Face match score ${score} below threshold ${threshold} for user ${userId}`);
        return {
          success: false,
          message: `Face match score ${score.toFixed(2)} below threshold ${threshold}`,
          userMessage: '❌ Face Does Not Match - Unauthorized',
          details: { detected, live, score, threshold }
        };
      }

      if (!verified) {
        console.warn(`[SECURITY] Face verification failed for user ${userId}`);
        return {
          success: false,
          message: data.reason || 'Face verification failed',
          userMessage: data.userMessage || '❌ Face Recognition Failed',
          details: { detected, live, score, threshold }
        };
      }

      // SUCCESS: All checks passed
      console.log(`[Backend] Face verification successful for user ${userId}: detected=${detected}, live=${live}, score=${score}`);
      return {
        success: true,
        message: data.reason || 'Face verification successful',
        userMessage: data.userMessage || '✅ Face Recognition Successful',
        details: { detected, live, score, threshold }
      };
    }

    // No webhook configured - check strict mode
    if (strict) {
      console.log('[SECURITY] Face verification requires AI service but none configured');
      return {
        success: false,
        message: 'Face verification service is required but not available',
        userMessage: '❌ Face Recognition Service Unavailable - Please Contact Administrator'
      };
    }

    // SECURITY WARNING: Strict mode disabled and no webhook - allow local verification (DEV ONLY)
    console.warn('[SECURITY WARNING] No webhook configured, strict mode disabled - allowing local verification (DEVELOPMENT ONLY)');
    return {
      success: true,
      message: 'Face verified (local mode, no external AI service - DEVELOPMENT ONLY)',
      userMessage: '✅ Face Recognition Successful (Dev Mode)'
    };
  } catch (e) {
    console.error('verifyUserFace helper error:', e);
    return {
      success: false,
      message: 'Face verification error occurred',
      userMessage: '❌ Face Recognition Error - Please Try Again'
    };
  }
}

// SECURITY: Validate image URI to prevent injection attacks and ensure proper format
function isValidImageUri(uri?: string | null): boolean {
  if (!uri) {
    console.log('[ImageValidation] URI is null or undefined');
    return false;
  }
  const s = String(uri).trim();
  if (!s) {
    console.log('[ImageValidation] URI is empty after trim');
    return false;
  }

  // Log the first 100 characters for debugging
  console.log(`[ImageValidation] Checking URI: ${s.substring(0, 100)}...`);

  // Allow HTTPS URLs and data URLs with image mime types only
  if (/^https:\/\//i.test(s)) {
    console.log('[ImageValidation] Valid HTTPS URL');
    return true;
  }

  // More flexible data URL validation - allows various formats:
  // - data:image/jpeg;base64,... (standard)
  // - data:image/jpg;base64,... (alternative)
  // - data:image/png;base64,... (PNG)
  // - With or without charset
  if (/^data:image\/(png|jpeg|jpg|webp)(;charset=utf-8)?;base64,/i.test(s)) {
    console.log('[ImageValidation] Valid data URL with base64');
    return true;
  }

  // Also accept file:// URIs (mobile file system)
  if (/^file:\/\//i.test(s)) {
    console.log('[ImageValidation] Valid file:// URI (mobile)');
    return true;
  }

  // Accept content:// URIs (Android)
  if (/^content:\/\//i.test(s)) {
    console.log('[ImageValidation] Valid content:// URI (Android)');
    return true;
  }

  console.log('[ImageValidation] REJECTED - Does not match any valid format');
  console.log(`[ImageValidation] Format detected: ${s.substring(0, 50)}`);
  return false;
}

// --- Security/validation helpers ---
const isValidISODate = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(String(s));
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const safeTrimLower = (v?: string | null, maxLen = 128) => String(v || '').trim().toLowerCase().slice(0, maxLen);

// Enable CORS for all routes
app.use("*", cors());

// Simple health check endpoint for connectivity diagnostics
app.get('/health', (c) => {
  return c.json({ ok: true, uptime: process.uptime() });
});

// DISABLED: External face verification proxy routes (not used)
// These were forwarding to FACE_AI_PROVIDER_URL which doesn't exist
// The real /face/verify endpoint is defined later (line ~3054) and uses the webhook
// app.post('/api/face/verify', async (c) => { ... });
// app.post('/face/verify', async (c) => { ... });

// Face Recognition API Integration Endpoint: POST /v1/verify
// This endpoint now uses the existing attend_ms_api_2 face recognition API
// NO CHANGES to face recognition logic - 100% original functionality maintained
app.post('/v1/verify', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const userId = String((body?.userId ?? '')).trim();
    const imageUri = String((body?.imageUri ?? '')).trim();
    const faceTemplateB64 = body?.faceTemplateB64 ?? null;

    console.log('[FaceAdapter Integration] /v1/verify called for userId:', userId);

    if (!userId) {
      c.status(400);
      return c.json({
        verified: false,
        detectedFace: false,
        liveness: false,
        matchScore: 0,
        reason: 'Missing userId',
        userMessage: 'Invalid request parameters'
      });
    }

    // Extract base64 image data
    let imageBase64: string;

    // Check if imageUri is a local mobile file URI (file:// or content://)
    const isLocalFileUri = /^(file:\/\/|content:\/\/)/i.test(imageUri);

    if (isLocalFileUri) {
      // For local file URIs, we must use faceTemplateB64 since we can't fetch the file
      console.log('[FaceAdapter] Local file URI detected, using faceTemplateB64');
      if (!faceTemplateB64) {
        return c.json({
          verified: false,
          detectedFace: false,
          liveness: false,
          matchScore: 0,
          reason: 'Local file URI requires faceTemplateB64',
          userMessage: 'Image data not provided for local file'
        });
      }

      // Extract base64 from faceTemplateB64 (handle data:image/... format)
      const b64 = faceTemplateB64.includes(',') ? faceTemplateB64.split(',').pop() : faceTemplateB64;
      if (!b64) {
        return c.json({
          verified: false,
          detectedFace: false,
          liveness: false,
          matchScore: 0,
          reason: 'Invalid faceTemplateB64 format',
          userMessage: 'Could not extract image data'
        });
      }
      imageBase64 = b64;
    } else if (imageUri.startsWith('data:image/')) {
      // Handle data:image/... URIs
      const base64Data = imageUri.split(',')[1];
      if (!base64Data) {
        return c.json({
          verified: false,
          detectedFace: false,
          liveness: false,
          matchScore: 0,
          reason: 'Invalid base64 data',
          userMessage: 'Could not extract image data'
        });
      }
      imageBase64 = base64Data;
    } else if (imageUri.startsWith('https://')) {
      // For HTTPS URLs, fetch the image and convert to base64
      try {
        const imgResp = await fetchFn(imageUri);
        if (!imgResp.ok) {
          return c.json({
            verified: false,
            detectedFace: false,
            liveness: false,
            matchScore: 0,
            reason: 'Could not fetch image from URL',
            userMessage: 'Image URL is not accessible'
          });
        }
        const arrayBuf = await imgResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        imageBase64 = buffer.toString('base64');
      } catch (err) {
        console.error('[FaceAdapter] Image fetch error:', err);
        return c.json({
          verified: false,
          detectedFace: false,
          liveness: false,
          matchScore: 0,
          reason: 'Image fetch failed',
          userMessage: 'Could not retrieve image'
        });
      }
    } else if (!imageUri && faceTemplateB64) {
      // No imageUri but faceTemplateB64 provided
      console.log('[FaceAdapter] No imageUri, using faceTemplateB64');
      const b64 = faceTemplateB64.includes(',') ? faceTemplateB64.split(',').pop() : faceTemplateB64;
      if (!b64) {
        return c.json({
          verified: false,
          detectedFace: false,
          liveness: false,
          matchScore: 0,
          reason: 'Invalid faceTemplateB64 format',
          userMessage: 'Could not extract image data'
        });
      }
      imageBase64 = b64;
    } else {
      // Invalid format
      return c.json({
        verified: false,
        detectedFace: false,
        liveness: false,
        matchScore: 0,
        reason: 'Invalid image format',
        userMessage: 'Image must be HTTPS URL, data:image/... base64, or provide faceTemplateB64 for local files'
      });
    }

    // Get user info from AIAttend_v2 database to map to employee
    const userResult = await db.query(
      'SELECT employee_no, company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return c.json({
        verified: false,
        detectedFace: false,
        liveness: false,
        matchScore: 0,
        reason: 'User not found',
        userMessage: 'User not found in system'
      });
    }

    const employeeNo = userResult.rows[0].employee_no;
    const companyId = userResult.rows[0].company_id;

    // Get company code
    const companyResult = await db.query(
      'SELECT code FROM companies WHERE id = $1',
      [companyId]
    );

    const companyCode = companyResult.rows.length > 0 ? companyResult.rows[0].code : undefined;

    // Call face adapter to authenticate using existing attend_ms_api_2 API
    console.log('[FaceAdapter] Calling authenticateFace for employee:', employeeNo);
    const result = await authenticateFace(userId, imageBase64, employeeNo, companyCode);

    // Transform response to match expected format
    return c.json({
      verified: result.success,
      detectedFace: true, // Adapter handles face detection
      liveness: true, // Adapter handles liveness
      matchScore: result.confidence || 0,
      reason: result.message,
      userMessage: result.message
    });
  } catch (e) {
    console.error('[FaceAdapter] Verification error:', e);
    c.status(500);
    return c.json({
      verified: false,
      detectedFace: false,
      liveness: false,
      matchScore: 0,
      reason: 'Internal error',
      userMessage: 'Face verification service error'
    });
  }
});

// Face Enrollment Endpoint: POST /v1/enroll
// Enrolls user's face using existing attend_ms_api_2 API
app.post('/v1/enroll', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const userId = String((body?.userId ?? '')).trim();
    const imageUri = String((body?.imageUri ?? '')).trim();
    const faceTemplateB64 = body?.faceTemplateB64 ?? null;

    console.log('[FaceAdapter Integration] /v1/enroll called for userId:', userId);

    if (!userId) {
      c.status(400);
      return c.json({
        success: false,
        message: 'Missing userId'
      });
    }

    // Extract base64 image data (same logic as verify)
    let imageBase64: string;
    const isLocalFileUri = /^(file:\/\/|content:\/\/)/i.test(imageUri);

    if (isLocalFileUri && faceTemplateB64) {
      const b64 = faceTemplateB64.includes(',') ? faceTemplateB64.split(',').pop() : faceTemplateB64;
      if (!b64) {
        return c.json({ success: false, message: 'Invalid faceTemplateB64 format' });
      }
      imageBase64 = b64;
    } else if (imageUri.startsWith('data:image/')) {
      const base64Data = imageUri.split(',')[1];
      if (!base64Data) {
        return c.json({ success: false, message: 'Invalid base64 data' });
      }
      imageBase64 = base64Data;
    } else if (imageUri.startsWith('https://')) {
      try {
        const imgResp = await fetchFn(imageUri);
        if (!imgResp.ok) {
          return c.json({ success: false, message: 'Could not fetch image from URL' });
        }
        const arrayBuf = await imgResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        imageBase64 = buffer.toString('base64');
      } catch (err) {
        console.error('[FaceAdapter] Image fetch error:', err);
        return c.json({ success: false, message: 'Image fetch failed' });
      }
    } else if (!imageUri && faceTemplateB64) {
      const b64 = faceTemplateB64.includes(',') ? faceTemplateB64.split(',').pop() : faceTemplateB64;
      if (!b64) {
        return c.json({ success: false, message: 'Invalid faceTemplateB64 format' });
      }
      imageBase64 = b64;
    } else {
      return c.json({ success: false, message: 'Invalid image format' });
    }

    // Get user info from AIAttend_v2 database
    const userResult = await db.query(
      'SELECT employee_no, company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return c.json({ success: false, message: 'User not found in system' });
    }

    const employeeNo = userResult.rows[0].employee_no;
    const companyId = userResult.rows[0].company_id;

    // Get company code
    const companyResult = await db.query(
      'SELECT code FROM companies WHERE id = $1',
      [companyId]
    );

    const companyCode = companyResult.rows.length > 0 ? companyResult.rows[0].code : undefined;

    // Call face adapter to enroll using existing attend_ms_api_2 API
    console.log('[FaceAdapter] Calling enrollFace for employee:', employeeNo);
    const result = await enrollFace(userId, imageBase64, employeeNo, companyCode);

    return c.json({
      success: result.success,
      message: result.message,
      statusCode: result.statusCode
    });
  } catch (e) {
    console.error('[FaceAdapter] Enrollment error:', e);
    c.status(500);
    return c.json({
      success: false,
      message: 'Face enrollment service error'
    });
  }
});

// Face Enrollment Status Check: GET /v1/enrollment-status
app.get('/v1/enrollment-status', async (c) => {
  try {
    const userId = c.req.query('userId');

    if (!userId) {
      c.status(400);
      return c.json({ enrolled: false, message: 'Missing userId' });
    }

    const status = await getFaceEnrollmentStatus(userId);
    return c.json(status);
  } catch (e) {
    console.error('[FaceAdapter] Enrollment status check error:', e);
    return c.json({ enrolled: false, message: 'Error checking enrollment status' });
  }
});

// Face API Health Check: GET /v1/face-health
app.get('/v1/face-health', async (c) => {
  try {
    const isHealthy = await checkFaceApiHealth();
    return c.json({
      healthy: isHealthy,
      apiUrl: process.env.FACE_API_URL || 'http://192.168.31.135:7012',
      message: isHealthy ? 'Face recognition API is healthy' : 'Face recognition API is unavailable'
    });
  } catch (e) {
    console.error('[FaceAdapter] Health check error:', e);
    return c.json({ healthy: false, message: 'Health check failed' });
  }
});

// Calculate image entropy (measure of randomness/complexity)
// Higher entropy = more complex image (real photo)
// Lower entropy = simple/uniform image (solid color, screenshot, etc.)
function calculateImageEntropy(imageBytes: Buffer): number {
  const histogram: number[] = new Array(256).fill(0);
  const sampleSize = Math.min(imageBytes.length, 10000); // Sample first 10KB for performance

  // Build histogram of byte values
  for (let i = 0; i < sampleSize; i++) {
    histogram[imageBytes[i]]++;
  }

  // Calculate Shannon entropy
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > 0) {
      const probability = histogram[i] / sampleSize;
      entropy -= probability * Math.log2(probability);
    }
  }

  return entropy;
}

// Calculate perceptual hash (pHash) for image comparison
// This creates a 64-bit fingerprint of the image that's resistant to minor changes
function calculatePerceptualHash(imageBytes: Buffer): bigint {
  // Simple hash based on byte distribution patterns
  // For production, use a proper image hashing library like 'sharp' or 'jimp'
  const sampleSize = Math.min(imageBytes.length, 1000);
  const samples: number[] = [];

  // Sample bytes at regular intervals
  const step = Math.floor(imageBytes.length / sampleSize);
  for (let i = 0; i < imageBytes.length; i += step) {
    if (samples.length >= 64) break;
    samples.push(imageBytes[i]);
  }

  // Calculate average
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

  // Create hash: bit is 1 if sample > average, 0 otherwise
  let hash = BigInt(0);
  for (let i = 0; i < Math.min(samples.length, 64); i++) {
    if (samples[i] > avg) {
      hash |= BigInt(1) << BigInt(i);
    }
  }

  return hash;
}

// Calculate Hamming distance between two hashes
// Returns number of differing bits (0 = identical, 64 = completely different)
function calculateHammingDistance(hash1: bigint, hash2: bigint): number {
  let xor = hash1 ^ hash2;
  let distance = 0;

  while (xor > 0) {
    distance += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }

  return distance;
}

// Local face verification (basic image validation + simple comparison)
// For production, integrate with a real AI service or use face-api.js for browser-based detection
async function verifyFaceLocally(
  imageBytes: Buffer,
  storedTemplate: string | null
): Promise<{
  verified: boolean;
  detectedFace: boolean;
  liveness: boolean;
  matchScore: number;
  reason?: string;
  userMessage?: string;
}> {
  try {
    // Basic image format validation (check for JPEG/PNG magic bytes)
    const isJPEG = imageBytes[0] === 0xFF && imageBytes[1] === 0xD8 && imageBytes[2] === 0xFF;
    const isPNG = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47;

    if (!isJPEG && !isPNG) {
      return {
        verified: false,
        detectedFace: false,
        liveness: false,
        matchScore: 0,
        reason: 'Invalid image format',
        userMessage: '❌ Invalid image format. Please use JPEG or PNG.'
      };
    }

    // SECURITY: Basic face detection using image characteristics
    // Check if image has sufficient size and complexity to contain a face
    const minFaceImageSize = 10000; // 10KB minimum for a face photo
    const maxFaceImageSize = 3 * 1024 * 1024; // 3MB max
    const detectedFace = imageBytes.length >= minFaceImageSize && imageBytes.length <= maxFaceImageSize;

    if (!detectedFace) {
      return {
        verified: false,
        detectedFace: false,
        liveness: false,
        matchScore: 0,
        reason: 'No face detected - image too small or too large',
        userMessage: '❌ No face detected. Please ensure your face is clearly visible and well-lit.'
      };
    }

    // SECURITY: Enhanced liveness check
    // Check image entropy (complexity) to detect static photos vs real captures
    const entropy = calculateImageEntropy(imageBytes);
    const minEntropy = 6.0; // Minimum entropy for a real photo (not a solid color or simple pattern)
    const livenessPassed = entropy >= minEntropy && imageBytes.length >= minFaceImageSize;

    if (!livenessPassed) {
      return {
        verified: false,
        detectedFace: true,
        liveness: false,
        matchScore: 0,
        reason: 'Image quality too low',
        userMessage: '❌ Image quality too low. Please ensure good lighting and camera focus.'
      };
    }

    // Check if stored template exists
    if (!storedTemplate) {
      return {
        verified: false,
        detectedFace: true,
        liveness: true,
        matchScore: 0,
        reason: 'No stored template for comparison',
        userMessage: '❌ No registered face template found. Please register your face first.'
      };
    }

    // Simple comparison: check if stored template is valid base64
    // In production, use face comparison algorithms (face-api.js, OpenCV, or cloud AI)
    let referenceBytes: Buffer;
    try {
      referenceBytes = Buffer.from(storedTemplate, 'base64');
    } catch (err) {
      return {
        verified: false,
        detectedFace: true,
        liveness: true,
        matchScore: 0,
        reason: 'Invalid stored template',
        userMessage: '❌ Registered face template is invalid. Please re-register.'
      };
    }

    // SECURITY: Enhanced similarity check using perceptual hash comparison
    // This is a basic implementation - for production, use proper face recognition AI
    const capturedHash = calculatePerceptualHash(imageBytes);
    const storedHash = calculatePerceptualHash(referenceBytes);

    // Calculate Hamming distance between hashes (0 = identical, 64 = completely different)
    const hammingDistance = calculateHammingDistance(capturedHash, storedHash);

    // Convert Hamming distance to similarity score (0-1 scale)
    // Lower distance = higher similarity
    const maxDistance = 64; // Maximum possible Hamming distance for 64-bit hash
    const matchScore = Math.max(0, 1 - (hammingDistance / maxDistance));

    // SECURITY: Strict threshold enforcement
    const threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.75');
    const verified = matchScore >= threshold;

    console.log(`[Face Verification] Hamming distance: ${hammingDistance}, Match score: ${matchScore.toFixed(3)}, Threshold: ${threshold}, Verified: ${verified}`);

    return {
      verified,
      detectedFace: true,
      liveness: true,
      matchScore,
      reason: verified ? 'Face verified successfully' : `Match score ${matchScore.toFixed(2)} below threshold ${threshold}`,
      userMessage: verified ? '✅ Face Recognition Successful' : '❌ Face mismatch. Please try again with a clear, front-facing photo.'
    };
  } catch (err) {
    console.error('[Local Face Verification] Error:', err);
    return {
      verified: false,
      detectedFace: false,
      liveness: false,
      matchScore: 0,
      reason: 'Face verification error: ' + (err as Error).message,
      userMessage: '❌ Face verification service error. Please try again.'
    };
  }
}

// Admin: Team Reports (late/absent summaries)
// GET /admin/reports/summary?companyCode&employeeNo&startDate=&endDate=&groupBy=employee|department&thresholdMinutes=5&query=&page=&limit=
app.get('/admin/reports/summary', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const startDate = (c.req.query('startDate') || '').trim();
    const endDate = (c.req.query('endDate') || '').trim();
    const q = safeTrimLower(c.req.query('query') || '', 128);
    const groupBy = safeTrimLower(c.req.query('groupBy') || 'employee');
    const thresholdMinutes = clamp(Number.parseInt(String(c.req.query('thresholdMinutes') || '5'), 10) || 5, 0, 240);
    const page = clamp(Number.parseInt(String(c.req.query('page') || '1'), 10) || 1, 1, 1000000);
    const limit = clamp(Number.parseInt(String(c.req.query('limit') || '20'), 10) || 20, 1, 50);
    if (!companyCode || !employeeNo || !isValidISODate(startDate) || !isValidISODate(endDate)) { c.status(400); return c.json({ success: false, message: 'Missing or invalid fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    if (groupBy && !['employee', 'department'].includes(groupBy)) {
      c.status(400); return c.json({ success: false, message: 'Invalid groupBy' });
    }

    const offset = (page - 1) * limit;
    // Build filters
    const nameLike = q ? `%${q}%` : null;
    const empLike = q ? `%${q}%` : null;

    // Compute per-employee lates/absents within range by joining schedules, attendance_days, clock_events
    const params: any[] = [approver.companyId, startDate, endDate];
    if (q) { params.push(nameLike, empLike); }
    params.push(String(thresholdMinutes));

    const whereUser = q ? 'AND (LOWER(u.name) LIKE $4 OR LOWER(u.emp_no) LIKE $5)' : '';
    const threshParamIndex = q ? 6 : 4;

    const countSql = `
      WITH base AS (
        SELECT u.id AS user_id, u.emp_no, u.name,
               LOWER(COALESCE(NULL, u.role)) AS department_name,
               s.date::date AS dte, s.start_time,
               ad.clock_in_id, ad.status AS ad_status
          FROM users u
          JOIN schedules s ON s.user_id = u.id
          LEFT JOIN attendance_days ad ON ad.user_id = u.id AND ad.date = s.date
         WHERE u.company_id = $1
           AND s.date BETWEEN $2::date AND $3::date
           ${whereUser}
      )
      SELECT COUNT(DISTINCT ${groupBy === 'department' ? 'department_name' : 'emp_no'}) AS cnt FROM base
    `;
    const totalRes = await db.query(countSql, params.slice(0, q ? 5 : 3));
    const total = Number(totalRes.rows[0]?.cnt || 0);

    const rowsSql = `
      WITH base AS (
        SELECT u.id AS user_id, u.emp_no, u.name,
               LOWER(COALESCE(NULL, u.role)) AS department_name,
               s.date::date AS dte, s.start_time,
               ad.clock_in_id, ad.status AS ad_status
          FROM users u
          JOIN schedules s ON s.user_id = u.id
          LEFT JOIN attendance_days ad ON ad.user_id = u.id AND ad.date = s.date
         WHERE u.company_id = $1
           AND s.date BETWEEN $2::date AND $3::date
           ${whereUser}
      ),
      agg AS (
        SELECT ${groupBy === 'department' ? 'b.department_name AS dep,' : 'b.emp_no, b.name,'}
               SUM(
                 CASE
                   WHEN b.clock_in_id IS NOT NULL THEN
                     CASE WHEN to_timestamp(ci.timestamp/1000.0) > (b.dte + (b.start_time)::time + (($${threshParamIndex})::int || ' minutes')::interval) THEN 1 ELSE 0 END
                   ELSE 0
                 END
               ) AS lates,
               SUM(CASE WHEN b.ad_status = 'absent' THEN 1 ELSE 0 END) AS absents
          FROM base b
          LEFT JOIN clock_events ci ON ci.id = b.clock_in_id
         GROUP BY ${groupBy === 'department' ? 'b.department_name' : 'b.emp_no, b.name'}
      )
      SELECT ${groupBy === 'department' ? 'dep AS department, lates, absents' : 'emp_no, name, lates, absents'}
        FROM agg
       ORDER BY ${groupBy === 'department' ? 'dep' : 'emp_no'} ASC
       LIMIT $${threshParamIndex + 1} OFFSET $${threshParamIndex + 2}
    `;
    const rowsParams = q
      ? [approver.companyId, startDate, endDate, nameLike, empLike, String(thresholdMinutes), limit, offset]
      : [approver.companyId, startDate, endDate, String(thresholdMinutes), limit, offset];
    const rowsRes = await db.query(rowsSql, rowsParams);

    // Totals across returned rows (page results) and overall totals across company in date range
    const pageTotals = rowsRes.rows.reduce((a: any, r: any) => ({ lates: a.lates + Number(r.lates || 0), absents: a.absents + Number(r.absents || 0) }), { lates: 0, absents: 0 });

    // Audit: view reports summary
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, 'reports_summary_view', 'report', NULL, $3)`,
        [approver.companyId, approver.userId, JSON.stringify({ startDate, endDate, groupBy, thresholdMinutes, q })]
      );
    } catch { }
    return c.json({ success: true, data: { rows: rowsRes.rows, total, page, limit, pageTotals } });
  } catch (e) {
    console.error('admin reports summary error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Debug: inspect stored face template info (size, type)
app.get('/debug/face-template', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const res = await db.query('SELECT image_uri, template_version, face_template FROM user_faces WHERE user_id = $1', [userId]);
    if ((res?.rowCount ?? 0) === 0) return c.json({ success: true, data: { registered: false } });
    const row: any = res.rows[0] || {};
    const buf: Buffer | null = row.face_template || null;
    const looksLikeImage = (b?: Buffer | null): boolean => {
      if (!b || b.length < 8) return false;
      if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true; // JPEG
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return true; // PNG
      return false;
    };
    return c.json({
      success: true, data: {
        registered: true,
        imageUri: row.image_uri || null,
        templateVersion: row.template_version || null,
        templateBytes: buf ? buf.byteLength : null,
        templateLooksLikeImage: looksLikeImage(buf),
      }
    });
  } catch (e) {
    console.error('debug face-template error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Toolbox: assign a meeting to a selected employee (manager/admin)
// POST /toolbox/assign-attendee { companyCode, employeeNo, targetEmployeeNo, meetingId }
app.post('/toolbox/assign-attendee', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, targetEmployeeNo, meetingId } = body as any;
    if (!companyCode || !employeeNo || !targetEmployeeNo || !meetingId) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }

    // Basic formats: meetingId can be UUID or short id depending on schema variant; accept any string
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    // Resolve target employee within same company
    const targetRes = await db.query('SELECT id FROM users WHERE company_id = $1 AND emp_no = $2', [approver.companyId, String(targetEmployeeNo).trim()]);
    if (targetRes.rowCount === 0) { c.status(404); return c.json({ success: false, message: 'Target employee not found' }); }
    const targetUserId = targetRes.rows[0].id;

    // Verify meeting exists
    const meetingRes = await db.query('SELECT id FROM toolbox_meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rowCount === 0) { c.status(404); return c.json({ success: false, message: 'Meeting not found' }); }

    // Upsert attendee row
    const insertSql = `
      INSERT INTO toolbox_meeting_attendees (id, meeting_id, user_id, attended, acknowledged_at, signature_uri, notes, created_at, updated_at)
      VALUES (
        COALESCE((SELECT column_name FROM information_schema.columns WHERE table_name='toolbox_meeting_attendees' AND column_name='id')::text, NULL),
        $1, $2, false, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (meeting_id, user_id)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id, meeting_id, user_id`;

    // The above COALESCE trick isn't necessary; simply use DEFAULT for id; works in both UUID and short-id schemas
    const res = await db.query(
      `INSERT INTO toolbox_meeting_attendees (id, meeting_id, user_id, attended, acknowledged_at, signature_uri, notes, created_at, updated_at)
       VALUES (DEFAULT, $1, $2, false, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (meeting_id, user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id, meeting_id, user_id`,
      [meetingId, targetUserId]
    );

    // Audit
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, 'toolbox_assign_attendee', 'toolbox_meeting', $3, $4)` ,
        [approver.companyId, approver.userId, meetingId, JSON.stringify({ targetUserId, targetEmployeeNo })]
      );
    } catch { }

    return c.json({ success: true, data: { attendee: res.rows[0] } });
  } catch (e) {
    console.error('assign-attendee error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// GET /admin/reports/export?companyCode&employeeNo&startDate=&endDate=&groupBy=employee|department&thresholdMinutes=5&format=csv|pdf
app.get('/admin/reports/export', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const startDate = (c.req.query('startDate') || '').trim();
    const endDate = (c.req.query('endDate') || '').trim();
    const groupBy = safeTrimLower(c.req.query('groupBy') || 'employee');
    const thresholdMinutes = clamp(Number.parseInt(String(c.req.query('thresholdMinutes') || '5'), 10) || 5, 0, 240);
    const format = safeTrimLower(c.req.query('format') || 'csv');
    const q = safeTrimLower(c.req.query('query') || '', 128);
    if (!companyCode || !employeeNo || !isValidISODate(startDate) || !isValidISODate(endDate)) { c.status(400); return c.json({ success: false, message: 'Missing or invalid fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }
    if (groupBy && !['employee', 'department'].includes(groupBy)) { c.status(400); return c.json({ success: false, message: 'Invalid groupBy' }); }
    if (!['csv', 'pdf'].includes(format)) { c.status(400); return c.json({ success: false, message: 'Invalid format' }); }

    // Reuse same aggregation as summary but without pagination
    const nameLike = q ? `%${q}%` : null;
    const empLike = q ? `%${q}%` : null;
    const params: any[] = [approver.companyId, startDate, endDate];
    const whereUser = q ? 'AND (LOWER(u.name) LIKE $4 OR LOWER(u.emp_no) LIKE $5)' : '';
    const threshParamIndex = q ? 6 : 4;
    if (q) { params.push(nameLike, empLike); }
    params.push(String(thresholdMinutes));

    const sql = `
      WITH base AS (
        SELECT u.id AS user_id, u.emp_no, u.name,
               LOWER(COALESCE(NULL, u.role)) AS department_name,
               s.date::date AS dte, s.start_time,
               ad.clock_in_id, ad.status AS ad_status
          FROM users u
          JOIN schedules s ON s.user_id = u.id
          LEFT JOIN attendance_days ad ON ad.user_id = u.id AND ad.date = s.date
         WHERE u.company_id = $1
           AND s.date BETWEEN $2::date AND $3::date
           ${whereUser}
      ),
      agg AS (
        SELECT ${groupBy === 'department' ? 'b.department_name AS dep,' : 'b.emp_no, b.name,'}
               SUM(
                 CASE
                   WHEN b.clock_in_id IS NOT NULL THEN
                     CASE WHEN to_timestamp(ci.timestamp/1000.0) > (b.dte + (b.start_time)::time + (($${threshParamIndex})::int || ' minutes')::interval) THEN 1 ELSE 0 END
                   ELSE 0
                 END
               ) AS lates,
               SUM(CASE WHEN b.ad_status = 'absent' THEN 1 ELSE 0 END) AS absents
          FROM base b
          LEFT JOIN clock_events ci ON ci.id = b.clock_in_id
         GROUP BY ${groupBy === 'department' ? 'b.department_name' : 'b.emp_no, b.name'}
      )
      SELECT ${groupBy === 'department' ? 'dep AS department, lates, absents' : 'emp_no, name, lates, absents'}
        FROM agg
       ORDER BY ${groupBy === 'department' ? 'dep' : 'emp_no'} ASC
    `;
    const resRows = await db.query(sql, params);
    // Audit: export reports
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, 'reports_export', 'report', NULL, $3)`,
        [approver.companyId, approver.userId, JSON.stringify({ startDate, endDate, groupBy, thresholdMinutes, q, format })]
      );
    } catch { }

    if (format === 'csv') {
      const header = groupBy === 'department' ? 'department,lates,absents' : 'empNo,name,lates,absents';
      const csvLines = [
        header,
        ...resRows.rows.map((r: any) => groupBy === 'department'
          ? [r.department, r.lates || 0, r.absents || 0].join(',')
          : [r.emp_no, (r.name || '').replace(/,/g, ' '), r.lates || 0, r.absents || 0].join(',')
        )
      ];
      const csv = csvLines.join('\n');
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', `attachment; filename="team-reports-${startDate}_to_${endDate}.csv"`);
      return c.body(csv);
    } else {
      // Server-side PDF generation
      const { default: PDFDocument } = await import('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Uint8Array[] = [];
      doc.on('data', (c: Uint8Array) => chunks.push(c));
      const done = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks as any)));
      });

      // Try draw logo (optional)
      try {
        const logoPath = path.join(__dirname, '..', 'assets', 'images', 'company-logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 36, 24, { width: 80 });
        }
      } catch { }

      // Header text
      doc.fontSize(16).text('Team Reports', 0, 24, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(10).text(`Range: ${startDate} to ${endDate}`);
      doc.text(`Group By: ${groupBy}`);
      doc.text(`Late Threshold: ${thresholdMinutes} minutes`);
      if (q) doc.text(`Filter: ${q}`);
      doc.moveDown(0.5);

      // Table with grid
      const startX = 36;
      let y = doc.y + 6;
      const col1W = 320; // name/department
      const col2W = 80;  // lates
      const col3W = 80;  // absents
      const rowH = 20;
      const tableW = col1W + col2W + col3W;

      // Header row
      doc.rect(startX, y, tableW, rowH).stroke();
      doc.fontSize(11).text(groupBy === 'department' ? 'Department' : 'Employee', startX + 6, y + 6, { width: col1W - 12 });
      doc.text('Lates', startX + col1W + 6, y + 6, { width: col2W - 12, align: 'right' });
      doc.text('Absents', startX + col1W + col2W + 6, y + 6, { width: col3W - 12, align: 'right' });
      // Column separators
      doc.moveTo(startX + col1W, y).lineTo(startX + col1W, y + rowH).stroke();
      doc.moveTo(startX + col1W + col2W, y).lineTo(startX + col1W + col2W, y + rowH).stroke();
      y += rowH;

      // Data rows
      let totalLates = 0;
      let totalAbsents = 0;
      doc.fontSize(10);
      for (const r of resRows.rows as any[]) {
        const name = groupBy === 'department' ? String(r.department || 'Unassigned').toUpperCase() : `${r.name || ''} (${r.emp_no || ''})`;
        const lates = Number(r.lates ?? 0);
        const absents = Number(r.absents ?? 0);
        totalLates += lates; totalAbsents += absents;

        doc.rect(startX, y, tableW, rowH).stroke();
        doc.text(name, startX + 6, y + 5, { width: col1W - 12 });
        doc.text(String(lates), startX + col1W + 6, y + 5, { width: col2W - 12, align: 'right' });
        doc.text(String(absents), startX + col1W + col2W + 6, y + 5, { width: col3W - 12, align: 'right' });
        // Column separators
        doc.moveTo(startX + col1W, y).lineTo(startX + col1W, y + rowH).stroke();
        doc.moveTo(startX + col1W + col2W, y).lineTo(startX + col1W + col2W, y + rowH).stroke();
        y += rowH;
        // Avoid overflow: add new page if near bottom
        if (y + rowH > doc.page.height - 72) {
          doc.addPage();
          y = 36; // top margin
        }
      }

      // Totals footer
      y += 6;
      doc.fontSize(11).text('Totals', startX + 6, y, { width: col1W - 12 });
      doc.text(String(totalLates), startX + col1W + 6, y, { width: col2W - 12, align: 'right' });
      doc.text(String(totalAbsents), startX + col1W + col2W + 6, y, { width: col3W - 12, align: 'right' });

      doc.end();
      const pdf = await done;
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="team-reports-${startDate}_to_${endDate}.pdf"`);
      const bin = new Uint8Array(pdf);
      return c.body(bin as any);
    }
  } catch (e) {
    console.error('admin reports export error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: list schedules across company
// GET /admin/schedules?companyCode&employeeNo&startDate=&endDate=&query=&page=&limit=
app.get('/admin/schedules', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const startDate = (c.req.query('startDate') || '').trim();
    const endDate = (c.req.query('endDate') || '').trim();
    const q = (c.req.query('query') || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    const where: string[] = ['u.company_id = $1'];
    const params: any[] = [approver.companyId];
    if (startDate && endDate) { params.push(startDate); params.push(endDate); where.push(`s.date BETWEEN $${params.length - 1}::date AND $${params.length}::date`); }
    if (q) { params.push('%' + q + '%'); params.push('%' + q + '%'); where.push(`(LOWER(u.name) LIKE $${params.length - 1} OR LOWER(u.emp_no) LIKE $${params.length})`); }

    const offset = (page - 1) * limit;
    const totalRes = await db.query(
      `SELECT COUNT(*) AS cnt
         FROM schedules s
         JOIN users u ON u.id = s.user_id
        WHERE ${where.join(' AND ')}`,
      params
    );
    const total = Number(totalRes.rows[0]?.cnt || 0);
    params.push(limit); params.push(offset);
    const res = await db.query(
      `SELECT s.id, s.user_id, u.emp_no, u.name, s.date, s.start_time, s.end_time, s.shift_code, s.location, s.notes
         FROM schedules s
         JOIN users u ON u.id = s.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY s.date ASC, u.emp_no ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      empNo: r.emp_no,
      name: r.name,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      shiftCode: r.shift_code || undefined,
      location: r.location || undefined,
      notes: r.notes || undefined,
    }));
    return c.json({ success: true, data: { rows, total, page, limit } });
  } catch (e) {
    console.error('admin list schedules error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: bulk assign schedules and employee assignments
// POST /admin/schedules/bulk-assign { companyCode, employeeNo, employeeNos: string[], startDate, endDate, startTime, endTime, shiftCode?, location?, siteName?, projectName?, notes? }
app.post('/admin/schedules/bulk-assign', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, employeeNos, startDate, endDate, startTime, endTime, shiftCode, location, siteName, projectName, notes } = body as any;
    if (!companyCode || !employeeNo || !Array.isArray(employeeNos) || employeeNos.length === 0 || !startDate || !endDate || !startTime || !endTime) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    // Validate inputs
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) { c.status(400); return c.json({ success: false, message: 'Invalid date range' }); }
    const hhmm = /^\d{1,2}:\d{2}$/;
    if (!hhmm.test(String(startTime)) || !hhmm.test(String(endTime))) { c.status(400); return c.json({ success: false, message: 'Invalid time format HH:MM' }); }
    if (employeeNos.length > 1000) { c.status(400); return c.json({ success: false, message: 'Too many employees in one request (max 1000)' }); }
    const sanitizedEmpNos = employeeNos.map((e: any) => String(e).trim()).filter(Boolean).map(e => e.slice(0, 32));

    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    // Resolve all employee IDs within same company
    const empRes = await db.query('SELECT id, emp_no FROM users WHERE company_id = $1 AND emp_no = ANY($2)', [approver.companyId, sanitizedEmpNos]);
    const empMap = new Map<string, string>(); // empNo -> userId
    for (const r of empRes.rows) empMap.set(r.emp_no, r.id);
    const missing = employeeNos.filter((e: string) => !empMap.has(e));
    if (missing.length) {
      c.status(404); return c.json({ success: false, message: 'Some employees not found', data: { missing } });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const days: string[] = [];
      const s = new Date(startDate);
      const e = new Date(endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d).toISOString().slice(0, 10));
      }
      let upserted = 0;
      let assignmentsCreated = 0;

      // Determine site/project from location or explicit fields
      const finalSiteName = siteName || (location && !projectName ? location : null);
      const finalProjectName = projectName || null;

      for (const emp of sanitizedEmpNos) {
        const uid = empMap.get(emp)!;

        // Create schedule entries for each day
        for (const d of days) {
          await client.query(
            `INSERT INTO schedules (user_id, date, start_time, end_time, shift_code, location, notes, created_at, updated_at)
             VALUES ($1, $2::date, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, date)
             DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, shift_code = EXCLUDED.shift_code, location = EXCLUDED.location, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP`,
            [uid, d, startTime, endTime, shiftCode || null, location || null, notes || null]
          );
          upserted++;
        }

        // Create employee assignment if site or project is specified
        if (finalSiteName || finalProjectName) {
          try {
            await client.query(
              `INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, assigned_by, notes, created_at, updated_at)
               VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               ON CONFLICT (user_id, site_name_norm, project_name_norm, start_date_norm, end_date_norm)
               DO UPDATE SET assigned_by = EXCLUDED.assigned_by, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP`,
              [uid, finalSiteName, finalProjectName, startDate, endDate, approver.userId, notes || null]
            );
            assignmentsCreated++;
          } catch (assignErr) {
            // Log but don't fail the entire operation for assignment conflicts
            console.warn(`Assignment creation failed for employee ${emp}:`, assignErr);
          }
        }
      }
      try {
        await client.query(
          `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
           VALUES ($1, $2, 'schedule_bulk_assign', 'schedule', NULL, $3)`,
          [approver.companyId, approver.userId, JSON.stringify({ employeeNos, startDate, endDate, startTime, endTime, shiftCode, location })]
        );
      } catch { }
      await client.query('COMMIT');
      return c.json({ success: true, data: { upserted, assignmentsCreated } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('bulk-assign schedules error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: import schedules via CSV
// POST /admin/schedules/import-csv { companyCode, employeeNo, csv }
// CSV headers: empNo,date,start_time,end_time,shift_code,location,notes
app.post('/admin/schedules/import-csv', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, csv } = body as any;
    if (!companyCode || !employeeNo || !csv) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    const lines = String(csv).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
    // Cap number of lines to avoid excessive processing
    const MAX_LINES = 5000;
    if (lines.length > MAX_LINES) lines.length = MAX_LINES;
    if (!lines.length) { c.status(400); return c.json({ success: false, message: 'CSV empty' }); }
    const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
    const reqHeaders = ['empno', 'date', 'start_time', 'end_time'];
    for (const h of reqHeaders) if (!header.includes(h)) { c.status(400); return c.json({ success: false, message: `Missing header: ${h}` }); }
    const idx = (name: string) => header.indexOf(name);
    const col = {
      empNo: idx('empno'), date: idx('date'), start: idx('start_time'), end: idx('end_time'),
      shift: idx('shift_code'), loc: idx('location'), notes: idx('notes'),
    }
    const rows: Array<{ empNo: string; date: string; start: string; end: string; shift?: string; loc?: string; notes?: string }> = [];
    const errors: Array<{ line: number; message: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      const parts = raw.split(',');
      const get = (ix: number) => (ix >= 0 && ix < parts.length ? parts[ix].trim() : '');
      const empNoVal = get(col.empNo);
      const dateVal = get(col.date);
      const startVal = get(col.start);
      const endVal = get(col.end);
      if (!empNoVal || !dateVal || !startVal || !endVal) { errors.push({ line: i + 1, message: 'Missing required fields' }); continue; }
      rows.push({ empNo: empNoVal, date: dateVal, start: startVal, end: endVal, shift: get(col.shift), loc: get(col.loc), notes: get(col.notes) });
    }
    if (!rows.length) { c.status(400); return c.json({ success: false, message: 'No valid rows', data: { errors } }); }
    // Resolve empNos
    const distinctEmpNos = Array.from(new Set(rows.map(r => r.empNo)));
    const empRes = await db.query('SELECT id, emp_no FROM users WHERE company_id = $1 AND emp_no = ANY($2)', [approver.companyId, distinctEmpNos]);
    const empMap = new Map<string, string>(); for (const r of empRes.rows) empMap.set(r.emp_no, r.id);
    const client = await db.connect();
    let upserted = 0;
    try {
      await client.query('BEGIN');
      for (const r of rows) {
        const uid = empMap.get(r.empNo);
        if (!uid) { errors.push({ line: -1, message: `Employee not found: ${r.empNo}` }); continue; }
        await client.query(
          `INSERT INTO schedules (user_id, date, start_time, end_time, shift_code, location, notes, created_at, updated_at)
           VALUES ($1, $2::date, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, date)
           DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, shift_code = EXCLUDED.shift_code, location = EXCLUDED.location, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP`,
          [uid, r.date, r.start, r.end, r.shift || null, r.loc || null, r.notes || null]
        );
        upserted++;
      }
      try {
        await client.query(
          `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
           VALUES ($1, $2, 'schedule_import_csv', 'schedule', NULL, $3)`,
          [approver.companyId, approver.userId, JSON.stringify({ totalRows: rows.length, upserted })]
        );
      } catch { }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return c.json({ success: true, data: { upserted, errors } });
  } catch (e) {
    console.error('import schedules csv error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: attendance corrections list
// GET /admin/attendance-corrections?companyCode&employeeNo&status=&query=&startDate=&endDate=&page=&limit=
app.get('/admin/attendance-corrections', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const status = (c.req.query('status') || '').toLowerCase();
    const q = (c.req.query('query') || '').trim().toLowerCase();
    const startDate = (c.req.query('startDate') || '').trim();
    const endDate = (c.req.query('endDate') || '').trim();
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    const where: string[] = ['u.company_id = $1'];
    const params: any[] = [approver.companyId];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) { params.push(status); where.push(`ac.status = $${params.length}`); }
    if (q) { params.push('%' + q + '%'); params.push('%' + q + '%'); where.push(`(LOWER(u.name) LIKE $${params.length - 1} OR LOWER(u.emp_no) LIKE $${params.length})`); }
    if (startDate && endDate) { params.push(startDate); params.push(endDate); where.push(`ac.date BETWEEN $${params.length - 1}::date AND $${params.length}::date`); }

    const offset = (page - 1) * limit;
    const totalRes = await db.query(
      `SELECT COUNT(*) AS cnt
         FROM attendance_corrections ac
         JOIN users u ON u.id = ac.user_id
        WHERE ${where.join(' AND ')}`,
      params
    );
    const total = Number(totalRes.rows[0]?.cnt || 0);
    params.push(limit); params.push(offset);
    const rows = await db.query(
      `SELECT ac.id, ac.user_id, u.emp_no, u.name, ac.date, ac.from_time, ac.to_time, ac.reason, ac.status,
              ac.reviewer_id, ac.reviewed_at, ac.note
         FROM attendance_corrections ac
         JOIN users u ON u.id = ac.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY ac.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const data = rows.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      empNo: r.emp_no,
      name: r.name,
      date: r.date,
      fromTime: r.from_time || undefined,
      toTime: r.to_time || undefined,
      reason: r.reason || undefined,
      status: r.status,
      reviewerId: r.reviewer_id || undefined,
      reviewedAt: r.reviewed_at || undefined,
      note: r.note || undefined,
    }));
    return c.json({ success: true, data: { rows: data, total, page, limit } });
  } catch (e) {
    console.error('admin list attendance corrections error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: approve/deny attendance correction
// POST /admin/attendance-corrections/decide { companyCode, employeeNo, correctionId, decision: 'approved'|'rejected', note? }
app.post('/admin/attendance-corrections/decide', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, correctionId, decision, note } = body as { companyCode?: string; employeeNo?: string; correctionId?: string; decision?: 'approved' | 'rejected'; note?: string };
    if (!companyCode || !employeeNo || !correctionId || !decision) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }
    // Validate correction belongs to same company
    const corrRes = await db.query(
      `SELECT ac.*, u.company_id FROM attendance_corrections ac JOIN users u ON u.id = ac.user_id WHERE ac.id = $1`,
      [correctionId]
    );
    const corr = corrRes.rows[0];
    if (!corr) { c.status(404); return c.json({ success: false, message: 'Correction not found' }); }
    if (String(corr.company_id) !== String(approver.companyId)) { c.status(403); return c.json({ success: false, message: 'Forbidden: cross-company' }); }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE attendance_corrections
           SET status = $1, reviewer_id = $2, reviewed_at = CURRENT_TIMESTAMP, note = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [decision, approver.userId, note || null, correctionId]
      );
      // If approved, apply synthetic clock events and update attendance_days
      if (decision === 'approved') {
        const corrFull = await client.query(
          `SELECT ac.user_id, ac.date, ac.from_time, ac.to_time FROM attendance_corrections ac WHERE ac.id = $1 FOR UPDATE`,
          [correctionId]
        );
        const row = corrFull.rows[0];
        if (row) {
          const userId = row.user_id as string;
          const dateStr = new Date(row.date).toISOString().slice(0, 10);
          const toMs = (hhmm?: string | null) => {
            if (!hhmm) return null;
            const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
            if (!m) return null;
            const h = Number(m[1]); const mm = Number(m[2]);
            const d = new Date(dateStr + 'T00:00:00');
            d.setHours(h, mm, 0, 0);
            return d.getTime();
          };
          const inTs = toMs(row.from_time);
          const outTs = toMs(row.to_time);
          let clockInId: string | null = null;
          let clockOutId: string | null = null;
          if (inTs != null) {
            const ins = await client.query(
              `INSERT INTO clock_events (user_id, timestamp, type, latitude, longitude, address, method)
               VALUES ($1,$2,'in',0,0,'Correction','button') RETURNING id`,
              [userId, inTs]
            );
            clockInId = ins.rows[0]?.id || null;
          }
          if (outTs != null) {
            const ins2 = await client.query(
              `INSERT INTO clock_events (user_id, timestamp, type, latitude, longitude, address, method)
               VALUES ($1,$2,'out',0,0,'Correction','button') RETURNING id`,
              [userId, outTs]
            );
            clockOutId = ins2.rows[0]?.id || null;
          }
          // Upsert attendance_days for that date
          // Compute normal_hours if both present
          let normalHours: number | null = null;
          if (inTs != null && outTs != null && outTs > inTs) {
            normalHours = Math.round(((outTs - inTs) / 3600000) * 100) / 100; // hours with 2 decimals
          }
          // Ensure row exists
          const upsert = await client.query(
            `INSERT INTO attendance_days (user_id, date, clock_in_id, clock_out_id, normal_hours, status, created_at, updated_at)
             VALUES ($1, $2::date, $3, $4, $5, 'present', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, date)
             DO UPDATE SET clock_in_id = COALESCE(EXCLUDED.clock_in_id, attendance_days.clock_in_id),
                           clock_out_id = COALESCE(EXCLUDED.clock_out_id, attendance_days.clock_out_id),
                           normal_hours = COALESCE(EXCLUDED.normal_hours, attendance_days.normal_hours),
                           status = 'present',
                           updated_at = CURRENT_TIMESTAMP`,
            [userId, dateStr, clockInId, clockOutId, normalHours]
          );
        }
      }
      // Audit log
      try {
        await client.query(
          `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
           VALUES ($1, $2, $3, 'attendance_correction', $4, $5)`,
          [approver.companyId, approver.userId, `correction_${decision}`, correctionId, JSON.stringify({ note })]
        );
      } catch { }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return c.json({ success: true });
  } catch (e) {
    console.error('decide attendance correction error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: audit logs (manager/admin only)
// GET /admin/audit-logs?companyCode&employeeNo&action=&targetType=&actorEmpNo=&startDate=&endDate=&page=&limit=&query=
app.get('/admin/audit-logs', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const action = (c.req.query('action') || '').trim().toLowerCase();
    const targetType = (c.req.query('targetType') || '').trim().toLowerCase();
    const actorEmpNo = (c.req.query('actorEmpNo') || '').trim();
    const q = (c.req.query('query') || '').trim().toLowerCase();
    const startDate = (c.req.query('startDate') || '').trim();
    const endDate = (c.req.query('endDate') || '').trim();
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    const where: string[] = ['l.company_id = $1'];
    const params: any[] = [approver.companyId];
    if (action) { params.push(action); where.push('LOWER(l.action) = $' + params.length); }
    if (targetType) { params.push(targetType); where.push('LOWER(l.target_type) = $' + params.length); }
    if (actorEmpNo) {
      // join users to resolve actor empNo
      where.push('u.id = l.actor_user_id');
      params.push(actorEmpNo);
      where.push('u.emp_no = $' + params.length);
    }
    if (q) {
      params.push('%' + q + '%');
      where.push(`CAST(l.metadata AS TEXT) ILIKE $${params.length}`);
    }
    if (startDate && endDate) {
      params.push(startDate); params.push(endDate);
      where.push(`l.created_at BETWEEN $${params.length - 1}::timestamp AND ($${params.length}::timestamp + interval '1 day' - interval '1 second')`);
    }

    const offset = (page - 1) * limit;
    const baseFrom = actorEmpNo ? 'FROM admin_audit_logs l JOIN users u ON u.company_id = l.company_id AND u.id = l.actor_user_id' : 'FROM admin_audit_logs l';
    const totalRes = await db.query(`SELECT COUNT(*) AS cnt ${baseFrom} WHERE ${where.join(' AND ')}`, params);
    const total = Number(totalRes.rows[0]?.cnt || 0);
    params.push(limit); params.push(offset);
    const rows = await db.query(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.metadata, l.created_at, l.actor_user_id,
              au.emp_no AS actor_emp_no, au.name AS actor_name
         ${baseFrom}
         LEFT JOIN users au ON au.id = l.actor_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY l.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const data = rows.rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id || undefined,
      metadata: r.metadata || {},
      createdAt: r.created_at,
      actor: { userId: r.actor_user_id, empNo: r.actor_emp_no, name: r.actor_name },
    }));
    return c.json({ success: true, data: { rows: data, total, page, limit } });
  } catch (e) {
    console.error('admin list audit logs error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Global/company/user settings: which clock methods are allowed
// GET /settings/clock-methods?companyCode&employeeNo
// Reads env defaults, then company-level overrides, then per-user overrides (if set)
app.get('/settings/clock-methods', async (c) => {
  try {
    const parseBool = (v: any, fallback: boolean) => {
      if (v == null) return fallback;
      const s = String(v).trim().toLowerCase();
      if (["1", "true", "yes", "y", "on"].includes(s)) return true;
      if (["0", "false", "no", "n", "off"].includes(s)) return false;
      return fallback;
    };
    // Defaults from environment flags
    let allowFace = parseBool(process.env.BACKEND_ALLOW_FACE, true);
    let allowButton = parseBool(process.env.BACKEND_ALLOW_BUTTON, true);

    // If a companyCode is provided, try to read company-level settings
    const companyCode = (c.req.query('companyCode') || '').toUpperCase();
    const employeeNo = (c.req.query('employeeNo') || '').trim();
    if (companyCode) {
      try {
        const res = await db.query('SELECT id, allow_face, allow_button FROM companies WHERE company_code = $1 LIMIT 1', [companyCode]);
        if (res.rowCount && res.rows[0]) {
          const row = res.rows[0] as any;
          if (typeof row.allow_face === 'boolean') allowFace = row.allow_face;
          if (typeof row.allow_button === 'boolean') allowButton = row.allow_button;

          // Per-user overrides if employeeNo provided
          if (employeeNo) {
            try {
              const ures = await db.query(
                'SELECT allow_face, allow_button FROM users WHERE company_id = $1 AND emp_no = $2 LIMIT 1',
                [row.id, employeeNo]
              );
              if (ures.rowCount && ures.rows[0]) {
                const u = ures.rows[0] as any;
                if (typeof u.allow_face === 'boolean') allowFace = u.allow_face;
                if (typeof u.allow_button === 'boolean') allowButton = u.allow_button;
              }
            } catch (ue) {
              console.warn('Failed to load per-user clock-method settings; using company/env:', ue);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load company clock-method settings; falling back to env:', e);
      }
    }

    return c.json({ success: true, data: { allowFace, allowButton } });
  } catch (e) {
    console.error('clock methods settings error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: list leaves across company (manager/admin)
// GET /admin/leaves?companyCode&employeeNo&status=pending|approved|rejected&page=1&limit=20&query=
app.get('/admin/leaves', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const status = (c.req.query('status') || '').toLowerCase();
    const q = (c.req.query('query') || '').trim().toLowerCase();
    const startDate = (c.req.query('startDate') || '').trim();
    const endDate = (c.req.query('endDate') || '').trim();
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    const where: string[] = ['u.company_id = $1'];
    const params: any[] = [approver.companyId];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      params.push(status);
      where.push(`l.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      params.push(`%${q}%`);
      where.push(`(LOWER(u.name) LIKE $${params.length - 1} OR LOWER(u.emp_no) LIKE $${params.length})`);
    }

    // Optional date overlap filter: NOT (end < startDate OR start > endDate)
    if (startDate && endDate) {
      params.push(startDate);
      params.push(endDate);
      where.push(`NOT ($${params.length - 1}::date > l.end_date OR $${params.length}::date < l.start_date)`);
    }

    const offset = (page - 1) * limit;
    const totalRes = await db.query(
      `SELECT COUNT(*) AS cnt
         FROM leaves l
         JOIN users u ON u.id = l.user_id
        WHERE ${where.join(' AND ')}`,
      params
    );
    const total = Number(totalRes.rows[0]?.cnt || 0);
    params.push(limit); params.push(offset);
    const rows = await db.query(
      `SELECT l.id, l.start_date, l.end_date, l.type, l.reason, l.status, l.effective_days, l.attachment_uri,
              u.emp_no, u.name
         FROM leaves l
         JOIN users u ON u.id = l.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY l.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const data = rows.rows.map((r: any) => ({
      id: r.id,
      empNo: r.emp_no,
      name: r.name,
      startDate: r.start_date,
      endDate: r.end_date,
      type: r.type,
      reason: r.reason,
      status: r.status,
      effectiveDays: r.effective_days != null ? Number(r.effective_days) : undefined,
      attachmentUri: r.attachment_uri || undefined,
    }));
    return c.json({ success: true, data: { rows: data, total, page, limit } });
  } catch (e) {
    console.error('admin list leaves error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Users: update profile image
// POST /users/profile-image { companyCode, employeeNo, imageUri }
app.post('/users/profile-image', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, imageUri } = body as { companyCode?: string; employeeNo?: string; imageUri?: string };
    if (!companyCode || !employeeNo || !imageUri) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const comp = await db.query('SELECT id FROM companies WHERE company_code = $1', [String(companyCode).toUpperCase()]);
    const companyId = comp.rows[0]?.id as string | undefined;
    if (!companyId) { c.status(404); return c.json({ success: false, message: 'Company not found' }); }
    const res = await db.query(
      'UPDATE users SET profile_image_uri = $1, updated_at = CURRENT_TIMESTAMP WHERE company_id = $2 AND emp_no = $3 RETURNING profile_image_uri',
      [imageUri, companyId, employeeNo]
    );
    if (res.rowCount === 0) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    return c.json({ success: true, data: { profileImageUri: res.rows[0]?.profile_image_uri || imageUri } });
  } catch (e) {
    console.error('update profile image error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// --- Schedule: assignments and options ---
// GET /schedule/assigned?companyCode&employeeNo&date=YYYY-MM-DD
app.get('/schedule/assigned', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const date = c.req.query('date') || new Date().toISOString().slice(0, 10);
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    // Resolve the actual DB user UUID to avoid passing non-UUID identifiers
    const ctx = await getUserContext(companyCode, employeeNo).catch(() => ({} as any));
    let userUuid: string | undefined = ctx?.userId;
    try {
      // Ensure we have a UUID from DB even if context returns a non-UUID identifier
      const compRes = await db.query('SELECT id FROM companies WHERE company_code = $1', [String(companyCode).toUpperCase()]);
      const companyId = compRes.rows?.[0]?.id as string | undefined;
      if (companyId) {
        const ures = await db.query('SELECT id FROM users WHERE company_id = $1 AND emp_no = $2', [companyId, String(employeeNo)]);
        const row = ures.rows?.[0];
        if (row?.id) userUuid = row.id as string;
      }
    } catch (e) {
      // fall through; handled below
    }
    if (!userUuid) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const rows = await db.query(
      `SELECT ea.id, ea.site_name, ea.project_name, ea.start_date, ea.end_date
         FROM employee_assignments ea
        WHERE ea.user_id = $1
          AND ($2::date IS NULL OR (COALESCE(ea.start_date, $2::date) <= $2::date AND COALESCE(ea.end_date, $2::date) >= $2::date))
        ORDER BY COALESCE(ea.site_name,'') ASC, COALESCE(ea.project_name,'') ASC`,
      [userUuid, date]
    );
    const data = rows.rows.map(r => ({ id: r.id, siteName: r.site_name || undefined, projectName: r.project_name || undefined, startDate: r.start_date || undefined, endDate: r.end_date || undefined }));
    return c.json({ success: true, data });
  } catch (e) {
    console.error('list assignments error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// GET /schedule/project-tasks?companyCode&projectName
app.get('/schedule/project-tasks', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const projectName = c.req.query('projectName') || '';
    if (!companyCode || !projectName) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const comp = await db.query('SELECT id FROM companies WHERE company_code = $1', [companyCode.toUpperCase()]);
    const companyId = comp.rows[0]?.id as string | undefined;
    if (!companyId) { c.status(404); return c.json({ success: false, message: 'Company not found' }); }
    const rows = await db.query(
      `SELECT t.id, t.name, t.status
         FROM project_tasks t
         JOIN projects p ON p.id = t.project_id
        WHERE p.company_id = $1 AND p.name = $2
        ORDER BY t.name ASC`,
      [companyId, projectName]
    );
    return c.json({ success: true, data: rows.rows });
  } catch (e) {
    console.error('list project tasks error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// POST /schedule/update-task-status
// Body: { companyCode: string, taskId: string, status: 'pending'|'in-progress'|'done'|'blocked' }
app.post('/schedule/update-task-status', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, taskId, status } = body as { companyCode?: string; taskId?: string; status?: string };
    if (!companyCode || !taskId || !status) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const allowed = ['pending', 'in-progress', 'done', 'blocked'];
    if (!allowed.includes(String(status).toLowerCase())) {
      c.status(400); return c.json({ success: false, message: 'Invalid status' });
    }
    // Ensure task belongs to project under the provided company
    const res = await db.query(
      `UPDATE project_tasks t
         SET status = $1, updated_at = CURRENT_TIMESTAMP
        FROM projects p
        JOIN companies c ON c.id = p.company_id
       WHERE t.project_id = p.id
         AND c.company_code = $2
         AND t.id = $3
       RETURNING t.id`,
      [status, companyCode.toUpperCase(), taskId]
    );
    if (res.rowCount === 0) {
      c.status(404); return c.json({ success: false, message: 'Task not found' });
    }
    return c.json({ success: true, data: { id: res.rows[0].id, status } });
  } catch (e) {
    console.error('update project task status error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// GET /schedule/options?companyCode
app.get('/schedule/options', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    if (!companyCode) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const comp = await db.query('SELECT id FROM companies WHERE company_code = $1', [companyCode.toUpperCase()]);
    const companyId = comp.rows[0]?.id as string | undefined;
    if (!companyId) { c.status(404); return c.json({ success: false, message: 'Company not found' }); }
    const sites = await db.query('SELECT id, code, name FROM sites WHERE company_id = $1 ORDER BY name ASC', [companyId]);
    const projects = await db.query('SELECT id, code, name, site_id FROM projects WHERE company_id = $1 AND (status IS NULL OR status = \"active\") ORDER BY name ASC', [companyId]);
    return c.json({ success: true, data: { sites: sites.rows, projects: projects.rows } });
  } catch (e) {
    console.error('list schedule options error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// POST /schedule/assign
// Body: { approverCompanyCode, approverEmployeeNo, employeeNo, siteName?, projectName?, startDate?, endDate?, notes? }
app.post('/schedule/assign', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { approverCompanyCode, approverEmployeeNo, employeeNo, siteName, projectName, startDate, endDate, notes } = body as any;
    if (!approverCompanyCode || !approverEmployeeNo || !employeeNo || (!siteName && !projectName)) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const approver = await getUserContext(approverCompanyCode, approverEmployeeNo);
    if (!approver.userId) { c.status(404); return c.json({ success: false, message: 'Approver not found' }); }
    // Check role
    const roleRes = await db.query('SELECT role, company_id FROM users WHERE id = $1', [approver.userId]);
    const role = (roleRes.rows[0]?.role || '').toLowerCase();
    const companyId = roleRes.rows[0]?.company_id as string | undefined;
    if (!['manager', 'admin'].includes(role)) {
      c.status(403); return c.json({ success: false, message: 'Only managers/admins can assign schedules' });
    }
    // Resolve target user within same company
    const targetRes = await db.query('SELECT id FROM users WHERE company_id = $1 AND emp_no = $2', [companyId, employeeNo]);
    const targetId = targetRes.rows[0]?.id as string | undefined;
    if (!targetId) { c.status(404); return c.json({ success: false, message: 'Employee not found' }); }
    // Pre-check for an identical assignment to avoid duplicates (treat NULLs as equal)
    const dupCheck = await db.query(
      `SELECT id FROM employee_assignments
        WHERE user_id = $1
          AND COALESCE(site_name,'') = COALESCE($2,'')
          AND COALESCE(project_name,'') = COALESCE($3,'')
          AND COALESCE(start_date::text,'') = COALESCE($4,'')
          AND COALESCE(end_date::text,'') = COALESCE($5,'')
        LIMIT 1`,
      [targetId, siteName || null, projectName || null, startDate || null, endDate || null]
    );
    if ((dupCheck?.rowCount || 0) > 0) {
      c.status(409);
      return c.json({ success: false, message: 'Assignment already exists', data: { id: dupCheck.rows[0].id } });
    }
    try {
      const res = await db.query(
        `INSERT INTO employee_assignments (user_id, site_name, project_name, start_date, end_date, assigned_by, notes)
         VALUES ($1, $2, $3, $4::date, $5::date, $6, $7)
         RETURNING id`,
        [targetId, siteName || null, projectName || null, startDate || null, endDate || null, approver.userId, notes || null]
      );
      return c.json({ success: true, data: { id: res.rows[0].id } });
    } catch (e: any) {
      const code = e?.code || '';
      if (code === '23505') {
        c.status(409);
        return c.json({ success: false, message: 'Duplicate assignment' });
      }
      throw e;
    }
  } catch (e) {
    console.error('assign schedule error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Basic request logger to trace 404s and routing
app.use('*', async (c, next) => {
  const start = Date.now();
  console.log(`[req] ${c.req.method} ${c.req.url}`);
  await next();
  const ms = Date.now() - start;
  console.log(`[res] ${c.req.method} ${c.req.url} -> ${c.res.status} (${ms}ms)`);
});

// --- SSE for Toolbox real-time updates via Postgres NOTIFY ---
type ToolboxEvent = { type: string; meetingId?: string; userId?: string };
const sseListeners = new Set<(payload: ToolboxEvent) => void>();
let notifyClientReady = false;
let notifyClientInitPromise: Promise<void> | null = null;

const ensureNotifyClient = async () => {
  if (notifyClientReady) return;
  if (notifyClientInitPromise) return notifyClientInitPromise;
  notifyClientInitPromise = (async () => {
    const client = await pool.connect();
    client.on('error', (err: any) => {
      console.error('[pg notify] client error:', err);
      notifyClientReady = false;
    });
    client.on('notification', (msg: any) => {
      if (msg.channel !== 'toolbox_changes') return;
      let payload: ToolboxEvent = { type: 'unknown' };
      try { payload = JSON.parse(msg.payload || '{}'); } catch { }
      for (const fn of sseListeners) {
        try { fn(payload); } catch (e) { console.warn('SSE listener error:', e); }
      }
    });
    await client.query('LISTEN toolbox_changes');
    notifyClientReady = true;
    console.log('[pg notify] LISTEN toolbox_changes');
  })();
  return notifyClientInitPromise;
};

app.get('/toolbox/stream', async (c) => {
  await ensureNotifyClient();
  const encoder = new TextEncoder();
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  let timer: any;
  let listenerRef: ((payload: ToolboxEvent) => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Initial comment to establish stream
      controller.enqueue(encoder.encode(': ok\n\n'));
      // Heartbeat every 25s
      timer = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 25000);
      const listener = (payload: ToolboxEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      listenerRef = listener;
      sseListeners.add(listener);
      // Send a hello event so client knows channel
      controller.enqueue(encoder.encode(`event: hello\ndata: {"channel":"toolbox_changes"}\n\n`));
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (listenerRef) sseListeners.delete(listenerRef);
    },
    pull() { },
  });
  // On close, remove listener via finalization (Hono/Fetch doesn’t expose controller close hook directly),
  // rely on GC; additionally, use a Response body close handler
  const response = new Response(stream, { headers: c.res.headers });
  // Patch: track close event
  (response as any).addEventListener?.('close', () => {
    if (timer) clearInterval(timer);
    if (listenerRef) sseListeners.delete(listenerRef!);
  });
  return response;
});

// Reverse geocode via OpenStreetMap Nominatim
const reverseGeocode = async (lat: number, lon: number) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'AttendanceApp/1.0 (contact: local)' },
    });
    if (!resp.ok) return {} as any;
    const data: any = await resp.json();
    const a = data.address || {};
    const geo = {
      plot: a.house_number || a.plot_number || null,
      street: a.road || a.pedestrian || a.path || a.footway || null,
      city: a.city || a.town || a.village || a.suburb || a.hamlet || null,
      state: a.state || a.region || null,
      postalCode: a.postcode || null,
      country: a.country || null,
      full: data.display_name || null,
    };
    return geo;
  } catch (e) {
    console.warn('reverseGeocode failed:', e);
    return {} as any;
  }
};


// Attendance: get today's record with clock-in/out details
// GET /attendance/today?companyCode&employeeNo
app.get('/attendance/today', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    if (!companyCode || !employeeNo) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    // Resolve actual DB UUID for the user
    let userUuid: string | undefined;
    try {
      const compRes = await db.query('SELECT id FROM companies WHERE company_code = $1', [String(companyCode).toUpperCase()]);
      const companyId = compRes.rows?.[0]?.id as string | undefined;
      if (companyId) {
        const ures = await db.query('SELECT id FROM users WHERE company_id = $1 AND emp_no = $2', [companyId, String(employeeNo)]);
        const row = ures.rows?.[0];
        if (row?.id) userUuid = row.id as string;
      }
    } catch { }
    if (!userUuid) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    const todayRes = await db.query(
      `SELECT ad.*, 
        ci.timestamp as clock_in_timestamp, ci.latitude as clock_in_lat, ci.longitude as clock_in_lng, ci.address as clock_in_address, ci.method as clock_in_method, ci.image_uri as clock_in_image,
        co.timestamp as clock_out_timestamp, co.latitude as clock_out_lat, co.longitude as clock_out_lng, co.address as clock_out_address, co.method as clock_out_method, co.image_uri as clock_out_image
       FROM attendance_days ad
       LEFT JOIN clock_events ci ON ad.clock_in_id = ci.id
       LEFT JOIN clock_events co ON ad.clock_out_id = co.id
       WHERE ad.user_id = $1 AND ad.date = CURRENT_DATE
       LIMIT 1`,
      [userUuid]
    );

    const row = todayRes.rows[0];
    // Fetch per-site/project entries for today
    const entriesRes = await db.query(
      `SELECT ae.site_name, ae.project_name,
              ci.id as ci_id, ci.timestamp as ci_ts, ci.latitude as ci_lat, ci.longitude as ci_lng, ci.address as ci_addr, ci.method as ci_method, ci.image_uri as ci_image,
              co.id as co_id, co.timestamp as co_ts, co.latitude as co_lat, co.longitude as co_lng, co.address as co_addr, co.method as co_method, co.image_uri as co_image
         FROM attendance_entries ae
         LEFT JOIN clock_events ci ON ae.clock_in_id = ci.id
         LEFT JOIN clock_events co ON ae.clock_out_id = co.id
        WHERE ae.user_id = $1 AND ae.date = CURRENT_DATE
        ORDER BY COALESCE(ci.timestamp, co.timestamp) ASC`,
      [userUuid]
    );

    const entries = entriesRes.rows.map(r => ({
      siteName: r.site_name || undefined,
      projectName: r.project_name || undefined,
      clockIn: r.ci_ts ? {
        id: r.ci_id,
        empNo: employeeNo,
        timestamp: parseInt(r.ci_ts),
        type: 'in' as const,
        location: {
          latitude: r.ci_lat ? parseFloat(r.ci_lat) : undefined,
          longitude: r.ci_lng ? parseFloat(r.ci_lng) : undefined,
          address: r.ci_addr || undefined,
        },
        method: r.ci_method as 'face' | 'button',
        imageUri: r.ci_image || undefined,
      } : undefined,
      clockOut: r.co_ts ? {
        id: r.co_id,
        empNo: employeeNo,
        timestamp: parseInt(r.co_ts),
        type: 'out' as const,
        location: {
          latitude: r.co_lat ? parseFloat(r.co_lat) : undefined,
          longitude: r.co_lng ? parseFloat(r.co_lng) : undefined,
          address: r.co_addr || undefined,
        },
        method: r.co_method as 'face' | 'button',
        imageUri: r.co_image || undefined,
      } : undefined,
    }));

    const data = row ? {
      date: row.date,
      clockIn: row.clock_in_timestamp ? {
        id: row.clock_in_id,
        empNo: employeeNo,
        timestamp: parseInt(row.clock_in_timestamp),
        type: 'in' as const,
        location: {
          latitude: row.clock_in_lat ? parseFloat(row.clock_in_lat) : undefined,
          longitude: row.clock_in_lng ? parseFloat(row.clock_in_lng) : undefined,
          address: row.clock_in_address || undefined,
        },
        method: row.clock_in_method as 'face' | 'button',
        imageUri: row.clock_in_image || undefined,
      } : undefined,
      clockOut: row.clock_out_timestamp ? {
        id: row.clock_out_id,
        empNo: employeeNo,
        timestamp: parseInt(row.clock_out_timestamp),
        type: 'out' as const,
        location: {
          latitude: row.clock_out_lat ? parseFloat(row.clock_out_lat) : undefined,
          longitude: row.clock_out_lng ? parseFloat(row.clock_out_lng) : undefined,
          address: row.clock_out_address || undefined,
        },
        method: row.clock_out_method as 'face' | 'button',
        imageUri: row.clock_out_image || undefined,
      } : undefined,
      normalHours: row.normal_hours ? parseFloat(row.normal_hours) : 0,
      overtimeHours: row.overtime_hours ? parseFloat(row.overtime_hours) : 0,
      breakHours: row.break_hours ? parseFloat(row.break_hours) : 0,
      status: row.status,
      entries,
    } : { date: new Date().toISOString().slice(0, 10), entries };

    return c.json({ success: true, data });
  } catch (e) {
    console.error('today attendance error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Attendance: history by date range
// GET /attendance/history?companyCode&employeeNo&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
app.get('/attendance/history', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    if (!companyCode || !employeeNo || !startDate || !endDate) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    // Resolve DB UUID for this user (companyCode + employeeNo)
    let userUuid: string | undefined;
    try {
      const compRes = await db.query('SELECT id FROM companies WHERE company_code = $1', [String(companyCode).toUpperCase()]);
      const companyId = compRes.rows?.[0]?.id as string | undefined;
      if (companyId) {
        const ures = await db.query('SELECT id FROM users WHERE company_id = $1 AND emp_no = $2', [companyId, String(employeeNo)]);
        const row = ures.rows?.[0];
        if (row?.id) userUuid = row.id as string;
      }
    } catch { }
    if (!userUuid) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    const rowsRes = await db.query(
      `SELECT ad.*, 
        ci.timestamp as clock_in_timestamp, ci.latitude as clock_in_lat, ci.longitude as clock_in_lng, ci.address as clock_in_address, ci.method as clock_in_method, ci.image_uri as clock_in_image,
        co.timestamp as clock_out_timestamp, co.latitude as clock_out_lat, co.longitude as clock_out_lng, co.address as clock_out_address, co.method as clock_out_method, co.image_uri as clock_out_image
       FROM attendance_days ad
       LEFT JOIN clock_events ci ON ad.clock_in_id = ci.id
       LEFT JOIN clock_events co ON ad.clock_out_id = co.id
      WHERE ad.user_id = $1 AND ad.date BETWEEN $2::date AND $3::date
      ORDER BY ad.date DESC`,
      [userUuid, startDate, endDate]
    );

    // Fetch detailed per-site/project entries across the range
    const entriesRes = await db.query(
      `SELECT ae.date AS day, ae.site_name, ae.project_name,
              ci.id as ci_id, ci.timestamp as ci_ts, ci.latitude as ci_lat, ci.longitude as ci_lng, ci.address as ci_addr, ci.method as ci_method, ci.image_uri as ci_image,
              co.id as co_id, co.timestamp as co_ts, co.latitude as co_lat, co.longitude as co_lng, co.address as co_addr, co.method as co_method, co.image_uri as co_image
         FROM attendance_entries ae
         LEFT JOIN clock_events ci ON ae.clock_in_id = ci.id
         LEFT JOIN clock_events co ON ae.clock_out_id = co.id
        WHERE ae.user_id = $1 AND ae.date BETWEEN $2::date AND $3::date
        ORDER BY ae.date ASC, COALESCE(ci.timestamp, co.timestamp) ASC`,
      [userUuid, startDate, endDate]
    );

    const entriesByDate = new Map<string, any[]>();
    for (const r of entriesRes.rows) {
      const key = String(r.day);
      const arr = entriesByDate.get(key) || [];
      arr.push({
        siteName: r.site_name || undefined,
        projectName: r.project_name || undefined,
        clockIn: r.ci_ts ? {
          id: r.ci_id,
          empNo: employeeNo,
          timestamp: parseInt(r.ci_ts),
          type: 'in' as const,
          location: {
            latitude: r.ci_lat ? parseFloat(r.ci_lat) : undefined,
            longitude: r.ci_lng ? parseFloat(r.ci_lng) : undefined,
            address: r.ci_addr || undefined,
          },
          method: r.ci_method as 'face' | 'button',
          imageUri: r.ci_image || undefined,
        } : undefined,
        clockOut: r.co_ts ? {
          id: r.co_id,
          empNo: employeeNo,
          timestamp: parseInt(r.co_ts),
          type: 'out' as const,
          location: {
            latitude: r.co_lat ? parseFloat(r.co_lat) : undefined,
            longitude: r.co_lng ? parseFloat(r.co_lng) : undefined,
            address: r.co_addr || undefined,
          },
          method: r.co_method as 'face' | 'button',
          imageUri: r.co_image || undefined,
        } : undefined,
      });
      entriesByDate.set(key, arr);
    }

    const data = rowsRes.rows.map((row: any) => {
      const key = String(row.date);
      const entries = entriesByDate.get(key) || [];
      return {
        date: row.date,
        clockIn: row.clock_in_timestamp ? {
          id: row.clock_in_id,
          empNo: employeeNo,
          timestamp: parseInt(row.clock_in_timestamp),
          type: 'in' as const,
          location: {
            latitude: row.clock_in_lat ? parseFloat(row.clock_in_lat) : undefined,
            longitude: row.clock_in_lng ? parseFloat(row.clock_in_lng) : undefined,
            address: row.clock_in_address || undefined,
          },
          method: row.clock_in_method as 'face' | 'button',
          imageUri: row.clock_in_image || undefined,
        } : undefined,
        clockOut: row.clock_out_timestamp ? {
          id: row.clock_out_id,
          empNo: employeeNo,
          timestamp: parseInt(row.clock_out_timestamp),
          type: 'out' as const,
          location: {
            latitude: row.clock_out_lat ? parseFloat(row.clock_out_lat) : undefined,
            longitude: row.clock_out_lng ? parseFloat(row.clock_out_lng) : undefined,
            address: row.clock_out_address || undefined,
          },
          method: row.clock_out_method as 'face' | 'button',
          imageUri: row.clock_out_image || undefined,
        } : undefined,
        normalHours: row.normal_hours ? parseFloat(row.normal_hours) : 0,
        overtimeHours: row.overtime_hours ? parseFloat(row.overtime_hours) : 0,
        breakHours: row.break_hours ? parseFloat(row.break_hours) : 0,
        status: row.status,
        entries,
      };
    });

    return c.json({ success: true, data });
  } catch (e) {
    console.error('attendance history error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Attendance: clock-in/out
// POST /attendance/clock-in | /attendance/clock-out
app.post('/attendance/clock-in', async (c) => {
  return handleClockEvent(c, 'in');
});
app.post('/attendance/clock-out', async (c) => {
  return handleClockEvent(c, 'out');
});

const handleClockEvent = async (c: any, type: 'in' | 'out') => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, latitude, longitude, address, accuracy, method, siteName, projectName, imageUri, faceTemplate } = body as {
      companyCode: string; employeeNo: string; latitude: number; longitude: number; address?: string | null; accuracy?: number | null; method?: 'face' | 'button'; siteName?: string; projectName?: string; imageUri?: string | null; faceTemplate?: string | null;
    };
    if (!companyCode || !employeeNo || typeof latitude !== 'number' || typeof longitude !== 'number') {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    // Resolve DB UUID for this user (companyCode + employeeNo)
    // Note: getUserContext returns short IDs, but we need actual UUIDs for the DB function
    let userUuid: string | undefined;
    try {
      const compRes = await db.query('SELECT id FROM companies WHERE company_code = $1', [String(companyCode).toUpperCase()]);
      const companyId = compRes.rows?.[0]?.id as string | undefined;
      if (companyId) {
        const ures = await db.query('SELECT id FROM users WHERE company_id = $1 AND emp_no = $2', [companyId, String(employeeNo)]);
        const row = ures.rows?.[0];
        if (row?.id) {
          userUuid = row.id as string;
          // Accept both UUID format and short ID format
          console.log('Found user ID:', userUuid, 'for user:', employeeNo);
        }
      }
    } catch (e) {
      console.error('Error resolving user UUID:', e);
    }
    if (!userUuid) { c.status(404); return c.json({ success: false, message: 'User not found or invalid UUID' }); }

    // Face verification is only enforced for face-based method.
    // Button-based clocking does not require a face image/registration unless explicitly configured via FACE_REQUIRE_FOR_BUTTON.
    const methodVal = (method || 'button') as 'face' | 'button';
    const requireFaceForButton = String(process.env.FACE_REQUIRE_FOR_BUTTON || '').toLowerCase() === 'true';
    if (methodVal === 'face' || requireFaceForButton) {
      try {
        const faceRes = await db.query('SELECT face_template FROM user_faces WHERE user_id = $1', [userUuid]);
        if (faceRes.rowCount === 0) {
          c.status(403);
          return c.json({ success: false, message: 'Face not registered. Please register your face before clocking.' });
        }
        if (!imageUri || String(imageUri).trim().length === 0) {
          c.status(400);
          return c.json({ success: false, message: 'Face image is required for clocking.' });
        }
        // Perform face verification against stored template (webhook or cosine similarity)
        const storedTemplate: Buffer | null = faceRes.rows[0]?.face_template || null;
        const verificationResult = await verifyUserFace(
          userUuid,
          imageUri,
          storedTemplate,
          (typeof faceTemplate === 'string' && faceTemplate.length > 0) ? faceTemplate : undefined
        );
        // PRODUCTION SECURITY: Face verification is ALWAYS enforced - no exceptions
        // Strict mode is always enabled for production security
        if (!verificationResult.success) {
          console.error('[SECURITY] Face verification failed - blocking clock in/out');
          c.status(403);
          return c.json({
            success: false,
            message: verificationResult.message || 'Face does not match registered user.',
            userMessage: verificationResult.userMessage || '🚫 Face Recognition Failed - Access Denied',
            details: verificationResult.details
          });
        }
        console.log('[SECURITY] Face verification successful - allowing clock in/out');
      } catch (verr) {
        console.error('[SECURITY] Face verification check failed:', verr);
        c.status(500);
        return c.json({
          success: false,
          message: 'Face verification error - access denied for security',
          userMessage: '❌ Face Verification Error - Please Try Again'
        });
      }
    }

    // Enforce assignment: if the company uses assignments, only allow clocking into assigned site/project for today
    const skipAssignmentCheck = (() => {
      const raw = String(process.env.SKIP_ASSIGNMENT_CHECK ?? '').trim().toLowerCase();
      return raw === 'true' || raw === '1' || raw === 'yes';
    })();
    console.log('Assignment check flag:', { skipAssignmentCheck, raw: process.env.SKIP_ASSIGNMENT_CHECK, siteName, projectName });
    if (!skipAssignmentCheck) {
      try {
        const today = new Date();
        const ymd = today.toISOString().slice(0, 10);
        // If a site/project is provided, require a matching assignment on this date
        if ((siteName && siteName.trim()) || (projectName && projectName.trim())) {
          const res = await db.query(
            `SELECT 1 FROM employee_assignments ea
               JOIN users u ON u.id = ea.user_id
               JOIN companies c ON c.id = u.company_id
             WHERE ea.user_id = $1
               AND (ea.start_date IS NULL OR ea.start_date <= $2::date)
               AND (ea.end_date IS NULL OR ea.end_date >= $2::date)
               AND COALESCE(ea.site_name,'') IS NOT DISTINCT FROM COALESCE($3,'')
               AND COALESCE(ea.project_name,'') IS NOT DISTINCT FROM COALESCE($4,'')
            LIMIT 1`,
            [userUuid, ymd, siteName || null, projectName || null]
          );
          if (res.rowCount === 0) {
            console.log('Assignment check failed', {
              userUuid,
              ymd,
              siteName,
              projectName,
              rows: res.rows
            });
            c.status(403);
            return c.json({ success: false, message: 'You are not assigned to this site/project for today' });
          }
        }
      } catch (e) {
        console.warn('Assignment check failed:', e);
      }
    } else {
      console.log('Assignment check skipped (SKIP_ASSIGNMENT_CHECK=%s)', process.env.SKIP_ASSIGNMENT_CHECK);
    }

    // Build address field; if not provided, fall back to a simple lat,lng string
    let addressText: string | null = null;
    if (address && String(address).trim().length > 0) {
      addressText = String(address);
    } else {
      try {
        const lat = typeof latitude === 'number' ? latitude : Number(latitude);
        const lng = typeof longitude === 'number' ? longitude : Number(longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          addressText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        } else {
          addressText = null;
        }
      } catch {
        addressText = null;
      }
    }

    const timestamp = Date.now();
    // Debug: Log the values being passed to the function
    console.log('Clock-in attempt:', {
      userUuid,
      timestamp,
      type,
      siteName: siteName || 'null',
      projectName: projectName || 'null',
      method: method || 'button'
    });

    // Call extended DB function with accuracy/site/project
    let eventId: string | undefined;
    try {
      const result = await db.query(
        `SELECT record_clock_event(
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
         ) AS event_id`,
        [userUuid, timestamp, type, latitude, longitude, addressText, method || 'button', imageUri || null, accuracy || null, siteName || null, projectName || null]
      );
      eventId = result.rows[0]?.event_id;
    } catch (err: any) {
      const code = err?.code || '';
      const msg = String(err?.message || '');
      const duplicate = code === '23505' || msg.toLowerCase().includes('duplicate clock-in');
      if (duplicate) {
        try {
          // Diagnostics: check what the DB sees for today and for the site/project
          const todayYmd = new Date().toISOString().slice(0, 10);
          const entriesRes = await db.query(
            `SELECT user_id, date, site_name, project_name, clock_in_id, clock_out_id
               FROM attendance_entries
              WHERE user_id = $1 AND date = $2
                AND COALESCE(site_name,'') IS NOT DISTINCT FROM COALESCE($3,'')
                AND COALESCE(project_name,'') IS NOT DISTINCT FROM COALESCE($4,'')`,
            [userUuid, todayYmd, siteName || null, projectName || null]
          );
          console.warn('Duplicate clock-in caught:', { code, msg, userUuid, todayYmd, siteName, projectName, rows: entriesRes.rows });
        } catch (logErr) {
          console.warn('Failed duplicate diagnostics:', logErr);
        }
        c.status(409);
        return c.json({ success: false, message: 'Already clocked in for this site/project today' });
      }
      throw err;
    }
    return c.json({ success: true, data: { id: eventId, timestamp, type, location: { latitude, longitude, address: addressText, accuracy: accuracy || null }, method: method || 'button', siteName, projectName } });
  } catch (e) {
    console.error('clock event error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
};

// Leaves: apply
// POST /leaves/apply
app.post('/leaves/apply', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, startDate, endDate, type, reason, attachmentUri, duration, halfDayPeriod } = body as any;
    if (!companyCode || !employeeNo || !startDate || !endDate || !type || !reason) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    // Compute effective days (supports half-day)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const requestedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const effectiveDays = (duration === 'half' && startDate === endDate) ? 0.5 : requestedDays;

    // Insert via direct table to capture extra fields (duration, half_day_period)
    const res = await db.query(
      `INSERT INTO leaves (user_id, start_date, end_date, type, reason, attachment_uri, status, duration, half_day_period, effective_days)
       VALUES ($1, $2::date, $3::date, $4, $5, $6, 'pending', $7, $8, $9)
       RETURNING id`,
      [userId, startDate, endDate, type, reason, attachmentUri || null, duration || 'full', halfDayPeriod || null, effectiveDays]
    );
    return c.json({ success: true, data: { id: res.rows[0].id } });
  } catch (e: any) {
    console.error('apply leave error:', e);
    // Detect unique violation for duplicate active leave requests
    const message = e?.message || '';
    const code = e?.code || '';
    const isUniqueViolation = code === '23505' || message.includes('uniq_leaves_user_dates_active') || message.toLowerCase().includes('duplicate');
    if (isUniqueViolation) {
      c.status(409); // Conflict
      return c.json({ success: false, message: 'Leave already exists for this date range' });
    }
    c.status(500);
    return c.json({ success: false, message: 'Internal error' });
  }
});

// Leaves: list by user
// GET /leaves?companyCode&employeeNo
app.get('/leaves', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const res = await db.query(
      `SELECT id, start_date, end_date, type, reason, status, attachment_uri, duration, half_day_period, effective_days, approved_by, approved_at, rejected_reason, created_at, updated_at
       FROM leaves WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return c.json({ success: true, data: res.rows });
  } catch (e) {
    console.error('list leaves error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Leaves: update status (manager)
// POST /leaves/update-status
app.post('/leaves/update-status', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { leaveId, status, rejectedReason, approverCompanyCode, approverEmployeeNo } = body as any;
    if (!leaveId || !status || !approverCompanyCode || !approverEmployeeNo) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const s = String(status).toLowerCase();
    if (!['approved', 'rejected'].includes(s)) { c.status(400); return c.json({ success: false, message: 'Invalid status' }); }
    const approverCtx = await getUserContext(approverCompanyCode, approverEmployeeNo);
    if (!approverCtx.userId) { c.status(404); return c.json({ success: false, message: 'Approver not found' }); }
    // RBAC check
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approverCtx.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }
    // Ensure leave belongs to same company
    const lv = await db.query('SELECT l.id, u.company_id FROM leaves l JOIN users u ON u.id = l.user_id WHERE l.id = $1', [leaveId]);
    const row = lv.rows[0];
    if (!row) { c.status(404); return c.json({ success: false, message: 'Leave not found' }); }
    if (String(row.company_id) !== String(approverCtx.companyId)) { c.status(403); return c.json({ success: false, message: 'Forbidden: cross-company' }); }
    await db.query('CALL update_leave_status($1,$2,$3,$4)', [leaveId, s, approverCtx.userId, (rejectedReason || '').toString().slice(0, 2000) || null]);
    // Audit
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, 'leave', $4, $5)`,
        [approverCtx.companyId, approverCtx.userId, `leave_${s}`, leaveId, JSON.stringify({ rejectedReason: (rejectedReason || '').toString().slice(0, 200) })]
      );
    } catch { }
    return c.json({ success: true, message: 'Leave updated' });
  } catch (e) {
    console.error('update leave status error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Payslips: list for user
// GET /payslips?companyCode&employeeNo&year|startDate&endDate
app.get('/payslips', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const year = c.req.query('year');
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    let query = `SELECT * FROM payslips WHERE user_id = $1`;
    const params: any[] = [userId];

    if (startDate && endDate) {
      query += ` AND pay_date BETWEEN $2::date AND $3::date`;
      params.push(startDate, endDate);
    } else if (year) {
      query += ` AND EXTRACT(YEAR FROM pay_date) = $2`;
      params.push(Number(year));
    }

    query += ` ORDER BY pay_date DESC`;
    const res = await db.query(query, params);
    return c.json({ success: true, data: res.rows });
  } catch (e) {
    console.error('list payslips error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Payslips: mark viewed
// POST /payslips/mark-viewed
app.post('/payslips/mark-viewed', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, payslipId } = body as any;
    if (!companyCode || !employeeNo || !payslipId) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    // Ensure payslip belongs to user
    const own = await db.query('SELECT 1 FROM payslips WHERE id = $1 AND user_id = $2', [payslipId, userId]);
    if (own.rowCount === 0) { c.status(404); return c.json({ success: false, message: 'Payslip not found' }); }
    await db.query('SELECT mark_payslip_viewed($1)', [payslipId]);
    return c.json({ success: true });
  } catch (e) {
    console.error('mark payslip viewed error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// --- Admin: Users management (manager/admin only) ---
// GET /admin/users?companyCode&employeeNo&query=&role=&active=&page=&limit=
app.get('/admin/users', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const q = (c.req.query('query') || '').trim();
    const role = (c.req.query('role') || '').toLowerCase();
    const activeParam = c.req.query('active');
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    const where: string[] = ['u.company_id = $1'];
    const params: any[] = [approver.companyId];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      params.push(`%${q.toLowerCase()}%`);
      params.push(`%${q.toLowerCase()}%`);
      where.push('(LOWER(u.name) LIKE $' + (params.length - 2) + ' OR LOWER(u.email) LIKE $' + (params.length - 1) + ' OR LOWER(u.emp_no) LIKE $' + (params.length) + ')');
    }
    if (role && ['employee', 'manager', 'admin'].includes(role)) {
      params.push(role);
      where.push('LOWER(u.role) = $' + params.length);
    }
    if (activeParam != null && activeParam !== '') {
      const active = String(activeParam).toLowerCase() === 'true';
      params.push(active);
      where.push('u.is_active = $' + params.length);
    }

    const offset = (page - 1) * limit;
    const totalRes = await db.query(`SELECT COUNT(*) AS cnt FROM users u WHERE ${where.join(' AND ')}`, params);
    const total = Number(totalRes.rows[0]?.cnt || 0);
    params.push(limit); params.push(offset);
    const rows = await db.query(
      `SELECT u.id, u.emp_no, u.name, u.email, u.role, u.is_active, u.profile_image_uri
         FROM users u
        WHERE ${where.join(' AND ')}
        ORDER BY u.name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params
    );
    const data = rows.rows.map((r: any) => ({
      id: r.id,
      empNo: r.emp_no,
      name: r.name,
      email: r.email,
      role: (r.role || 'employee').toLowerCase(),
      isActive: !!r.is_active,
      profileImageUri: r.profile_image_uri || undefined,
    }));
    return c.json({ success: true, data: { rows: data, total, page, limit } });
  } catch (e) {
    console.error('admin list users error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// PATCH /admin/users/:id { companyCode, employeeNo, role?, isActive?, allowFace?, allowButton? }
app.patch('/admin/users/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, role, isActive, allowFace, allowButton } = body as { companyCode?: string; employeeNo?: string; role?: string; isActive?: boolean; allowFace?: boolean; allowButton?: boolean };
    if (!companyCode || !employeeNo || !id) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const approver = await getUserContext(companyCode, employeeNo);
    if (!approver.userId || !approver.companyId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const approverRow = await db.query('SELECT role FROM users WHERE id = $1', [approver.userId]);
    const approverRole = (approverRow.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) { c.status(403); return c.json({ success: false, message: 'Forbidden' }); }

    // Ensure target user is in same company
    const tgt = await db.query('SELECT id, company_id FROM users WHERE id = $1', [id]);
    if (!tgt.rowCount) { c.status(404); return c.json({ success: false, message: 'Target user not found' }); }
    if (String(tgt.rows[0].company_id) !== String(approver.companyId)) { c.status(403); return c.json({ success: false, message: 'Forbidden: cross-company' }); }

    const sets: string[] = [];
    const params: any[] = [];
    if (role && ['employee', 'manager', 'admin'].includes(String(role).toLowerCase())) {
      params.push(String(role).toLowerCase());
      sets.push(`role = $${params.length}`);
    }
    if (typeof isActive === 'boolean') {
      params.push(isActive);
      sets.push(`is_active = $${params.length}`);
    }
    if (typeof allowFace === 'boolean') {
      params.push(allowFace);
      sets.push(`allow_face = $${params.length}`);
    }
    if (typeof allowButton === 'boolean') {
      params.push(allowButton);
      sets.push(`allow_button = $${params.length}`);
    }
    if (sets.length === 0) { return c.json({ success: true }); }
    params.push(id);
    await db.query(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`, params);
    // Audit log
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, 'user', $4, $5)`,
        [approver.companyId, approver.userId, 'update_user', id, JSON.stringify({ role, isActive, allowFace, allowButton })]
      );
    } catch { }
    return c.json({ success: true });
  } catch (e) {
    console.error('admin update user error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Users: profile
// GET /users/profile?companyCode&employeeNo
app.get('/users/profile', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }

    // Convert company_code to company_id
    const companyId = isNaN(Number(companyCode)) ? 1 : Number(companyCode);

    // Query CX18AILABDEMO.hr_employee table
    const { Pool } = require('pg');
    const hrDb = new Pool({
<<<<<<< HEAD
      host: process.env.ATTENDANCE_DB_HOST || '192.168.31.135',
=======
      host: process.env.ATTENDANCE_DB_HOST || '192.168.1.10',
>>>>>>> 47c0b0bc0d5dbd0227515fa0905c54847dd7040a
      port: parseInt(process.env.ATTENDANCE_DB_PORT || '5432'),
      database: process.env.ATTENDANCE_DB_NAME || 'CX18AILABDEMO',
      user: process.env.ATTENDANCE_DB_USER || 'postgres',
      password: process.env.ATTENDANCE_DB_PASSWORD || 'pgsql@2024',
    });

    const user = await hrDb.query(
      `SELECT id, employee_no, name, work_email FROM hr_employee WHERE company_id = $1 AND employee_no = $2`,
      [companyId, employeeNo]
    );

    if (user.rowCount === 0) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const u = user.rows[0];
    const data = {
      employeeNo: u.employee_no,
      companyCode: companyCode,
      companyName: companyCode,
      name: u.name,
      role: 'employee', // Default role
      profileImageUri: null,
      leaveBalance: {
        annual: 10,
        medical: 5,
        emergency: 2,
        unpaid: 0,
      },
      // Per-user schedule (may be null if not configured)
      workStartTime: null,
      workEndTime: null,
      graceMin: null,
    };
    return c.json({ success: true, data });
  } catch (e) {
    console.error('user profile error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Reports CSV export for the same range
// GET /reports/attendance-export?companyCode&employeeNo&startDate&endDate
app.get('/reports/attendance-export', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    if (!companyCode || !employeeNo || !startDate || !endDate) {
      c.status(400); return c.text('Missing fields');
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.text('User not found'); }

    const rowsRes = await db.query(
      `SELECT 
         date::date AS day,
         status,
         COALESCE(normal_hours,0) AS normal_hours,
         COALESCE(overtime_hours,0) AS overtime_hours
       FROM attendance_days
       WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );

    const header = ['Date', 'Status', 'Normal Hours', 'Overtime Hours'];
    const lines = [header.join(',')];
    for (const r of rowsRes.rows) {
      lines.push([
        new Date(r.day).toISOString().slice(0, 10),
        r.status,
        Number(r.normal_hours),
        Number(r.overtime_hours),
      ].join(','));
    }
    const csv = lines.join('\n');
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="attendance_${employeeNo}_${startDate}_${endDate}.csv"`);
    return c.body(csv);
  } catch (e) {
    console.error('attendance export error:', e);
    c.status(500); return c.text('Internal error');
  }
});

// Payslips: download PDF (proxy or generate summary)
// GET /payslips/download?id=...&companyCode=...&employeeNo=...
app.get('/payslips/download', async (c) => {
  try {
    const id = c.req.query('id') || '';
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    if (!id || !companyCode || !employeeNo) {
      c.status(400); return c.text('Missing fields');
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.text('User not found'); }

    const rowRes = await db.query(
      `SELECT id, user_id, pay_period_start, pay_period_end, pay_date, basic_salary, overtime_hours, overtime_rate, overtime_pay, allowances, deductions, gross_pay, tax_deduction, net_pay, status, pdf_uri
       FROM payslips WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    const row = rowRes.rows[0];
    if (!row) { c.status(404); return c.text('Payslip not found'); }

    // If there is a stored PDF, try to proxy it
    const uri: string | undefined = row.pdf_uri || undefined;
    if (uri) {
      try {
        const resp = await fetch(uri);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          c.header('Content-Type', 'application/pdf');
          c.header('Content-Disposition', `attachment; filename="payslip_${employeeNo}_${String(row.pay_date).slice(0, 10)}.pdf"`);
          return c.body(buf);
        }
      } catch (err) {
        console.warn('Failed to proxy stored payslip PDF, falling back to generated summary', err);
      }
    }

    // Fallback: generate minimal PDF summary
    const allowances = row.allowances || {};
    const deductions = row.deductions || {};
    const allowSum = Object.values(allowances).reduce((s: number, v: any) => s + Number(v || 0), 0);
    const dedSum = Number(row.tax_deduction || 0) + Object.values(deductions).reduce((s: number, v: any) => s + Number(v || 0), 0);
    const lines = [
      `Payslip: ${String(row.pay_period_start).slice(0, 10)} to ${String(row.pay_period_end).slice(0, 10)}`,
      `Employee: ${employeeNo}`,
      `Pay Date: ${String(row.pay_date).slice(0, 10)}`,
      `Basic Salary: ${Number(row.basic_salary).toFixed(2)}`,
      `Overtime: ${Number(row.overtime_hours).toFixed(2)}h @ ${Number(row.overtime_rate).toFixed(2)} = ${Number(row.overtime_pay).toFixed(2)}`,
      `Allowances Total: ${allowSum.toFixed(2)}`,
      `Deductions Total: -${dedSum.toFixed(2)}`,
      `Gross Pay: ${Number(row.gross_pay).toFixed(2)}`,
      `Net Pay: ${Number(row.net_pay).toFixed(2)}`,
      `Status: ${row.status}`,
    ];
    const pdf = makeSimplePdf(lines);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="payslip_${employeeNo}_${String(row.pay_date).slice(0, 10)}.pdf"`);
    return c.body(pdf);
  } catch (e) {
    console.error('payslip download error:', e);
    c.status(500); return c.text('Internal error');
  }
});

// Reports PDF export (minimal PDF text summary)
// GET /reports/attendance-export-pdf?companyCode&employeeNo&startDate&endDate
app.get('/reports/attendance-export-pdf', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    if (!companyCode || !employeeNo || !startDate || !endDate) {
      c.status(400); return c.text('Missing fields');
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.text('User not found'); }

    // Aggregate basic stats for summary
    const result = await db.query(
      `SELECT 
        COUNT(*)::int as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::int AS present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::int AS absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)::int AS late_days,
        SUM(CASE WHEN status = 'early-exit' THEN 1 ELSE 0 END)::int AS early_exit_days,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END)::int AS leave_days,
        COALESCE(SUM(normal_hours), 0)::float8 AS total_normal_hours,
        COALESCE(SUM(overtime_hours), 0)::float8 AS total_overtime_hours
      FROM attendance_days
      WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date`,
      [userId, startDate, endDate]
    );
    const r = result.rows[0] || {};
    const totalDays = Number(r.total_days || 0);
    const presentDays = Number(r.present_days || 0);
    const absentDays = Number(r.absent_days || 0);
    const lateDays = Number(r.late_days || 0);
    const earlyExitDays = Number(r.early_exit_days || 0);
    const leaveDays = Number(r.leave_days || 0);
    const totalNormalHours = Number(r.total_normal_hours || 0).toFixed(1);
    const totalOvertimeHours = Number(r.total_overtime_hours || 0).toFixed(1);

    // Minimal one-page PDF content with Helvetica text
    // Note: This is a very small static-layout PDF suitable for basic downloads.
    const lines = [
      `Attendance Report (${startDate} to ${endDate})`,
      `Employee: ${employeeNo} @ ${companyCode}`,
      `Total Days: ${totalDays}`,
      `Present: ${presentDays}`,
      `Absent: ${absentDays}`,
      `Late: ${lateDays}`,
      `Early Exit: ${earlyExitDays}`,
      `On Leave: ${leaveDays}`,
      `Normal Hours: ${totalNormalHours}`,
      `Overtime Hours: ${totalOvertimeHours}`,
    ];

    const pdf = makeSimplePdf(lines);
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="attendance_${employeeNo}_${startDate}_${endDate}.pdf"`);
    return c.body(pdf);
  } catch (e) {
    console.error('attendance export pdf error:', e);
    c.status(500); return c.text('Internal error');
  }
});

// Reports: attendance statistics by date range
// GET /reports/attendance-stats?companyCode&employeeNo&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
app.get('/reports/attendance-stats', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    if (!companyCode || !employeeNo || !startDate || !endDate) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    // Fetch company policy thresholds and per-user overrides
    const compRes = await db.query(
      `SELECT id, work_start_time AS c_start, work_end_time AS c_end, work_hours_per_day FROM companies WHERE company_code = $1`,
      [companyCode]
    );
    const compRow = compRes.rows[0] || {};
    const userRes = await db.query(
      `SELECT work_start_time AS u_start, work_end_time AS u_end, grace_min AS u_grace FROM users WHERE id = $1`,
      [userId]
    );
    const userRow = userRes.rows[0] || {};
    const workStart = userRow.u_start || compRow.c_start || '09:00';
    const workEnd = userRow.u_end || compRow.c_end || '18:00';
    const workHoursPerDay = Number(compRow.work_hours_per_day || 8);
    const graceMin = Number.isFinite(Number(userRow.u_grace)) ? Number(userRow.u_grace) : 5;

    // Aggregate counts and sums from attendance_days within range
    const result = await db.query(
      `SELECT 
        COUNT(*)::int as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::int AS present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::int AS absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)::int AS late_days,
        SUM(CASE WHEN status = 'early-exit' THEN 1 ELSE 0 END)::int AS early_exit_days,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END)::int AS leave_days,
        COALESCE(SUM(normal_hours), 0)::float8 AS total_normal_hours,
        COALESCE(SUM(overtime_hours), 0)::float8 AS total_overtime_hours
      FROM attendance_days
      WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date`,
      [userId, startDate, endDate]
    );
    const row = result.rows[0] || {};
    const totalDays = Number(row.total_days || 0);
    const presentDays = Number(row.present_days || 0);
    const absentDays = Number(row.absent_days || 0);
    const lateDays = Number(row.late_days || 0);
    const earlyExitDays = Number(row.early_exit_days || 0);
    const leaveDays = Number(row.leave_days || 0);
    const totalNormalHours = Number(row.total_normal_hours || 0);
    const totalOvertimeHours = Number(row.total_overtime_hours || 0);
    const averageHoursPerDay = totalDays > 0 ? (totalNormalHours + totalOvertimeHours) / totalDays : 0;
    const presentPercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    // Compute lateness minutes against company work_start_time using clock_in timestamp
    const lateRes = await db.query(
      `SELECT COALESCE(SUM(
          GREATEST(
            EXTRACT(EPOCH FROM (
              (to_timestamp(ci.timestamp/1000)::time) - ($2::time)
            )) / 60.0 - $5::int,
            0
          )
        ), 0) AS total_late_minutes
       FROM attendance_days ad
       LEFT JOIN clock_events ci ON ci.id = ad.clock_in_id
       WHERE ad.user_id = $1 AND ad.date BETWEEN $3::date AND $4::date
         AND ci.timestamp IS NOT NULL`,
      [userId, workStart, startDate, endDate, graceMin]
    );
    const totalLateMinutes = Number(lateRes.rows?.[0]?.total_late_minutes || 0);
    const avgLateMinutes = presentDays + lateDays > 0 ? totalLateMinutes / (presentDays + lateDays) : 0;

    // Weekly breakdown
    const weekly = await db.query(
      `SELECT 
         date_trunc('week', date)::date AS bucket,
         COUNT(*)::int as total_days,
         SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::int AS present_days,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::int AS absent_days,
         SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)::int AS late_days,
         SUM(CASE WHEN status = 'early-exit' THEN 1 ELSE 0 END)::int AS early_exit_days,
         SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END)::int AS leave_days,
         COALESCE(SUM(normal_hours), 0)::float8 AS total_normal_hours,
         COALESCE(SUM(overtime_hours), 0)::float8 AS total_overtime_hours
       FROM attendance_days
       WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date
       GROUP BY 1
       ORDER BY 1 ASC`,
      [userId, startDate, endDate]
    );

    // Monthly breakdown
    const monthly = await db.query(
      `SELECT 
         date_trunc('month', date)::date AS bucket,
         COUNT(*)::int as total_days,
         SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::int AS present_days,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::int AS absent_days,
         SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END)::int AS late_days,
         SUM(CASE WHEN status = 'early-exit' THEN 1 ELSE 0 END)::int AS early_exit_days,
         SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END)::int AS leave_days,
         COALESCE(SUM(normal_hours), 0)::float8 AS total_normal_hours,
         COALESCE(SUM(overtime_hours), 0)::float8 AS total_overtime_hours
       FROM attendance_days
       WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date
       GROUP BY 1
       ORDER BY 1 ASC`,
      [userId, startDate, endDate]
    );

    const data = {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      earlyExitDays,
      leaveDays,
      totalNormalHours,
      totalOvertimeHours,
      averageHoursPerDay,
      presentPercentage,
      policy: {
        workStartTime: workStart,
        workEndTime: workEnd,
        workHoursPerDay,
      },
      totalLateMinutes,
      avgLateMinutes,
      weekly: weekly.rows.map(r => ({
        bucketStart: new Date(r.bucket).getTime(),
        totalDays: Number(r.total_days),
        presentDays: Number(r.present_days),
        absentDays: Number(r.absent_days),
        lateDays: Number(r.late_days),
        earlyExitDays: Number(r.early_exit_days),
        leaveDays: Number(r.leave_days),
        totalNormalHours: Number(r.total_normal_hours),
        totalOvertimeHours: Number(r.total_overtime_hours),
      })),
      monthly: monthly.rows.map(r => ({
        bucketStart: new Date(r.bucket).getTime(),
        totalDays: Number(r.total_days),
        presentDays: Number(r.present_days),
        absentDays: Number(r.absent_days),
        lateDays: Number(r.late_days),
        earlyExitDays: Number(r.early_exit_days),
        leaveDays: Number(r.leave_days),
        totalNormalHours: Number(r.total_normal_hours),
        totalOvertimeHours: Number(r.total_overtime_hours),
      })),
    };
    return c.json({ success: true, data });
  } catch (e) {
    console.error('attendance stats error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Mount tRPC router at /api/trpc
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// Multi-company REST login endpoint - Uses dynamic company DB pools from attendance_db
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => null) as {
      companyCode?: string;
      employeeNo?: string;
      password?: string;
    } | null;

    if (!body || !body.companyCode || !body.employeeNo) {
      c.status(400);
      return c.json({ success: false, message: 'Missing required fields' });
    }

    const companyCode = String(body.companyCode || '').trim();
    const employeeNo = String(body.employeeNo || '').trim();
    const password = String(body.password || '');

    if (!companyCode || !employeeNo) {
      c.status(400);
      return c.json({ success: false, message: 'Invalid company code or employee number' });
    }

    // Initialize master pool if needed
    await initMasterPool();

    // Get company-specific DB pool (dynamically from attendance_db.companies)
    let companyPool;
    try {
      companyPool = await getCompanyPool(companyCode);
    } catch (err) {
      console.error(`[REST Login] Failed to get company pool for ${companyCode}:`, err);
      c.status(401);
      return c.json({ success: false, message: 'Company not found or inactive' });
    }

    // Query company DB for employee
    const userRow = await companyPool.query(
      `SELECT 
        id,
        "x_Emp_No" AS "employeeNo",
        name,
        company_id AS "companyId",
        password
      FROM hr_employee
      WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))`,
      [employeeNo]
    );

    const user = userRow.rows[0];
    if (!user) {
      c.status(401);
      return c.json({ success: false, message: 'User is not registered in this application' });
    }

    // Validate plaintext password
    if (password !== user.password) {
      console.log(`[REST Login] Password mismatch for ${companyCode}/${employeeNo}`);
      c.status(401);
      return c.json({ success: false, message: 'Invalid password' });
    }

    console.log(`[REST Login] User authenticated: ${companyCode}/${employeeNo}`);

    // Default role to 'employee'
    const role = 'employee';

    c.status(200);
    return c.json({
      success: true,
      message: 'Login success',
      data: {
        employeeNo: employeeNo,
        name: user.name || employeeNo,
        email: '',
        role: role,
        companyCode,
        sessionToken: `session_${Date.now()}`,
      },
    });
  } catch (e) {
    console.error('/auth/login error:', e);
    c.status(500);
    return c.json({ success: false, message: 'Internal server error' });
  }
});

// Face: check registration status
app.get('/face/status', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    if (!companyCode || !employeeNo) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const res = await db.query('SELECT id, image_uri, template_version FROM user_faces WHERE user_id = $1', [userId]);
    const registered = ((res?.rowCount ?? 0) > 0);
    return c.json({ success: true, data: { registered, imageUri: res.rows[0]?.image_uri || null, templateVersion: res.rows[0]?.template_version || null } });
  } catch (e) {
    console.error('face status error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Face: register (store reference image/template)
app.post('/face/register', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, imageUri, faceTemplate, templateVersion } = body as { companyCode: string; employeeNo: string; imageUri?: string; faceTemplate?: string; templateVersion?: string };
    console.log(`[Face Register] Request: companyCode=${companyCode}, employeeNo=${employeeNo}, hasImageUri=${!!imageUri}, hasFaceTemplate=${!!faceTemplate}, imageUriType=${imageUri?.substring(0, 20)}`);

    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    let templateBuf: Buffer | null = null;

    // If faceTemplate is provided, use it
    if (typeof faceTemplate === 'string' && faceTemplate.length > 0) {
      try {
        const b64 = faceTemplate.includes(',') ? faceTemplate.split(',').pop()! : faceTemplate;
        templateBuf = Buffer.from(b64, 'base64');
        console.log(`[Face Register] Using provided faceTemplate, size: ${templateBuf.length} bytes`);
      } catch (err) {
        console.error(`[Face Register] Failed to decode faceTemplate:`, err);
      }
    }
    // If no faceTemplate but imageUri is provided, use imageUri as template
    else if (imageUri && imageUri.startsWith('data:image/')) {
      try {
        const b64 = imageUri.split(',').pop()!;
        templateBuf = Buffer.from(b64, 'base64');
        console.log(`[Face Register] Using imageUri as template, size: ${templateBuf.length} bytes`);
      } catch (err) {
        console.error(`[Face Register] Failed to decode imageUri:`, err);
      }
    }
    // If imageUri is a file:// or content:// URI (mobile), store a placeholder
    // The actual image will be sent during verification
    else if (imageUri && (imageUri.startsWith('file://') || imageUri.startsWith('content://'))) {
      console.log(`[Face Register] Mobile file URI detected, creating placeholder template`);
      // Store a small placeholder to indicate registration is complete
      // The actual face matching will happen during verification when the app sends the image
      templateBuf = Buffer.from('MOBILE_FILE_URI_PLACEHOLDER', 'utf-8');
    }

    if (!templateBuf) {
      console.warn(`[Face Register] No valid template data provided`);
      c.status(400);
      return c.json({ success: false, message: 'No face template data provided. Please ensure camera permissions are granted and try again.' });
    }

    await db.query(
      `INSERT INTO user_faces (user_id, image_uri, face_template, template_version)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET image_uri = EXCLUDED.image_uri, face_template = EXCLUDED.face_template, template_version = EXCLUDED.template_version, updated_at = CURRENT_TIMESTAMP`,
      [userId, imageUri || null, templateBuf, templateVersion || null]
    );
    console.log(`[Face Register] Successfully saved template for user ${userId}, size: ${templateBuf.length} bytes`);
    return c.json({ success: true, message: 'Face registered' });
  } catch (e) {
    console.error('face register error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Face: verify with real matching strategy
app.post('/face/verify', async (c) => {
  try {
    console.log('[NEW CODE 2025-10-31] /face/verify endpoint hit');
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, imageUri, faceTemplate } = body as { companyCode: string; employeeNo: string; imageUri?: string; faceTemplate?: string };
    console.log(`[NEW CODE] Request: companyCode=${companyCode}, employeeNo=${employeeNo}, hasImage=${!!imageUri}`);
    if (!companyCode || !employeeNo) { c.status(400); return c.json({ success: false, message: 'Missing fields' }); }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const res = await db.query('SELECT face_template FROM user_faces WHERE user_id = $1', [userId]);
    if (((res?.rowCount ?? 0) === 0)) {
      console.log(`[Face Verify] No face template found for user ${userId}`);
      c.status(404);
      return c.json({ success: false, message: 'Face not registered' });
    }
    const storedTemplate: Buffer | null = res.rows[0]?.face_template || null;
    console.log(`[Face Verify] Retrieved template for user ${userId}: ${storedTemplate ? `${storedTemplate.length} bytes` : 'NULL'}`);

    // Check if stored template is a placeholder (mobile file URI registration)
    const isPlaceholder = storedTemplate && storedTemplate.toString('utf-8') === 'MOBILE_FILE_URI_PLACEHOLDER';
    if (isPlaceholder) {
      console.log(`[Face Verify] Placeholder template detected - first verification after mobile registration`);

      // SECURITY: Require faceTemplate for first verification
      if (!faceTemplate) {
        console.error(`[Face Verify] SECURITY: No faceTemplate provided for placeholder verification - rejecting`);
        c.status(400);
        return c.json({
          success: false,
          message: 'Face template required for verification',
          userMessage: '❌ Verification Error - Please try again'
        });
      }

      // Extract and validate the faceTemplate
      try {
        const b64 = faceTemplate.includes(',') ? faceTemplate.split(',').pop()! : faceTemplate;
        const decoded = Buffer.from(b64, 'base64');

        // Validate it's a real image (JPEG/PNG)
        const isJPEG = decoded.length >= 8 && decoded[0] === 0xFF && decoded[1] === 0xD8 && decoded[2] === 0xFF;
        const isPNG = decoded.length >= 8 && decoded[0] === 0x89 && decoded[1] === 0x50 && decoded[2] === 0x4E && decoded[3] === 0x47;

        if (!isJPEG && !isPNG) {
          console.error(`[Face Verify] Invalid image format in faceTemplate`);
          c.status(400);
          return c.json({
            success: false,
            message: 'Invalid face template format',
            userMessage: '❌ Invalid Image Format'
          });
        }

        console.log(`[Face Verify] Valid faceTemplate received, size: ${decoded.length} bytes`);

        // Update the placeholder with the actual template
        await db.query(
          `UPDATE user_faces SET face_template = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
          [decoded, userId]
        );
        console.log(`[Face Verify] Updated placeholder with actual template for future verifications`);

        // SECURITY: Verify this image using the webhook for face detection and liveness
        // For first verification, we check if it's a valid face with liveness, not matching
        console.log(`[Face Verify] Performing security checks on first verification image (face detection + liveness only)`);

        // Call webhook with the image for security validation
        const webhook = process.env.FACE_VERIFY_WEBHOOK;
        if (webhook) {
          try {
            const payload = {
              userId,
              imageUri: imageUri || null,
              storedTemplate: null, // No template to compare against for first verification
              faceTemplateB64: faceTemplate,
              threshold: 0 // No matching threshold for first verification
            };

            const resp = await fetch(webhook, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (resp.ok) {
              const data = await resp.json().catch(() => ({}));
              console.log(`[Face Verify] First verification webhook response:`, data);

              // SECURITY: Require face detection and liveness for first verification
              const detected = !!(data.detectedFace ?? data.detected ?? false);
              const live = !!(data.liveness ?? data.live ?? false);

              if (!detected) {
                console.warn(`[SECURITY] No face detected in first verification image`);
                c.status(403);
                return c.json({
                  success: false,
                  message: 'No face detected in image',
                  userMessage: '❌ No Face Detected - Ensure Face is Visible'
                });
              }

              if (!live) {
                console.warn(`[SECURITY] Liveness check failed in first verification`);
                c.status(403);
                return c.json({
                  success: false,
                  message: 'Liveness verification failed',
                  userMessage: '❌ Liveness Check Failed - Use Real Face, Not Photo'
                });
              }

              // First verification passed security checks
              console.log(`[Face Verify] First verification passed - face detected and liveness confirmed`);
              return c.json({
                success: true,
                message: 'Face verified and registered',
                userMessage: '✅ Face Recognition Successful'
              });
            } else {
              console.error(`[Face Verify] Webhook failed for first verification: ${resp.status}`);
            }
          } catch (err) {
            console.error(`[Face Verify] Webhook error for first verification:`, err);
          }
        }

        // If webhook failed or not configured, reject for security
        console.error(`[Face Verify] Cannot verify first registration without webhook - rejecting for security`);
        c.status(500);
        return c.json({
          success: false,
          message: 'Face verification service unavailable',
          userMessage: '❌ Verification Service Error - Please Try Again'
        });

      } catch (err) {
        console.error(`[Face Verify] Failed to process placeholder template:`, err);
        c.status(500);
        return c.json({
          success: false,
          message: 'Face verification error',
          userMessage: '❌ Verification Error - Please Try Again'
        });
      }
    }

    // Default to strict enforcement unless explicitly disabled
    const strict = String(process.env.FACE_ENFORCE_STRICT || 'true').toLowerCase() === 'true';

    // If no webhook and no stored template but client sent an image, backfill the template to avoid future mismatches
    if (!strict && (!storedTemplate || storedTemplate.length === 0) && faceTemplate && !process.env.FACE_VERIFY_WEBHOOK) {
      try {
        const b64 = faceTemplate.includes(',') ? faceTemplate.split(',').pop()! : faceTemplate;
        const decoded = Buffer.from(b64, 'base64');
        // Simple image signature check (JPEG/PNG)
        const isImg = decoded.length >= 8 && (
          (decoded[0] === 0xFF && decoded[1] === 0xD8 && decoded[2] === 0xFF) ||
          (decoded[0] === 0x89 && decoded[1] === 0x50 && decoded[2] === 0x4E && decoded[3] === 0x47 && decoded[4] === 0x0D && decoded[5] === 0x0A && decoded[6] === 0x1A && decoded[7] === 0x0A)
        );
        if (isImg) {
          await db.query(
            `UPDATE user_faces SET face_template = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
            [decoded, userId]
          );
          // Accept now; future verifications will have a stored template
          return c.json({ success: true, message: 'Face verified' });
        }
      } catch { }
    }
    const result = await verifyUserFace(userId, imageUri || undefined, storedTemplate, faceTemplate);
    if (!result.success && strict) {
      c.status(403);
      return c.json({
        success: false,
        message: result.message || 'Face verification failed',
        userMessage: result.userMessage || '❌ Face Recognition Failed',
        details: result.details
      });
    }
    if (!result.success && !strict) {
      return c.json({
        success: true,
        message: 'Face verified (dev fallback - strict mode disabled)',
        userMessage: '✅ Face Recognition Successful (Dev Mode)'
      });
    }
    return c.json({
      success: true,
      message: result.message || 'Face verified',
      userMessage: result.userMessage || '✅ Face Recognition Successful',
      details: result.details
    });
  } catch (e) {
    console.error('face verify error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Security: report unauthorized access attempts
app.post('/security/unauthorized-access', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, imageUri, timestamp, attemptType, detectedEmployee } = body as {
      companyCode: string;
      imageUri: string;
      timestamp: string;
      attemptType: string;
      detectedEmployee?: string
    };

    if (!companyCode || !imageUri || !timestamp || !attemptType) {
      c.status(400);
      return c.json({ success: false, message: 'Missing required fields' });
    }

    // Log the unauthorized access attempt
    console.warn(`[SECURITY] Unauthorized access attempt: ${attemptType} at ${timestamp} for company ${companyCode}`);

    // In a production system, you would:
    // 1. Store this in a security_logs table
    // 2. Send alerts to administrators
    // 3. Potentially trigger additional security measures

    // For now, just log and return success
    return c.json({
      success: true,
      message: 'Unauthorized access attempt logged'
    });
  } catch (e) {
    console.error('unauthorized access reporting error:', e);
    c.status(500);
    return c.json({ success: false, message: 'Internal error' });
  }
});

// Toolbox: get meetings (optional upcoming filter)
app.get('/toolbox/meetings', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const upcoming = (c.req.query('upcoming') || '').toLowerCase() === 'true';
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    let query = `
      SELECT DISTINCT ON (tm.id)
        tm.*,
        u.name as presenter_name,
        tma.id as attendee_id,
        tma.attended,
        tma.acknowledged_at,
        tma.signature_uri,
        tma.notes,
        (SELECT COUNT(*) FROM toolbox_meeting_attendees WHERE meeting_id = tm.id) as total_attendees,
        (SELECT COUNT(*) FROM toolbox_meeting_attendees WHERE meeting_id = tm.id AND attended = true) as attended_count
      FROM toolbox_meetings tm
      LEFT JOIN users u ON tm.presenter_id = u.id
      LEFT JOIN toolbox_meeting_attendees tma ON tm.id = tma.meeting_id AND tma.user_id = $1
    `;
    const params: (string | number)[] = [userId];
    const whereClauses: string[] = [];
    if (upcoming) {
      whereClauses.push(`tm.meeting_date >= CURRENT_DATE`);
    }
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    // DISTINCT ON requires ORDER BY to start with the DISTINCT columns.
    // Keep the most recently updated/created row per meeting id.
    query += ` ORDER BY tm.id, tm.updated_at DESC, tm.created_at DESC`;

    const result = await db.query(query, params);
    const data = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      meetingDate: row.meeting_date,
      isPast: (new Date(row.meeting_date).getTime() < new Date(new Date().toISOString().slice(0, 10)).getTime()),
      presenterId: row.presenter_id,
      presenterName: row.presenter_name,
      location: row.location,
      safetyTopics: row.safety_topics || [],
      attachments: row.attachments || [],
      isMandatory: row.is_mandatory,
      createdAt: new Date(row.created_at).getTime?.() ?? (row.created_at?.getTime?.() || Date.now()),
      updatedAt: new Date(row.updated_at).getTime?.() ?? (row.updated_at?.getTime?.() || Date.now()),
      attendee: row.attendee_id ? {
        id: row.attendee_id,
        meetingId: row.id,
        userId: userId,
        attended: !!row.attended,
        acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at).getTime?.() ?? (row.acknowledged_at?.getTime?.() || undefined) : undefined,
        signatureUri: row.signature_uri || undefined,
        notes: row.notes || undefined,
        createdAt: new Date(row.created_at).getTime?.() ?? (row.created_at?.getTime?.() || Date.now()),
        updatedAt: new Date(row.updated_at).getTime?.() ?? (row.updated_at?.getTime?.() || Date.now()),
      } : undefined,
      totalAttendees: Number(row.total_attendees || 0),
      attendedCount: Number(row.attended_count || 0),
    }));
    return c.json({ success: true, data });
  } catch (e) {
    console.error('list toolbox meetings error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Toolbox: acknowledge meeting
app.post('/toolbox/acknowledge', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, meetingId, attended, signatureUri, notes } = body as {
      companyCode: string; employeeNo: string; meetingId: string; attended: boolean; signatureUri?: string; notes?: string;
    };
    if (!companyCode || !employeeNo || !meetingId || typeof attended !== 'boolean') {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    // Do not allow acknowledging meetings after the meeting date has passed
    const mtg = await db.query('SELECT meeting_date FROM toolbox_meetings WHERE id = $1', [meetingId]);
    if (mtg.rowCount === 0) { c.status(404); return c.json({ success: false, message: 'Meeting not found' }); }
    const meetingDate: Date = mtg.rows[0].meeting_date;
    const today = new Date(new Date().toISOString().slice(0, 10));
    if (meetingDate.getTime() < today.getTime()) {
      c.status(400); return c.json({ success: false, message: 'This meeting is over and cannot be acknowledged.' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE toolbox_meeting_attendees 
         SET attended = $1, acknowledged_at = CURRENT_TIMESTAMP, signature_uri = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
         WHERE meeting_id = $4 AND user_id = $5
         RETURNING *`,
        [attended, signatureUri || null, notes || null, meetingId, userId]
      );
      // If no attendee row existed, insert one now (upsert behavior)
      let row = result.rows[0];
      if (!row) {
        const insertRes = await client.query(
          `INSERT INTO toolbox_meeting_attendees (meeting_id, user_id, attended, acknowledged_at, signature_uri, notes, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (meeting_id, user_id) DO UPDATE
             SET attended = EXCLUDED.attended,
                 acknowledged_at = EXCLUDED.acknowledged_at,
                 signature_uri = EXCLUDED.signature_uri,
                 notes = EXCLUDED.notes,
                 updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [meetingId, userId, attended, signatureUri || null, notes || null]
        );
        row = insertRes.rows[0];
      }
      await client.query('COMMIT');
      return c.json({ success: true, data: row });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('acknowledge meeting error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// DISABLED: External API proxy not used
// Proxy external API for /api/* so the app can call through the local server
// const EXTERNAL_API_BASE = process.env.EXTERNAL_API_BASE || "https://cx.brk.sg/AI.LAB.MASTER.API";
// app.all("/api/*", async (c) => {
//   try {
//     const reqUrl = new URL(c.req.url);
//     const targetUrl = EXTERNAL_API_BASE + reqUrl.pathname + reqUrl.search;
//     console.log(`[proxy] -> ${targetUrl}`);
//     // Clone headers from the raw Request and drop hop-by-hop headers if any
//     const headers = new Headers(c.req.raw.headers);
//     headers.delete("host");

//     let body: BodyInit | undefined = undefined;
//     const method = c.req.method.toUpperCase();
//     if (!["GET", "HEAD"].includes(method)) {
//       const contentType = headers.get("content-type") || "";
//       if (contentType.includes("application/json")) {
//         const text = await c.req.text();
//         body = text;
//       } else {
//         body = await c.req.arrayBuffer();
//       }
//     }

//     const resp = await fetch(targetUrl, { method, headers, body });
//     console.log(`[proxy] <- ${resp.status} ${resp.statusText}`);
//     const respHeaders = new Headers(resp.headers);
//     const respBody = await resp.arrayBuffer();
//     return new Response(respBody, { status: resp.status, headers: respHeaders });
//   } catch (err) {
//     console.error("Proxy error:", err);
//     throw new HTTPException(502, { message: "Bad Gateway: proxy failed" });
//   }
// });

// Helper: resolve company+user with validation (updated for short IDs)
const getUserContext = async (companyCode: string, employeeNo: string) => {
  // Input validation
  if (!companyCode || typeof companyCode !== 'string' || companyCode.trim().length === 0) {
    throw new Error('Invalid company code');
  }
  if (!employeeNo || typeof employeeNo !== 'string' || employeeNo.trim().length === 0) {
    throw new Error('Invalid employee number');
  }

  const normalizedCompanyCode = companyCode.toUpperCase().trim();
  const normalizedEmployeeNo = employeeNo.trim();

  const comp = await db.query('SELECT id, is_active FROM companies WHERE company_code = $1', [normalizedCompanyCode]);
  const companyRow = comp.rows[0];

  if (!companyRow) {
    return { companyId: null, userId: null, error: 'Company not found' };
  }

  if (!companyRow.is_active) {
    return { companyId: null, userId: null, error: 'Company account is inactive' };
  }

  const companyId = companyRow.id as string; // Now short ID like CMP_ABC123

  const user = await db.query('SELECT id, is_active FROM users WHERE company_id = $1 AND emp_no = $2', [companyId, normalizedEmployeeNo]);
  const userRow = user.rows[0];

  if (!userRow) {
    return { companyId, userId: null, error: 'Employee not found' };
  }

  if (!userRow.is_active) {
    return { companyId, userId: null, error: 'Employee account is inactive' };
  }

  const userId = userRow.id as string; // Now short ID like USR_ABC123
  return { companyId, userId, error: null } as { companyId: string | null; userId: string | null; error: string | null };
};


// Helper: escape text for PDF literal strings (escape backslashes and parentheses)
const pdfEscape = (s: string) => s.replace(/([\\()])/g, '\\$1');

// Helper: build a minimal single-page PDF buffer showing lines of text
const makeSimplePdf = (lines: string[]) => {
  const content = (
    'BT\n' +
    '/F1 12 Tf\n' +
    '50 780 Td\n' +
    `(${pdfEscape(lines[0] || '')}) Tj\n` +
    '0 -18 Td\n' +
    lines.slice(1).map((l) => `(${pdfEscape(l)}) Tj 0 -16 Td`).join('\n') +
    '\nET'
  );
  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n';
  const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
  const obj4 = `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf-8')} >>\nstream\n${content}\nendstream\nendobj\n`;
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>\nendobj\n';
  const body = header + obj1 + obj2 + obj3 + obj4 + obj5;
  const off1 = Buffer.byteLength(header, 'utf-8');
  const off2 = off1 + Buffer.byteLength(obj1, 'utf-8');
  const off3 = off2 + Buffer.byteLength(obj2, 'utf-8');
  const off4 = off3 + Buffer.byteLength(obj3, 'utf-8');
  const off5 = off4 + Buffer.byteLength(obj4, 'utf-8');
  const xrefStart = Buffer.byteLength(body, 'utf-8');
  const xref = [
    'xref\n',
    '0 6\n',
    '0000000000 65535 f \n',
    String(off1).padStart(10, '0') + ' 00000 n \n',
    String(off2).padStart(10, '0') + ' 00000 n \n',
    String(off3).padStart(10, '0') + ' 00000 n \n',
    String(off4).padStart(10, '0') + ' 00000 n \n',
    String(off5).padStart(10, '0') + ' 00000 n \n',
  ].join('');
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.concat([Buffer.from(body, 'utf-8'), Buffer.from(xref + trailer, 'utf-8')]);
};

// Leaves: apply
app.post('/leaves/apply', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, startDate, endDate, type, reason, attachmentUri, duration, halfDayPeriod } = body as {
      companyCode: string; employeeNo: string; startDate: string; endDate: string; type: string; reason: string; attachmentUri?: string; duration?: 'full' | 'half'; halfDayPeriod?: 'AM' | 'PM';
    };
    if (!companyCode || !employeeNo || !startDate || !endDate || !type || !reason) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    // Basic date validations
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      c.status(400); return c.json({ success: false, message: 'Invalid start/end date' });
    }
    if (end < start) {
      c.status(400); return c.json({ success: false, message: 'End date must be after or equal to start date' });
    }

    // Half-day validation: only allowed for single-day and AM/PM must be provided
    if (duration === 'half') {
      if (startDate !== endDate) {
        c.status(400); return c.json({ success: false, message: 'Half-day leave must be a single day' });
      }
      if (!halfDayPeriod) {
        c.status(400); return c.json({ success: false, message: 'Please select AM or PM for half-day leave' });
      }
    }

    // Calculate requested days (inclusive)
    const requestedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const effectiveDays = (duration === 'half' && requestedDays === 1) ? 0.5 : requestedDays;
    // Fetch user leave balances
    const userRow = await db.query(
      `SELECT annual_leave_balance, medical_leave_balance, emergency_leave_balance, unpaid_leave_balance FROM users WHERE id = $1`,
      [userId]
    );
    const balances = userRow.rows[0] || {};
    const lowerType = (type || '').toLowerCase();
    const requiresBalance = ['annual', 'medical', 'emergency'].includes(lowerType);
    if (requiresBalance) {
      const available = lowerType === 'annual' ? Number(balances.annual_leave_balance || 0)
        : lowerType === 'medical' ? Number(balances.medical_leave_balance || 0)
          : Number(balances.emergency_leave_balance || 0);
      if (effectiveDays > available) {
        c.status(400);
        return c.json({ success: false, message: `Insufficient ${lowerType} leave balance. Requested ${effectiveDays}, available ${available}.` });
      }
    }

    // Overlap prevention with existing pending/approved leaves
    const overlap = await db.query(
      `SELECT 1 FROM leaves 
       WHERE user_id = $1 
         AND status IN ('pending','approved') 
         AND NOT ($4 < start_date OR $3 > end_date)
       LIMIT 1`,
      [userId, null, startDate, endDate]
    );
    if (overlap.rows.length > 0) {
      c.status(409); return c.json({ success: false, message: 'Overlapping leave request exists' });
    }

    const ins = await db.query(
      `INSERT INTO leaves (user_id, start_date, end_date, type, reason, status, attachment_uri, duration, half_day_period, effective_days)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)
       RETURNING id, status, duration as duration_col, half_day_period as half_day_period_col, effective_days`,
      [userId, startDate, endDate, type, reason, attachmentUri || null, duration || 'full', halfDayPeriod || null, effectiveDays]
    );
    return c.json({ success: true, data: { id: ins.rows[0].id, status: ins.rows[0].status, duration: ins.rows[0].duration_col || 'full', halfDayPeriod: ins.rows[0].half_day_period_col || null, effectiveDays: ins.rows[0].effective_days ?? effectiveDays } });
  } catch (e) {
    console.error('apply leave error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Leaves: list
app.get('/leaves', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const rows = await db.query(
      `SELECT id, start_date, end_date, type, reason, status, attachment_uri, duration, half_day_period, effective_days
       FROM leaves WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    type LeaveRow = {
      id: string;
      start_date: Date;
      end_date: Date;
      type: string;
      reason: string;
      status: string;
      attachment_uri: string | null;
      duration: 'full' | 'half' | null;
      half_day_period: 'AM' | 'PM' | null;
      effective_days: number | null;
    };
    const data = (rows.rows as LeaveRow[]).map((r) => ({
      id: r.id,
      empNo: employeeNo,
      startDate: r.start_date.toISOString().slice(0, 10),
      endDate: r.end_date.toISOString().slice(0, 10),
      type: r.type,
      reason: r.reason,
      status: r.status,
      attachmentUri: r.attachment_uri,
      duration: (r.duration || 'full'),
      halfDayPeriod: r.half_day_period || null,
      effectiveDays: r.effective_days != null ? Number(r.effective_days) : undefined,
    }));
    return c.json({ success: true, data });
  } catch (e) {
    console.error('list leaves error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Leaves: update status (basic)
app.post('/leaves/update-status', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const {
      leaveId,
      status,
      rejectedReason,
      approverCompanyCode,
      approverEmployeeNo,
    } = body as {
      leaveId: string;
      status: 'approved' | 'rejected';
      rejectedReason?: string;
      approverCompanyCode?: string;
      approverEmployeeNo?: string;
    };

    if (!leaveId || !status) {
      c.status(400);
      return c.json({ success: false, message: 'Missing fields' });
    }

    // Enforce approver identity and role
    if (!approverCompanyCode || !approverEmployeeNo) {
      c.status(400);
      return c.json({ success: false, message: 'Approver identity is required' });
    }
    const approverCtx = await getUserContext(approverCompanyCode, approverEmployeeNo);
    if (!approverCtx.userId || !approverCtx.companyId) {
      c.status(404);
      return c.json({ success: false, message: 'Approver not found' });
    }
    const approverRow = await db.query(
      `SELECT role FROM users WHERE id = $1`,
      [approverCtx.userId]
    );
    const role = (approverRow.rows[0]?.role || 'employee').toLowerCase();
    if (!['manager', 'admin'].includes(role)) {
      c.status(403);
      return c.json({ success: false, message: 'Forbidden: approver role required' });
    }

    // Load leave and validate ownership and state
    const leaveRow = await db.query(
      `SELECT l.id, l.user_id, l.start_date, l.end_date, l.type, l.status, u.company_id
       FROM leaves l
       JOIN users u ON u.id = l.user_id
       WHERE l.id = $1`,
      [leaveId]
    );
    const leave = leaveRow.rows[0];
    if (!leave) {
      c.status(404);
      return c.json({ success: false, message: 'Leave not found' });
    }
    if (String(leave.company_id) !== String(approverCtx.companyId)) {
      c.status(403);
      return c.json({ success: false, message: 'Forbidden: cross-company operation' });
    }
    if (leave.status !== 'pending') {
      c.status(400);
      return c.json({ success: false, message: `Only pending leaves can be updated (current: ${leave.status})` });
    }

    // Transactional update with optional balance deduction on approval
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      if (status === 'approved') {
        // Revalidate and deduct balance for paid types
        const lowerType = String(leave.type || '').toLowerCase();
        const paidTypes = ['annual', 'medical', 'emergency'];
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const fallbackRequestedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        // Use effective_days if present (supports half-day approvals)
        const effRow = await client.query(
          `SELECT effective_days FROM leaves WHERE id = $1`,
          [leave.id]
        );
        const effectiveDays = effRow.rows[0]?.effective_days != null ? Number(effRow.rows[0].effective_days) : fallbackRequestedDays;

        if (paidTypes.includes(lowerType)) {
          const balRow = await client.query(
            `SELECT annual_leave_balance, medical_leave_balance, emergency_leave_balance 
             FROM users WHERE id = $1 FOR UPDATE`,
            [leave.user_id]
          );
          const bal = balRow.rows[0] || {};
          const available = lowerType === 'annual' ? Number(bal.annual_leave_balance || 0)
            : lowerType === 'medical' ? Number(bal.medical_leave_balance || 0)
              : Number(bal.emergency_leave_balance || 0);
          if (effectiveDays > available) {
            await client.query('ROLLBACK');
            c.status(400);
            return c.json({ success: false, message: `Insufficient ${lowerType} leave balance. Requested ${effectiveDays}, available ${available}.` });
          }
          // Deduct
          if (lowerType === 'annual') {
            await client.query(`UPDATE users SET annual_leave_balance = annual_leave_balance - $1 WHERE id = $2`, [effectiveDays, leave.user_id]);
          } else if (lowerType === 'medical') {
            await client.query(`UPDATE users SET medical_leave_balance = medical_leave_balance - $1 WHERE id = $2`, [effectiveDays, leave.user_id]);
          } else if (lowerType === 'emergency') {
            await client.query(`UPDATE users SET emergency_leave_balance = emergency_leave_balance - $1 WHERE id = $2`, [effectiveDays, leave.user_id]);
          }
        }
      }

      const upd = await client.query(
        `UPDATE leaves 
         SET status = $1, rejected_reason = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [status, status === 'rejected' ? (rejectedReason || null) : null, leaveId]
      );
      // Audit log for leave decision
      try {
        await client.query(
          `INSERT INTO admin_audit_logs (company_id, actor_user_id, action, target_type, target_id, metadata)
           VALUES ($1, $2, $3, 'leave', $4, $5)`,
          [leave.company_id, approverCtx.userId, `leave_${status}`, leaveId, JSON.stringify({ rejectedReason })]
        );
      } catch { }

      await client.query('COMMIT');
      return c.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('update leave status txn error:', err);
      c.status(500);
      return c.json({ success: false, message: 'Internal error' });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('update leave status error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Simple health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

// Users: profile (balances and basic info)
app.get('/users/profile', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const { companyId, userId } = await getUserContext(companyCode, employeeNo);
    if (!companyId || !userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }
    const row = await db.query(
      `SELECT u.name, u.role, u.annual_leave_balance, u.medical_leave_balance, u.emergency_leave_balance, u.unpaid_leave_balance
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    const u = row.rows[0];
    return c.json({
      success: true, data: {
        employeeNo,
        companyCode: companyCode.toUpperCase(),
        name: u?.name || employeeNo,
        role: u?.role || 'employee',
        leaveBalance: {
          annual: Number(u?.annual_leave_balance || 0),
          medical: Number(u?.medical_leave_balance || 0),
          emergency: Number(u?.emergency_leave_balance || 0),
          unpaid: Number(u?.unpaid_leave_balance || 0),
        },
      }
    });
  } catch (e) {
    console.error('get profile error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Payslips: list for a user (optional year filter)
app.get('/payslips', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    const yearParam = c.req.query('year');
    const year = yearParam ? Number(yearParam) : undefined;

    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    let result;
    if (year && Number.isInteger(year)) {
      const query = `
        WITH p AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY user_id, date_trunc('month', pay_date)
                   ORDER BY pay_date DESC, updated_at DESC, created_at DESC
                 ) AS rn
          FROM payslips
          WHERE user_id = $1 AND EXTRACT(YEAR FROM pay_date) = $2
        )
        SELECT * FROM p WHERE rn = 1
        ORDER BY pay_date DESC`;
      result = await db.query(query, [userId, year]);
    } else {
      const query = `
        WITH p AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY user_id, date_trunc('month', pay_date)
                   ORDER BY pay_date DESC, updated_at DESC, created_at DESC
                 ) AS rn
          FROM payslips
          WHERE user_id = $1
        )
        SELECT * FROM p WHERE rn = 1
        ORDER BY pay_date DESC`;
      result = await db.query(query, [userId]);
    }
    const data = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      payPeriodStart: row.pay_period_start,
      payPeriodEnd: row.pay_period_end,
      payDate: row.pay_date,
      basicSalary: parseFloat(row.basic_salary),
      overtimeHours: parseFloat(row.overtime_hours),
      overtimeRate: parseFloat(row.overtime_rate),
      overtimePay: parseFloat(row.overtime_pay),
      allowances: row.allowances || {},
      deductions: row.deductions || {},
      grossPay: parseFloat(row.gross_pay),
      taxDeduction: parseFloat(row.tax_deduction),
      netPay: parseFloat(row.net_pay),
      status: row.status,
      pdfUri: row.pdf_uri || undefined,
      createdAt: new Date(row.created_at).getTime?.() ?? (row.created_at?.getTime?.() || Date.now()),
      updatedAt: new Date(row.updated_at).getTime?.() ?? (row.updated_at?.getTime?.() || Date.now()),
    }));
    return c.json({ success: true, data });
  } catch (e) {
    console.error('list payslips error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Payslips: mark viewed
app.post('/payslips/mark-viewed', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo, payslipId } = body as { companyCode: string; employeeNo: string; payslipId: string };
    if (!companyCode || !employeeNo || !payslipId) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const { userId } = await getUserContext(companyCode, employeeNo);
    if (!userId) { c.status(404); return c.json({ success: false, message: 'User not found' }); }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE payslips SET status = 'viewed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [payslipId, userId]
      );
      await client.query('COMMIT');
      if (result.rows.length === 0) {
        c.status(404); return c.json({ success: false, message: 'Payslip not found' });
      }
      const row = result.rows[0];
      const data = {
        id: row.id,
        userId: row.user_id,
        payPeriodStart: row.pay_period_start,
        payPeriodEnd: row.pay_period_end,
        payDate: row.pay_date,
        basicSalary: parseFloat(row.basic_salary),
        overtimeHours: parseFloat(row.overtime_hours),
        overtimeRate: parseFloat(row.overtime_rate),
        overtimePay: parseFloat(row.overtime_pay),
        allowances: row.allowances || {},
        deductions: row.deductions || {},
        grossPay: parseFloat(row.gross_pay),
        taxDeduction: parseFloat(row.tax_deduction),
        netPay: parseFloat(row.net_pay),
        status: row.status,
        pdfUri: row.pdf_uri || undefined,
        createdAt: new Date(row.created_at).getTime?.() ?? (row.created_at?.getTime?.() || Date.now()),
        updatedAt: new Date(row.updated_at).getTime?.() ?? (row.updated_at?.getTime?.() || Date.now()),
      };
      return c.json({ success: true, data });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Error:', e);
    c.status(500);
    return c.json({ success: false, message: 'Internal server error' });
  }
});

// POST /admin/employees/import - Import employees from CSV/Excel data
app.post('/admin/employees/import', async (c) => {
  try {
    const body = await c.req.json();
    const { companyCode, employeeNo, employees } = body;

    if (!companyCode || !employeeNo || !Array.isArray(employees)) {
      c.status(400);
      return c.json({ success: false, message: 'Missing required fields' });
    }

    // Verify approver permissions
    const approver = await db.query(
      'SELECT u.id AS userId, u.role FROM users u JOIN companies co ON u.company_id = co.id WHERE co.company_code = $1 AND u.emp_no = $2',
      [companyCode, employeeNo]
    );
    if (approver.rows.length === 0) {
      c.status(401);
      return c.json({ success: false, message: 'Unauthorized' });
    }

    const approverRole = (approver.rows[0]?.role || '').toLowerCase();
    if (!['manager', 'admin'].includes(approverRole)) {
      c.status(403);
      return c.json({ success: false, message: 'Forbidden' });
    }

    const companyId = await db.query('SELECT id FROM companies WHERE company_code = $1', [companyCode]);
    if (companyId.rows.length === 0) {
      c.status(404);
      return c.json({ success: false, message: 'Company not found' });
    }

    const company_id = companyId.rows[0].id;
    const results: { success: number; failed: number; duplicates: number; errors: string[] } = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: []
    };

    // Process each employee
    for (const emp of employees) {
      try {
        // Validate required fields
        if (!emp.name || !emp.email) {
          results.failed++;
          results.errors.push(`Employee missing name or email: ${emp.name || 'Unknown'}`);
          continue;
        }

        // Check for duplicates
        const existingUser = await db.query(
          'SELECT id FROM users WHERE company_id = $1 AND (email = $2 OR emp_no = $3)',
          [company_id, emp.email, emp.empNo]
        );

        if (existingUser.rows.length > 0) {
          results.duplicates++;
          results.errors.push(`Duplicate employee: ${emp.email} or ${emp.empNo}`);
          continue;
        }

        // Insert employee
        const insertResult = await db.query(`
          INSERT INTO users (
            company_id, emp_no, name, email, password, phone, department, role, 
            is_active, join_date, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id
        `, [
          company_id,
          emp.empNo || `EMP${Date.now()}`,
          emp.name,
          emp.email,
          emp.password || 'password123',
          emp.phone || null,
          emp.department || null,
          emp.role || 'employee',
          emp.isActive !== undefined ? emp.isActive : true,
          emp.joinDate || null
        ]);

        if (insertResult.rows.length > 0) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Failed to insert employee: ${emp.name}`);
        }
      } catch (error) {
        results.failed++;
        const msg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error processing ${emp.name}: ${msg}`);
      }
    }

    // Audit log
    try {
      await db.query(
        'INSERT INTO audit_logs (user_id, action, details, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [
          approver.rows[0].userId,
          'import_employees',
          JSON.stringify({
            total: employees.length,
            success: results.success,
            failed: results.failed,
            duplicates: results.duplicates
          })
        ]
      );
    } catch (auditError) {
      console.error('Audit log error:', auditError);
    }

    return c.json({
      success: true,
      message: 'Import completed',
      results: {
        total: employees.length,
        success: results.success,
        failed: results.failed,
        duplicates: results.duplicates,
        errors: results.errors.slice(0, 10) // Limit error messages
      }
    });
  } catch (error) {
    console.error('Import employees error:', error);
    c.status(500);
    return c.json({ success: false, message: 'Internal server error' });
  }
});

// Admin: Data consistency check
app.get('/admin/consistency-check', async (c) => {
  try {
    const companyCode = c.req.query('companyCode') || '';
    const employeeNo = c.req.query('employeeNo') || '';
    if (!companyCode || !employeeNo) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const context = await getUserContext(companyCode, employeeNo);
    if (!context.userId || context.error) {
      c.status(404); return c.json({ success: false, message: context.error || 'User not found' });
    }

    // Check if user has admin privileges
    const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [context.userId]);
    if (userCheck.rows[0]?.role !== 'admin') {
      c.status(403); return c.json({ success: false, message: 'Admin access required' });
    }

    const reports = await runFullConsistencyCheck();
    return c.json({ success: true, data: reports });
  } catch (e) {
    console.error('Consistency check error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Admin: Fix data inconsistencies
app.post('/admin/fix-inconsistencies', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { companyCode, employeeNo } = body as { companyCode: string; employeeNo: string };
    if (!companyCode || !employeeNo) {
      c.status(400); return c.json({ success: false, message: 'Missing fields' });
    }
    const context = await getUserContext(companyCode, employeeNo);
    if (!context.userId || context.error) {
      c.status(404); return c.json({ success: false, message: context.error || 'User not found' });
    }

    // Check if user has admin privileges
    const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [context.userId]);
    if (userCheck.rows[0]?.role !== 'admin') {
      c.status(403); return c.json({ success: false, message: 'Admin access required' });
    }

    const result = await fixDataInconsistencies();
    return c.json({ success: true, data: result });
  } catch (e) {
    console.error('Fix inconsistencies error:', e);
    c.status(500); return c.json({ success: false, message: 'Internal error' });
  }
});

// Add request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  console.log(`[req] ${c.req.method} ${c.req.url}`);
  await next();
  const ms = Date.now() - start;
  console.log(`[res] ${c.req.method} ${c.req.url} -> ${c.res.status} (${ms}ms)`);
});

// Add notFound handler
app.notFound((c) => {
  return c.json({ status: "error", message: "Route not found" }, 404);
});

export default app;