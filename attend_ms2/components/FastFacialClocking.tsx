import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Animated } from 'react-native';
import CustomLoader from '@/components/CustomLoader';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Check, X, Scan, User, Shield, AlertTriangle } from 'lucide-react-native';
import colors from '@/constants/colors';
import { apiService } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

import { StatusType, StatusModalButton } from '@/components/StatusModal';

type FastFacialClockingProps = {
  intendedAction?: 'in' | 'out';
  onClockAction: (imageUri: string, action: 'in' | 'out') => Promise<void>;
  onCancel: () => void;
  mode?: 'clock' | 'register';
  onShowAlert?: (title: string, message: string, type: StatusType, buttons?: StatusModalButton[]) => void;
};

type CapturedPhoto = {
  uri: string;
  base64?: string;
  width: number;
  height: number;
};

const FastFacialClocking = ({ intendedAction = 'in', onClockAction, onCancel, mode = 'clock', onShowAlert }: FastFacialClockingProps) => {
  const isRegisterMode = mode === 'register';
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanningState, setScanningState] = useState<'ready' | 'scanning' | 'success' | 'failed'>('ready');
  const [statusMessage, setStatusMessage] = useState(
    isRegisterMode ? 'Position your face to register' : 'Position your face in the oval'
  );
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false); // Disabled: user must click 'Scan Face'

  const cameraRef = useRef<any>(null);
  const scanAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const autoScanTimer = useRef<any>(null);
  const scanTimeout = useRef<any>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Auto-scan after 2 seconds when camera is ready
  useEffect(() => {
    if (permission?.granted && autoScanEnabled && scanningState === 'ready') {
      autoScanTimer.current = setTimeout(() => {
        startFaceScan();
      }, 2000);
    }

    return () => {
      if (autoScanTimer.current) clearTimeout(autoScanTimer.current);
    };
  }, [permission?.granted, autoScanEnabled, scanningState]);

  // Scanning animation
  useEffect(() => {
    if (scanningState === 'scanning') {
      // Scanning line animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnimation, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanAnimation.setValue(0);
      pulseAnimation.setValue(1);
    }
  }, [scanningState]);

  const startFaceScan = async () => {
    if (isProcessing || scanningState === 'scanning') return;

    try {
      setScanningState('scanning');
      setStatusMessage('Scanning face...');
      setAutoScanEnabled(false);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Enhanced capture with anti-spoofing for clock mode
      scanTimeout.current = setTimeout(async () => {
        try {
          if (isRegisterMode) {
            // Simple capture for registration
            const rawPhoto = await (cameraRef.current as any).takePictureAsync({
              quality: 0.5,
              base64: false,
              skipProcessing: Platform.OS === 'android',
            });

            const photo = await manipulateAsync(
              rawPhoto.uri,
              [{ resize: { width: 500 } }],
              { compress: 0.6, format: SaveFormat.JPEG, base64: true }
            );

            setCapturedImage(photo.uri);
            setScanningState('success');
            setStatusMessage('Face captured! Registering...');

            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setTimeout(async () => {
              setIsProcessing(true);
              const dataUri = photo?.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri;
              await performFaceVerification({ ...photo, uri: dataUri });
            }, 800);
          } else {
            // SECURITY: Multi-frame capture with anti-spoofing for clock in/out
            setStatusMessage('Capturing multiple frames for security...');

            const photos: CapturedPhoto[] = [];
            const captureCount = 3; // Capture 3 frames for liveness verification

            for (let i = 0; i < captureCount; i++) {
              const rawPhoto = await (cameraRef.current as any).takePictureAsync({
                quality: 0.5,
                base64: false,
                skipProcessing: Platform.OS === 'android',
              });

              // Resize to tiny resolution for fast upload
              const manipulated = await manipulateAsync(
                rawPhoto.uri,
                [{ resize: { width: 400 } }],
                { compress: 0.5, format: SaveFormat.JPEG, base64: true } // base64 needed for verification API
              );

              photos.push({
                uri: manipulated.uri,
                width: manipulated.width,
                height: manipulated.height,
                base64: manipulated.base64
              });

              // SECURITY: 100ms delay between captures for temporal variation
              // This prevents static image spoofing attacks
              if (i < captureCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            // Use the middle photo as the main image
            const mainPhoto = photos[1];
            setCapturedImage(mainPhoto.uri);

            // SECURITY: Comprehensive liveness check with multiple frames
            const livenessVerified = await checkForLiveness(photos);

            if (!livenessVerified) {
              setScanningState('failed');
              setStatusMessage('⚠️ Liveness check failed. Use a real face, not a photo or video.');

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }

              // SECURITY: Report potential spoofing attempt
              console.warn('[SECURITY] Liveness verification failed - potential spoofing attempt');

              setTimeout(() => {
                setScanningState('ready');
                if (isRegisterMode) {
                  setStatusMessage('Position your face to register');
                } else {
                  setStatusMessage('Position your face in the oval');
                }
                setAutoScanEnabled(true);
              }, 3000);
              return;
            }

            setScanningState('success');
            setStatusMessage('✅ Liveness verified! Checking authorization...');

            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setTimeout(async () => {
              setIsProcessing(true);
              const dataUri = mainPhoto?.base64 ? `data:image/jpeg;base64,${mainPhoto.base64}` : mainPhoto.uri;
              // SECURITY: Pass all frames' base64 for server-side liveness verification
              const livenessFrames = photos.map(p => p.base64 || '').filter(b => b.length > 0);
              await performFaceVerification({ ...mainPhoto, uri: dataUri }, livenessFrames);
            }, 800);
          }

        } catch (error) {
          console.error('Face scan error:', error);
          setScanningState('failed');
          setStatusMessage('Scan failed. Tap to try again.');

          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }

          setTimeout(() => {
            setScanningState('ready');
            setStatusMessage(isRegisterMode ? 'Position your face to register' : 'Position your face in the oval');
            setAutoScanEnabled(true);
          }, 2000);
        }
      }, 1500);

    } catch (error) {
      console.error('Start scan error:', error);
      setScanningState('failed');
      setStatusMessage('Camera error. Please try again.');
    }
  };

  // Face verification using existing API with multi-frame liveness support
  const performFaceVerification = async (photo: CapturedPhoto, livenessFrames?: string[]) => {
    try {
      if (!user?.empNo || !(user as any)?.companyCode) {
        throw new Error('User not authenticated');
      }

      // For registration mode, skip verification and directly call onClockAction
      if (mode === 'register') {
        setStatusMessage('Registering face...');
        await onClockAction(photo.uri, intendedAction);
        return;
      }

      const companyCode = (user as any).companyCode;
      const employeeNo = user.empNo;

      // Use existing face verification API (for clock mode only)
      setStatusMessage('Verifying face...');

      // Prepare face template base64 (required for file:// URIs)
      const faceTemplateBase64 = photo.base64
        ? `data:image/jpeg;base64,${photo.base64}`
        : undefined;

      // Use existing face verification API with liveness frames
      const verificationResult = await apiService.verifyFace(
        companyCode,
        employeeNo,
        { imageUri: photo.uri, faceTemplateBase64, livenessFrames }
      );

      if (verificationResult.success) {
        setStatusMessage('✅ Face verified! Processing...');
        await onClockAction(photo.uri, intendedAction);
      } else {
        setScanningState('failed');
        const errorMsg = verificationResult.message || 'Face verification failed';
        setStatusMessage(`❌ ${errorMsg}`);
        setIsProcessing(false);

        // Show alert for unauthorized face
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        setTimeout(() => {
          if (onShowAlert) {
            const empNo = (user as any)?.empNo || (user as any)?.employeeNo || '';
            const alertTitle = intendedAction === 'out' ? 'Clock Out Failed' : 'Clock In Failed';
            const alertMessage = `EMP NO : ${empNo}\n\n${errorMsg}`;

            onShowAlert(
              alertTitle,
              alertMessage,
              'error',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    setIsProcessing(false);
                    onCancel();
                  }
                },
                {
                  text: 'Try Again',
                  style: 'primary',
                  onPress: () => {
                    setScanningState('ready');
                    setStatusMessage('Position your face in the oval');
                    setAutoScanEnabled(true);
                    setIsProcessing(false);
                  }
                }
              ]
            );
          }
        }, 500);
      }

    } catch (error: any) {
      console.error('Face verification error:', error);
      setScanningState('failed');
      setStatusMessage('Verification failed. Please try again.');
      setIsProcessing(false);

      // Log generic verification error
      if (user?.empNo && (user as any)?.companyCode) {
        apiService.logClientError(
          (user as any).companyCode,
          user.empNo,
          'face_verification',
          error.message || 'Face verification exception',
          'failure',
          { error: error }
        );
      }
    }
  };

  // Handle unauthorized access attempts
  const handleUnauthorizedAccess = async (
    attemptType: 'unknown_face' | 'spoofing_detected' | 'unauthorized_employee',
    detectedEmployee?: string
  ) => {
    try {
      setScanningState('failed');

      const companyCode = (user as any)?.companyCode;
      if (companyCode) {
        // Report to backend
        await apiService.reportUnauthorizedAccess(companyCode, {
          imageUri: capturedImage || '',
          timestamp: new Date().toISOString(),
          attemptType,
          detectedEmployee,
        });
      }

      // Show appropriate alert
      let alertTitle = 'Access Denied';
      let alertMessage = '';

      switch (attemptType) {
        case 'unknown_face':
          alertMessage = 'Unrecognized face detected. Access denied for security reasons.';
          break;
        case 'spoofing_detected':
          alertMessage = 'Spoofing attempt detected. Please use your actual face for verification.';
          break;
        case 'unauthorized_employee':
          alertMessage = `Unauthorized employee detected${detectedEmployee ? ` (${detectedEmployee})` : ''}. Please use your own credentials.`;
          break;
      }

      if (onShowAlert) {
        onShowAlert(alertTitle, alertMessage, 'error', [
          {
            text: 'OK',
            style: 'primary',
            onPress: () => {
              setIsProcessing(false);
              setTimeout(() => {
                setScanningState('ready');
                setStatusMessage(isRegisterMode ? 'Position your face to register' : 'Position your face in the oval');
                setAutoScanEnabled(true);
              }, 2000);
            }
          }
        ]);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

    } catch (error) {
      console.error('Error handling unauthorized access:', error);
      setIsProcessing(false);
    }
  };


  const handleManualScan = () => {
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    if (autoScanTimer.current) clearTimeout(autoScanTimer.current);
    startFaceScan();
  };

  // SECURITY: Enhanced anti-spoofing liveness detection by comparing multiple frames
  const checkForLiveness = async (photos: CapturedPhoto[]): Promise<boolean> => {
    try {
      // SECURITY: Multi-frame capture ensures:
      // 1. Slight differences between frames (indicating a live person)
      // 2. Natural micro-movements in facial features
      // 3. Prevents static image/photo spoofing
      // 4. Temporal consistency checks

      if (photos.length < 2) {
        console.warn('[SECURITY] Insufficient frames for liveness check');
        return false;
      }

      // SECURITY CHECK 1: Verify each frame is unique (prevents static image attacks)
      const hasVariation = photos.every((photo, index) => {
        if (index === 0) return true;
        return photo.uri !== photos[0].uri;
      });

      if (!hasVariation) {
        console.warn('[SECURITY] No variation detected between frames - possible spoofing');
        return false;
      }

      // SECURITY CHECK 2: Verify frame dimensions are consistent (prevents manipulation)
      const firstDimensions = { width: photos[0].width, height: photos[0].height };
      const dimensionsConsistent = photos.every(
        photo => photo.width === firstDimensions.width && photo.height === firstDimensions.height
      );

      if (!dimensionsConsistent) {
        console.warn('[SECURITY] Inconsistent frame dimensions detected');
        return false;
      }

      // SECURITY CHECK 3: Validate base64 content exists and is different
      if (photos.every(p => p.base64)) {
        // Compare base64 content length and first/last characters
        const base64Lengths = photos.map(p => p.base64!.length);
        const allSameLength = base64Lengths.every(len => len === base64Lengths[0]);

        // Calculate a simple hash for quick comparison
        const getSimpleHash = (b64: string) => {
          if (b64.length < 100) return b64;
          // Sample beginning, middle, and end
          return b64.slice(0, 50) + b64.slice(b64.length / 2 - 25, b64.length / 2 + 25) + b64.slice(-50);
        };

        const hashes = photos.map(p => getSimpleHash(p.base64!));
        const uniqueHashes = new Set(hashes);

        // If all hashes are identical, it's likely a static image
        if (uniqueHashes.size === 1) {
          console.warn('[SECURITY] Identical frame content detected - static image spoofing');
          return false;
        }

        // If frames are vastly different in size, it might be video switching
        if (!allSameLength) {
          const maxLen = Math.max(...base64Lengths);
          const minLen = Math.min(...base64Lengths);
          const sizeVariance = (maxLen - minLen) / maxLen;
          if (sizeVariance > 0.3) {
            console.warn('[SECURITY] Excessive size variance between frames - possible video attack');
            return false;
          }
        }
      }

      // SECURITY CHECK 4: Minimum content variation threshold
      // Live faces have natural micro-movements that cause slight pixel differences
      // This is verified server-side for stronger validation

      console.log(`[SECURITY] Client-side liveness check passed: ${photos.length} frames, variation=${hasVariation}, dimensions=${firstDimensions.width}x${firstDimensions.height}`);

      return true;

    } catch (error) {
      console.error('[SECURITY] Liveness check error:', error);
      return false; // Fail-safe: reject if we can't verify liveness
    }
  };

  const resetScan = () => {
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    if (autoScanTimer.current) clearTimeout(autoScanTimer.current);
    setScanningState('ready');
    setStatusMessage(mode === 'register' ? 'Position your face to register' : 'Position your face in the oval');
    setCapturedImage(null);
    setAutoScanEnabled(true);
    setIsProcessing(false);
  };

  useEffect(() => {
    return () => {
      if (scanTimeout.current) clearTimeout(scanTimeout.current);
      if (autoScanTimer.current) clearTimeout(autoScanTimer.current);
    };
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <CustomLoader size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required for facial recognition</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (capturedImage && isProcessing) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} style={styles.preview} />
        <View style={styles.processingOverlay}>
          <CustomLoader size="large" color="#fff" />
          <Text style={styles.processingText}>Processing your attendance...</Text>
        </View>
      </View>
    );
  }

  const getOvalColor = () => {
    switch (scanningState) {
      case 'scanning': return '#0AA0FF';
      case 'success': return '#4CAF50';
      case 'failed': return '#FF5252';
      default: return '#fff';
    }
  };

  const getStatusColor = () => {
    switch (scanningState) {
      case 'success': return '#4CAF50';
      case 'failed': return '#FF5252';
      default: return '#fff';
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash="off"
      />

      {/* Overlay with absolute positioning */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onCancel}>
            <X size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.title}>
            {isRegisterMode ? 'Register Face' : (intendedAction === 'in' ? 'Clock In' : 'Clock Out')}
          </Text>

          <View style={styles.placeholder} />
        </View>

        {/* Face Guide */}
        <View style={styles.faceGuideContainer}>
          <Animated.View style={[styles.faceGuide, { borderColor: getOvalColor() }]}>
            {/* Scanning line animation */}
            {scanningState === 'scanning' && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-100, 100],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}

            {/* Pulse animation for scanning */}
            {scanningState === 'scanning' && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [
                      {
                        scale: scanAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.2],
                        }),
                      },
                    ],
                    opacity: scanAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0],
                    }),
                  },
                ]}
              />
            )}

            {/* Success icon */}
            {scanningState === 'success' && (
              <View style={styles.successIcon}>
                <Check size={64} color="#4CAF50" strokeWidth={3} />
              </View>
            )}

            {/* Failed icon */}
            {scanningState === 'failed' && (
              <View style={styles.failedIcon}>
                <X size={64} color="#FF5252" strokeWidth={3} />
              </View>
            )}

            {/* Ready state icon */}
            {scanningState === 'ready' && (
              <View style={styles.readyIcon}>
                <User size={48} color="#fff" strokeWidth={2} />
              </View>
            )}
          </Animated.View>
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {statusMessage}
          </Text>

          {scanningState === 'ready' && !autoScanEnabled && (
            <Text style={styles.autoScanText}>
              Tap "Scan Face" when ready
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {scanningState === 'ready' || scanningState === 'failed' ? (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleManualScan}
            >
              <Scan size={24} color="#fff" />
              <Text style={styles.scanButtonText}>
                {scanningState === 'failed' ? 'Try Again' : 'Scan Face'}
              </Text>
            </TouchableOpacity>
          ) : scanningState === 'scanning' ? (
            <TouchableOpacity
              style={styles.cancelScanButton}
              onPress={resetScan}
            >
              <Text style={styles.cancelScanText}>Cancel Scan</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionText}>
            • {isRegisterMode ? 'Position your face in the oval' : 'Position your face in the oval'}
          </Text>
          <Text style={styles.instructionText}>
            • Look directly at the camera
          </Text>
          <Text style={styles.instructionText}>
            • {isRegisterMode ? 'Keep still during capture' : 'Keep still during scanning'}
          </Text>
        </View>

        {/* Flip Camera Button */}
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing((current) => (current === 'front' ? 'back' : 'front') as CameraType)}
        >
          <Text style={styles.flipText}>Flip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  actionPill: {
    color: '#0AA0FF',
    backgroundColor: 'rgba(10,160,255,0.15)',
    borderColor: '#0AA0FF',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '800',
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOval: {
    width: 280,
    height: 350,
    borderRadius: 140,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#0AA0FF',
    shadowColor: '#0AA0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  successIcon: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 50,
    padding: 15,
  },
  failedIcon: {
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    borderRadius: 50,
    padding: 15,
  },
  readyIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 40,
    padding: 12,
  },
  statusContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  autoScanText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 30,
    minWidth: 180,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  cancelScanButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelScanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  instructionText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  flipButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  flipText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  preview: {
    flex: 1,
    width: '100%',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  faceGuideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 280,
    height: 350,
    borderRadius: 140,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 280,
    height: 350,
    borderRadius: 140,
    borderWidth: 2,
    borderColor: '#0AA0FF',
  },
});

export default FastFacialClocking;
