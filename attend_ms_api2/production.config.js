// Production Configuration
// This file contains production-specific settings for the attendance API

export const productionConfig = {
  // Production domain
  domain: 'http://192.168.1.10:7012',

  // API base URL for client applications
  apiBaseUrl: 'http://192.168.1.10:7012',

  // Health check endpoint
  healthCheck: 'http://192.168.1.10:7012/health',

  // Authentication endpoint
  authEndpoint: 'http://192.168.1.10:7012/auth/login',

  // Face recognition endpoints
  faceEnrollment: 'http://192.168.1.10:7012/facialAuth/enroll',
  faceVerification: 'http://192.168.1.10:7012/facialAuth/verify',

  // Attendance endpoints
  clockIn: 'http://192.168.1.10:7012/attendance/clock-in',
  clockOut: 'http://192.168.1.10:7012/attendance/clock-out',

  // CORS settings for production
  corsOrigins: [
    'http://192.168.1.10:7012'
  ]
};

export default productionConfig;
