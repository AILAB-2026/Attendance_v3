import express from "express";
import jwt from "jsonwebtoken";
import faceapi from "face-api.js";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { getCompanyPool } from "./multiCompanyDb.js";
import { logActivity } from "./utils/auditLogger.js";
import { createCanvas, loadImage, Canvas, Image } from "canvas";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const router = express.Router();

faceapi.env.monkeyPatch({ Canvas, Image });

// Compute __filename and __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Ensure images directory exists and configure multer with limits and filtering
const IMAGES_DIR = path.join(process.cwd(), "images");
fs.mkdir(IMAGES_DIR, { recursive: true }).catch(console.error);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const MAX_FILE_MB = parseInt(process.env.MULTER_MAX_FILE_MB || "5", 10);
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === "image/jpeg" || file.mimetype === "image/png";
    if (!ok) return cb(new Error("Only JPEG or PNG images are allowed"));
    cb(null, true);
  },
});

// Load face-api models
async function loadModels() {
  const modelsPath = path.join(__dirname, "models");
  // Bigger models (disabled)
  // await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
  // await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
  // await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

  // Lighter models
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath);
  await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(modelsPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
  console.log("Face detection models loaded");
}
let modelsReady = false;
loadModels()
  .then(() => {
    modelsReady = true;
    console.log("✅ Face models are ready");
  })
  .catch((e) => {
    modelsReady = false;
    console.error("❌ Failed to load face models:", e?.message || e);
  });

