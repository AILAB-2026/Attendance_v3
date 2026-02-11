# Facial Verification Security

## Overview

This document describes the comprehensive facial verification security system implemented in AIAttend to reject unauthorized faces, images, and faceless submissions while ensuring high accuracy for legitimate users.

## Security Features

### 1. Multi-Layer Verification

The system implements multiple layers of security checks:

#### **Frontend Security (Client-Side)**
- **Multi-frame capture**: Captures 3 frames with 300ms intervals
- **Liveness detection**: Validates temporal variation between frames
- **Dimension consistency**: Ensures frames are not manipulated
- **URI uniqueness**: Verifies each frame is a new capture

#### **Backend Security (Server-Side)**
- **Image URI validation**: Prevents injection attacks
- **Face detection**: Ensures a face is present in the image
- **Liveness verification**: Confirms real person vs. photo/video
- **Match scoring**: Compares against registered face template
- **Threshold enforcement**: Rejects scores below configured threshold

### 2. Anti-Spoofing Mechanisms

#### **Static Image Prevention**
- Multi-frame capture with temporal delays
- Frame variation analysis
- Liveness checks via AI service

#### **Video Replay Prevention**
- Real-time capture requirement
- Temporal consistency validation
- AI-based liveness detection

#### **Mask/Photo Prevention**
- Texture analysis (AI service)
- Depth information validation (AI service)
- Micro-movement detection (AI service)

### 3. Unauthorized Access Prevention

#### **Face Matching**
- Compares captured face against stored template
- Configurable match threshold (default: 0.75)
- Rejects unauthorized individuals

#### **Rate Limiting**
- Maximum 5 verification attempts per minute per user
- Prevents brute-force attacks
- Automatic window reset

## Configuration

### Environment Variables

```bash
# Strict mode (REQUIRED for production)
FACE_ENFORCE_STRICT=true

# AI Service webhook URL
FACE_VERIFY_WEBHOOK=https://your-ai-service.com/face/verify

# Match threshold (0.0 to 1.0)
# Higher = more secure, may reject valid users
# Lower = less secure, may accept similar faces
FACE_MATCH_THRESHOLD=0.75

# Disable development fallbacks
ENABLE_DEV_IMAGE_MATCH=false
```

### AI Service Requirements

Your face verification webhook must return:

```json
{
  "verified": true,
  "detectedFace": true,
  "liveness": true,
  "matchScore": 0.85,
  "reason": "Face verification successful",
  "userMessage": "✅ Face Recognition Successful"
}
```

**Required Fields:**
- `verified` (boolean): Overall verification result
- `detectedFace` (boolean): Face detected in image
- `liveness` (boolean): Liveness check passed
- `matchScore` (number): Similarity score (0.0 to 1.0)

## Security Workflow

### Clock-In/Clock-Out Process

1. **User initiates face recognition**
   - Camera opens with face guide overlay
   - Auto-scan starts after 2 seconds

2. **Multi-frame capture**
   - System captures 3 frames with 300ms intervals
   - Status: "Capturing multiple frames for security..."

3. **Client-side liveness check**
   - Validates frame variation
   - Checks dimension consistency
   - Verifies URI uniqueness
   - **REJECT if failed**: "⚠️ Liveness check failed. Use a real face, not a photo or video."

4. **Server-side verification**
   - Validates image URI format
   - Calls AI service webhook
   - Checks face detection
   - Verifies liveness
   - Compares match score against threshold

5. **Result handling**
   - **SUCCESS**: Clock-in/out recorded
   - **NO FACE**: "❌ No Face Detected - Ensure Face is Visible"
   - **LIVENESS FAILED**: "❌ Liveness Check Failed - Use Real Face"
   - **UNAUTHORIZED**: "❌ Face Does Not Match - Unauthorized"

## Error Messages

### User-Facing Messages

| Error Type | Title | Message |
|------------|-------|---------|
| No face detected | No Face Detected | Please ensure your face is fully visible, well-lit, and centered in the camera frame. |
| Liveness check failed | Liveness Check Failed | Please use your real face for verification. Photos, videos, or masks are not allowed. |
| Face mismatch | Unauthorized Face | The face does not match the registered user. Please ensure you are using your own account. |
| Service error | Verification Service Error | Face verification service error. Please try again. |

### Security Logging

All security events are logged with the `[SECURITY]` prefix:

```
[SECURITY] No face detected for user {userId}
[SECURITY] Liveness check failed for user {userId}
[SECURITY] Face match score {score} below threshold {threshold} for user {userId}
[SECURITY] Liveness verification failed - potential spoofing attempt
```