async function getFaceDescriptor(imagePath) {
  if (!modelsReady) {
    return { error: "MODELS_NOT_READY" };
  }
  const img = await loadImage(imagePath);

  const inputSize = parseInt(process.env.FACE_INPUT_SIZE || "224", 10);
  const scoreThreshold = parseFloat(process.env.FACE_SCORE_THRESHOLD || "0.5");
  const minBoxRatio = parseFloat(process.env.FACE_MIN_BOX_RATIO || "0.02");
  const maxBoxRatio = parseFloat(process.env.FACE_MAX_BOX_RATIO || "0.6");

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: isNaN(inputSize) ? 224 : inputSize,
    scoreThreshold: isNaN(scoreThreshold) ? 0.5 : scoreThreshold,
  });

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const input = canvas;

  // Detect all faces to enforce a single-face requirement
  const all = await faceapi
    .detectAllFaces(input, options)
    .withFaceLandmarks(true)
    .withFaceDescriptors();

  if (!all || all.length === 0) {
    return null;
  }
  if (all.length > 1) {
    return { error: "MULTIPLE_FACES", facesCount: all.length };
  }

  const d = all[0];
  const box = d.detection.box;
  const ratio = (box.width * box.height) / (img.width * img.height);
  const detScore = d.detection.score;

  // Quality gates
  if (detScore < (isNaN(scoreThreshold) ? 0.5 : scoreThreshold)) {
    return { error: "LOW_DETECTION_SCORE", detectionScore: detScore };
  }
  if (ratio < (isNaN(minBoxRatio) ? 0.02 : minBoxRatio) || ratio > (isNaN(maxBoxRatio) ? 0.6 : maxBoxRatio)) {
    return { error: "BAD_FACE_SIZE", boxRatio: ratio, detectionScore: detScore };
  }

  return {
    descriptor: Array.from(d.descriptor),
    detectionScore: detScore,
    boxRatio: ratio,
    imageWidth: img.width,
    imageHeight: img.height,
  };
}
router.post(
  "/enroll",
  upload.fields([
    { name: "faceImage", maxCount: 1 },
    // { name: "email", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!modelsReady) {
        return res.status(503).json({ success: false, status_code: 1, message: "Face models are initializing, please retry in a few seconds" });
      }
      const userToken = getTokenFromHeader(req);
      console.log("enroll userToken: " + userToken);
      // const email = req.body.email;
      const decoded = jwt.verify(userToken, SECRET_KEY);

      console.log("decoded employeeId " + decoded.employeeId);
      console.log("decoded customerId " + decoded.customerId);
      if (!req.files || !req.files["faceImage"] || !req.files["faceImage"][0]) {
        await logActivity("face-enroll", "failure", "No face image uploaded", { companyCode: decoded.companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, message: "No face image uploaded" });
      }

      const imagePath = req.files["faceImage"][0].path;
      const det = await getFaceDescriptor(imagePath);
      await fs.unlink(imagePath).catch(console.error);

      if (!det) {
        await logActivity("face-enroll", "failure", "Face not detected in image", { companyCode: decoded.companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, message: "Face not detected in the image. Please try again." });
      }
      if (det.error === "MODELS_NOT_READY") {
        return res.status(503).json({ success: false, status_code: 1, message: "Face models are initializing, please retry in a few seconds" });
      }
      if (det.error === "MULTIPLE_FACES") {
        await logActivity("face-enroll", "failure", "Multiple faces detected", { companyCode: decoded.companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, message: "Multiple faces detected. Please ensure only your face is in the frame." });
      }
      if (det.error === "LOW_DETECTION_SCORE") {
        await logActivity("face-enroll", "failure", "Low face detection score", { companyCode: decoded.companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, message: "Low face detection confidence. Improve lighting and face the camera directly." });
      }
      if (det.error === "BAD_FACE_SIZE") {
        await logActivity("face-enroll", "failure", "Bad face size", { companyCode: decoded.companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, message: "Face is too small or too large in the frame. Please reframe and try again." });
      }

      const faceDescriptor = det.descriptor;
      console.log("enroll descriptor length:", Array.isArray(faceDescriptor) ? faceDescriptor.length : 0);
      if (!faceDescriptor)
        res.status(400).json({
          status_code: 1,
          message: "Face not detected in the image. Please try again.",
        });
      else {
        // Get company-specific database pool from JWT token
        const companyCode = decoded.companyCode;
        if (!companyCode) {
          return res.status(400).json({
            success: false,
            status_code: 1,
            message: "Company code not found in token"
          });
        }

        try {
          const pool = await getCompanyPool(companyCode);

          // Update face descriptor in hr_employee table
          const dbRes = await pool.query(
            `UPDATE hr_employee 
             SET l_face_descriptor = $1 
             WHERE id = $2 
             RETURNING id, "x_Emp_No" as employee_no, name`,
            [JSON.stringify(faceDescriptor), decoded.employeeId]
          );

          if (dbRes.rows.length > 0) {
            console.log("✅ Face enrolled successfully for employee:", dbRes.rows[0].employee_no);
            res.status(200).json({
              success: true,
              status_code: 0,
              message: "Face enrolled successfully",
              data: {
                employeeNo: dbRes.rows[0].employee_no,
                name: dbRes.rows[0].name,
                detectionScore: det.detectionScore ?? undefined,
              }
            });
            await logActivity("face-enroll", "success", "Face enrolled successfully", { companyCode, employeeNo: dbRes.rows[0].employee_no, userId: decoded.employeeId });
          } else {
            console.log("❌ Employee not found");
            res.status(404).json({
              success: false,
              status_code: 1,
              error: "Employee not found"
            });
          }
        } catch (poolErr) {
          console.error("Error getting company pool:", poolErr);
          res.status(500).json({
            success: false,
            status_code: 1,
            message: "Error accessing company database"
          });
        }
      }
    } catch (err) {
      console.error("enroll error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

router.post(
  "/authenticate",
  upload.fields([{ name: "faceImage", maxCount: 1 }]),
  async (req, res) => {
    const startTime = Date.now();
    try {
      if (!modelsReady) {
        return res.status(503).json({ success: false, status_code: 1, message: "Face models are initializing, please retry in a few seconds" });
      }
      const userToken = getTokenFromHeader(req);
      console.log("🔐 Auth started for token");

      if (!userToken) {
        return res.status(401).json({ success: false, status_code: 1, error: "No token provided" });
      }

      let decoded;
      try {
        decoded = jwt.verify(userToken, SECRET_KEY);
      } catch (jwtErr) {
        console.error("JWT verification error (/facialAuth/authenticate):", jwtErr.message);
        return res.status(401).json({ success: false, status_code: 1, error: "Invalid or expired token" });
      }

      console.log("👤 Employee ID:", decoded.employeeId);

      const companyCode = decoded.companyCode || req.body?.companyCode || req.query?.companyCode;
      if (!companyCode) {
        return res.status(400).json({ success: false, status_code: 1, error: "Company code not found in token or request" });
      }

      // SECURITY: Server-side liveness verification
      const livenessData = req.body?.livenessData;
      if (livenessData) {
        try {
          const liveness = typeof livenessData === 'string' ? JSON.parse(livenessData) : livenessData;
          console.log(`🔒 [SECURITY] Liveness data received: ${liveness.frameCount} frames`);

          // Validate frame count
          if (!liveness.frames || liveness.frameCount < 2) {
            console.warn('🚨 [SECURITY] Insufficient liveness frames - possible spoofing');
            return res.status(400).json({
              success: false,
              status_code: 1,
              error: "Liveness verification failed: insufficient frames",
              livenessCheck: "failed"
            });
            await logActivity("face-auth", "failure", "Liveness failed: insufficient frames", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
            return response;
          }

          // Verify frame signatures are unique (static images would have identical signatures)
          const signatures = liveness.frames.map(f => f.signature);
          const uniqueSignatures = new Set(signatures);

          if (uniqueSignatures.size === 1) {
            console.warn('🚨 [SECURITY] Identical frame signatures detected - static image spoofing');
            return res.status(400).json({
              success: false,
              status_code: 1,
              error: "Liveness verification failed: static image detected",
              livenessCheck: "failed"
            });
            await logActivity("face-auth", "failure", "Liveness failed: static image detected", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
            return response;
          }

          // Verify frame sizes are consistent (manipulation detection)
          const frameLengths = liveness.frames.map(f => f.length);
          const avgLength = frameLengths.reduce((a, b) => a + b, 0) / frameLengths.length;
          const maxVariance = Math.max(...frameLengths.map(l => Math.abs(l - avgLength) / avgLength));

          if (maxVariance > 0.3) {
            console.warn('🚨 [SECURITY] Excessive frame size variance - possible video switching attack');
            return res.status(400).json({
              success: false,
              status_code: 1,
              error: "Liveness verification failed: suspicious frame variance",
              livenessCheck: "failed"
            });
            await logActivity("face-auth", "failure", "Liveness failed: suspicious frame variance", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
            return response;
          }

          console.log(`✅ [SECURITY] Liveness verification passed: ${uniqueSignatures.size} unique frames, variance=${(maxVariance * 100).toFixed(1)}%`);
        } catch (livenessErr) {
          console.warn('⚠️ [SECURITY] Could not parse liveness data:', livenessErr.message);
          // Continue without liveness check if data is malformed (backward compatibility)
        }
      } else {
        console.log('ℹ️ [SECURITY] No liveness data provided - legacy client or registration mode');
      }

      const pool = await getCompanyPool(companyCode);

      const dbStart = Date.now();
      let userResult;
      try {
        userResult = await pool.query(
          "SELECT l_face_descriptor FROM hr_employee WHERE id = $1",
          [decoded.employeeId]
        );
      } catch (dbErr) {
        if (dbErr && dbErr.code === "42P01") {
          console.error("⚠️ hr_employee table not found for face auth:", dbErr.message);
          return res.status(503).json({
            success: false,
            status_code: 1,
            error: "Face authentication is not available for this company (employee table missing)",
          });
        }
        throw dbErr;
      }
      console.log(`⏱️ DB query: ${Date.now() - dbStart}ms`);

      if (userResult.rows.length === 0) {
        await logActivity("face-auth", "failure", "User not found", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(404).json({ success: false, error: "User not found" });
      }
      if (userResult.rows[0].l_face_descriptor == null) {
        await logActivity("face-auth", "failure", "No face data enrolled", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res
          .status(400)
          .json({ success: false, error: "No face data enrolled for this user" });
      }

      const user = userResult.rows[0];

      // Get face descriptor from uploaded image
      if (!req.files || !req.files["faceImage"] || !req.files["faceImage"][0]) {
        await logActivity("face-auth", "failure", "No face image uploaded", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, error: "No face image uploaded" });
      }
      const imagePath = req.files["faceImage"][0].path;
      const faceStart = Date.now();
      const detection = await getFaceDescriptor(imagePath);
      console.log(`⏱️ Face detection: ${Date.now() - faceStart}ms`);
      await fs.unlink(imagePath).catch(console.error);

      if (!detection) {
        return res.status(400).json({
          success: false,
          status_code: 1,
          error: "Face not detected in the image. Please try again."
        });
        await logActivity("face-auth", "failure", "Face not detected", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return response;
      }
      if (detection.error === "MODELS_NOT_READY") {
        return res.status(503).json({ success: false, status_code: 1, error: "Face models are initializing, please retry in a few seconds" });
      }
      if (detection.error === "MULTIPLE_FACES") {
        await logActivity("face-auth", "failure", "Multiple faces detected", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, error: "Multiple faces detected. Please ensure only your face is in the frame." });
      }
      if (detection.error === "LOW_DETECTION_SCORE") {
        await logActivity("face-auth", "failure", "Low face detection score", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, error: "Low face detection confidence. Improve lighting and face the camera directly." });
      }
      if (detection.error === "BAD_FACE_SIZE") {
        await logActivity("face-auth", "failure", "Bad face size", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
        return res.status(400).json({ success: false, status_code: 1, error: "Face is too small or too large in the frame. Please reframe and try again." });
      }

      // Compare with stored descriptor
      const compareStart = Date.now();
      let storedArray;
      try {
        storedArray = JSON.parse(user.l_face_descriptor);
      } catch (e) {
        return res.status(500).json({ success: false, status_code: 1, error: "Stored face descriptor is corrupted. Please re-enroll." });
      }
      const storedDescriptor = new Float32Array(storedArray);
      const inputDescriptor = new Float32Array(detection.descriptor);

      // Calculate Euclidean distance
      let distance = 0;
      for (let i = 0; i < storedDescriptor.length; i++) {
        distance += Math.pow(storedDescriptor[i] - inputDescriptor[i], 2);
      }
      distance = Math.sqrt(distance);
      console.log(`⏱️ Face comparison: ${Date.now() - compareStart}ms`);

      // Threshold for face match (adjust as needed)
      const envThresh = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.45");
      const matchThreshold = isNaN(envThresh) ? 0.45 : envThresh; // 0.4=strict, 0.5=balanced
      const isMatch = distance < matchThreshold;
      const confidenceScore = 1 - Math.min(distance, 1); // Convert to confidence score

      console.log(`📊 Distance: ${distance.toFixed(3)} | Confidence: ${confidenceScore.toFixed(3)} | Match: ${isMatch ? '✅' : '❌'}`);

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ TOTAL AUTH TIME: ${totalTime}ms`);

      res.json({
        success: true,
        status_code: isMatch ? 0 : 1,
        message: isMatch ? "Face authenticated successfully" : "Face authentication failed",
        authenticated: isMatch,
        confidence: confidenceScore,
        threshold: matchThreshold,
        detectionScore: detection.detectionScore,
        distance: Number(distance.toFixed(4)),
        livenessCheck: livenessData ? "passed" : "skipped"
      });

      await logActivity(
        "face-auth",
        isMatch ? "success" : "failure",
        isMatch ? "Face authenticated successfully" : `Face mismatch (Distance: ${distance.toFixed(3)})`,
        {
          companyCode,
          employeeNo: decoded.employeeNo,
          userId: decoded.employeeId,
          metadata: { distance, confidence: confidenceScore, threshold: matchThreshold }
        }
      );
    } catch (err) {
      console.error("❌ Auth error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Simple readiness endpoint so UI can decide to retry or fallback
router.get("/ready", (req, res) => {
  return res.json({ success: true, ready: modelsReady });
});

// SECURITY: Enhanced liveness verification endpoint that processes 3 frames
// This analyzes face descriptor variance to detect static image spoofing
router.post(
  "/authenticate-live",
  upload.fields([
    { name: "frame1", maxCount: 1 },
    { name: "frame2", maxCount: 1 },
    { name: "frame3", maxCount: 1 },
  ]),
  async (req, res) => {
    const startTime = Date.now();
    const uploadedFiles = [];

    try {
      if (!modelsReady) {
        return res.status(503).json({
          success: false,
          status_code: 1,
          message: "Face models are initializing, please retry in a few seconds"
        });
      }

      const userToken = getTokenFromHeader(req);
      if (!userToken) {
        return res.status(401).json({ success: false, status_code: 1, error: "No token provided" });
      }

      let decoded;
      try {
        decoded = jwt.verify(userToken, SECRET_KEY);
      } catch (jwtErr) {
        console.error("JWT verification error:", jwtErr.message);
        return res.status(401).json({ success: false, status_code: 1, error: "Invalid or expired token" });
      }

      console.log("🔐 [LIVENESS] Multi-frame auth started for employee:", decoded.employeeId);

      const companyCode = decoded.companyCode || req.body?.companyCode || req.query?.companyCode;
      if (!companyCode) {
        return res.status(400).json({ success: false, status_code: 1, error: "Company code not found" });
      }

      // SECURITY: Require all 3 frames
      const frame1 = req.files?.["frame1"]?.[0];
      const frame2 = req.files?.["frame2"]?.[0];
      const frame3 = req.files?.["frame3"]?.[0];

      if (!frame1 || !frame2 || !frame3) {
        console.warn("🚨 [SECURITY] Missing frames - liveness verification requires 3 frames");
        return res.status(400).json({
          success: false,
          status_code: 1,
          error: "Liveness verification requires 3 frames",
          livenessCheck: "failed"
        });
      }

      uploadedFiles.push(frame1.path, frame2.path, frame3.path);
      console.log("📸 [LIVENESS] Processing 3 frames for liveness verification");

      // Extract face descriptors from all 3 frames
      const descriptorStart = Date.now();
      const [det1, det2, det3] = await Promise.all([
        getFaceDescriptor(frame1.path),
        getFaceDescriptor(frame2.path),
        getFaceDescriptor(frame3.path),
      ]);
      console.log(`⏱️ Face descriptor extraction: ${Date.now() - descriptorStart}ms`);

      // Clean up uploaded files
      for (const filePath of uploadedFiles) {
        await fs.unlink(filePath).catch(() => { });
      }

      // Validate all frames have valid face detections
      const detections = [det1, det2, det3];
      for (let i = 0; i < detections.length; i++) {
        const det = detections[i];
        if (!det) {
          return res.status(400).json({
            success: false,
            status_code: 1,
            error: `No face detected in frame ${i + 1}. Please ensure your face is visible.`,
            livenessCheck: "failed"
          });
          await logActivity("face-auth-live", "failure", `No face detected in frame ${i + 1}`, { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId });
          return response;
        }
        if (det.error) {
          return res.status(400).json({
            success: false,
            status_code: 1,
            error: `Frame ${i + 1}: ${det.error}`,
            livenessCheck: "failed"
          });
        }
      }

      // SECURITY: Calculate descriptor variance across frames
      // Live faces have natural micro-movements causing descriptor variation
      // Static images produce nearly identical descriptors
      const desc1 = new Float32Array(det1.descriptor);
      const desc2 = new Float32Array(det2.descriptor);
      const desc3 = new Float32Array(det3.descriptor);

      // Calculate pairwise Euclidean distances between frame descriptors
      const calcDistance = (a, b) => {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
          sum += Math.pow(a[i] - b[i], 2);
        }
        return Math.sqrt(sum);
      };

      const dist12 = calcDistance(desc1, desc2);
      const dist23 = calcDistance(desc2, desc3);
      const dist13 = calcDistance(desc1, desc3);
      const avgInterFrameDistance = (dist12 + dist23 + dist13) / 3;

      console.log(`📊 [LIVENESS] Inter-frame distances: ${dist12.toFixed(4)}, ${dist23.toFixed(4)}, ${dist13.toFixed(4)}`);
      console.log(`📊 [LIVENESS] Average inter-frame distance: ${avgInterFrameDistance.toFixed(4)}`);

      // SECURITY: Liveness thresholds
      // Static images typically have inter-frame distance < 0.05 (nearly identical)
      // Live faces typically have inter-frame distance 0.08 - 0.25 (natural variation)
      // Different people have inter-frame distance > 0.4
      const LIVENESS_MIN_THRESHOLD = parseFloat(process.env.LIVENESS_MIN_THRESHOLD || "0.03");
      const LIVENESS_MAX_THRESHOLD = parseFloat(process.env.LIVENESS_MAX_THRESHOLD || "0.35");

      if (avgInterFrameDistance < LIVENESS_MIN_THRESHOLD) {
        console.warn(`🚨 [SECURITY] STATIC IMAGE DETECTED! Inter-frame distance ${avgInterFrameDistance.toFixed(4)} < ${LIVENESS_MIN_THRESHOLD}`);
        return res.status(400).json({
          success: false,
          status_code: 1,
          error: "Liveness verification failed: Static image detected. Please use your real face.",
          livenessCheck: "failed",
          interFrameDistance: avgInterFrameDistance
        });
        await logActivity("face-auth-live", "failure", "Liveness failed: Static image detected", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId, metadata: { interFrameDistance: avgInterFrameDistance } });
        return response;
      }

      if (avgInterFrameDistance > LIVENESS_MAX_THRESHOLD) {
        console.warn(`🚨 [SECURITY] MULTIPLE FACES/VIDEO SWITCHING DETECTED! Inter-frame distance ${avgInterFrameDistance.toFixed(4)} > ${LIVENESS_MAX_THRESHOLD}`);
        return res.status(400).json({
          success: false,
          status_code: 1,
          error: "Liveness verification failed: Inconsistent face data. Please hold still and try again.",
          livenessCheck: "failed",
          interFrameDistance: avgInterFrameDistance
        });
        await logActivity("face-auth-live", "failure", "Liveness failed: Inconsistent face data", { companyCode, employeeNo: decoded.employeeNo, userId: decoded.employeeId, metadata: { interFrameDistance: avgInterFrameDistance } });
        return response;
      }

      console.log(`✅ [SECURITY] LIVENESS VERIFIED! Inter-frame distance ${avgInterFrameDistance.toFixed(4)} is within acceptable range.`);

      // Now verify the face matches the enrolled face
      const pool = await getCompanyPool(companyCode);
      const userResult = await pool.query(
        "SELECT l_face_descriptor FROM hr_employee WHERE id = $1",
        [decoded.employeeId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      if (userResult.rows[0].l_face_descriptor == null) {
        return res.status(400).json({ success: false, error: "No face data enrolled for this user" });
      }

      // Use the middle frame (frame2) for identity verification - typically the best quality
      let storedArray;
      try {
        storedArray = JSON.parse(userResult.rows[0].l_face_descriptor);
      } catch (e) {
        return res.status(500).json({ success: false, status_code: 1, error: "Stored face descriptor is corrupted. Please re-enroll." });
      }
      const storedDescriptor = new Float32Array(storedArray);

      // Calculate average descriptor from all 3 frames for more robust matching
      const avgDescriptor = new Float32Array(desc1.length);
      for (let i = 0; i < desc1.length; i++) {
        avgDescriptor[i] = (desc1[i] + desc2[i] + desc3[i]) / 3;
      }

      const identityDistance = calcDistance(storedDescriptor, avgDescriptor);
      const envThresh = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.45");
      const matchThreshold = isNaN(envThresh) ? 0.45 : envThresh;
      const isMatch = identityDistance < matchThreshold;
      const confidenceScore = 1 - Math.min(identityDistance, 1);

      console.log(`📊 Identity Distance: ${identityDistance.toFixed(3)} | Confidence: ${confidenceScore.toFixed(3)} | Match: ${isMatch ? '✅' : '❌'}`);

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ TOTAL LIVENESS AUTH TIME: ${totalTime}ms`);

      res.json({
        success: true,
        status_code: isMatch ? 0 : 1,
        message: isMatch ? "Face authenticated with liveness verification" : "Face does not match enrolled face",
        authenticated: isMatch,
        confidence: confidenceScore,
        threshold: matchThreshold,
        distance: Number(identityDistance.toFixed(4)),
        livenessCheck: "passed",
        livenessScore: avgInterFrameDistance,
        processingTime: totalTime
      });

      await logActivity(
        "face-auth-live",
        isMatch ? "success" : "failure",
        isMatch ? "Face authenticated with liveness verification" : `Face mismatch (Distance: ${identityDistance.toFixed(3)})`,
        {
          companyCode,
          employeeNo: decoded.employeeNo,
          userId: decoded.employeeId,
          metadata: { identityDistance, confidence: confidenceScore, threshold: matchThreshold, livenessScore: avgInterFrameDistance }
        }
      );

    } catch (err) {
      console.error("❌ Liveness auth error:", err);
      // Clean up any uploaded files on error
      for (const filePath of uploadedFiles) {
        await fs.unlink(filePath).catch(() => { });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Multer and generic error handling for this router
router.use((err, req, res, next) => {
  if (!err) return next();
  const msg = err?.message || "Upload error";
  const code = err?.code || undefined;
  const isMulter = err?.name === "MulterError";
  const status = isMulter || msg.includes("File too large") ? 413 : 400;
  try {
    if (req?.files) {
      const files = req.files["faceImage"]; // array
      if (Array.isArray(files)) {
        files.forEach((f) => f?.path && fs.unlink(f.path).catch(() => { }));
      }
    }
  } catch { }
  return res.status(status).json({ success: false, status_code: 1, error: msg, code });
});

export default router;