## Implementation Details

### Frontend Components

**File**: `components/FastFacialClocking.tsx`

Key functions:
- `startFaceScan()`: Initiates multi-frame capture
- `checkForLiveness()`: Client-side liveness validation
- `performFaceVerification()`: Calls backend API

### Backend Routes

**File**: `backend/hono.ts`

Key endpoints:
- `POST /face/register`: Register user face template
- `POST /face/verify`: Verify face against stored template
- `POST /security/unauthorized-access`: Report security incidents

**File**: `backend/trpc/routes/attendance/clock/route.ts`

Key features:
- Rate limiting (5 attempts/minute)
- Image URI validation
- Webhook integration
- Comprehensive error handling

### Security Helpers

```typescript
// Validate image URI format
function isValidImageUri(uri?: string | null): boolean {
  if (!uri) return false;
  const s = String(uri).trim();
  if (!s) return false;
  // Allow HTTPS URLs and data URLs with image mime types only
  if (/^https:\/\//i.test(s)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(s)) return true;
  return false;
}

// Rate limiting
function ensureRateLimit(empNo: string) {
  // Max 5 attempts per minute per employee
  // Throws TRPCError if limit exceeded
}
```

## Testing

### Manual Testing Checklist

- [ ] Valid user face recognition succeeds
- [ ] Photo of face is rejected (liveness check)
- [ ] Video replay is rejected (liveness check)
- [ ] No face in frame is rejected
- [ ] Different person's face is rejected (match score)
- [ ] Poor lighting conditions handled gracefully
- [ ] Rate limiting prevents abuse
- [ ] Error messages are user-friendly

### Security Testing

- [ ] Attempt to submit static image
- [ ] Attempt to replay video
- [ ] Attempt with mask/partial face
- [ ] Attempt with different person
- [ ] Attempt rapid-fire submissions (rate limit)
- [ ] Attempt with invalid image URI
- [ ] Attempt without face template registered

## Best Practices

### For Administrators

1. **Always enable strict mode in production**
   ```bash
   FACE_ENFORCE_STRICT=true
   ```

2. **Use a reliable AI service**
   - Ensure high uptime
   - Monitor response times
   - Have fallback procedures

3. **Set appropriate threshold**
   - Start with 0.75
   - Adjust based on false positive/negative rates
   - Document any changes

4. **Monitor security logs**
   - Watch for repeated failures
   - Investigate suspicious patterns
   - Alert on anomalies

### For Users

1. **Ensure good lighting**
   - Face should be well-lit
   - Avoid backlighting
   - Use natural or white light

2. **Position face correctly**
   - Center face in oval guide
   - Face camera directly
   - Remove glasses if needed

3. **Stay still during capture**
   - Don't move during 3-frame capture
   - Natural micro-movements are OK
   - Avoid sudden movements

## Troubleshooting

### Common Issues

**Issue**: "No Face Detected"
- **Cause**: Poor lighting, face not centered, face too far
- **Solution**: Improve lighting, center face, move closer

**Issue**: "Liveness Check Failed"
- **Cause**: Using photo/video, insufficient movement
- **Solution**: Use real face, ensure natural micro-movements

**Issue**: "Face Does Not Match"
- **Cause**: Different person, significant appearance change
- **Solution**: Re-register face template, contact administrator

**Issue**: "Too Many Requests"
- **Cause**: Exceeded 5 attempts per minute
- **Solution**: Wait 1 minute before retrying

## Security Considerations

### Data Privacy

- Face templates are stored securely in database
- Images are transmitted over HTTPS only
- No face data is logged or stored unnecessarily
- Comply with local privacy regulations (GDPR, etc.)

### Compliance

- Obtain user consent for biometric data collection
- Provide opt-out mechanisms where required
- Document data retention policies
- Implement data deletion procedures

### Incident Response

If unauthorized access is detected:

1. Log incident with full details
2. Alert administrators immediately
3. Review security logs for patterns
4. Consider temporary account suspension
5. Investigate and document findings

## Future Enhancements

Potential improvements:

- [ ] 3D depth sensing for enhanced liveness
- [ ] Behavioral biometrics (blink detection)
- [ ] Multi-factor authentication integration
- [ ] Anomaly detection with ML
- [ ] Real-time security dashboard
- [ ] Automated threat response

## Support

For security concerns or questions:
- Review security logs: `logs/backend-service-*.log`
- Check configuration: `.env.production`
- Contact: security@ailabtech.com

---

**Last Updated**: 2025-01-31
**Version**: 1.0
**Maintained By**: AIAttend Security Team
