// Production Configuration
// This file contains production-specific settings for the attendance API

export const productionConfig = {
  // Production domain
  domain: 'https://led-usually-license-pub.trycloudflare.com',

  // API base URL for client applications
  apiBaseUrl: 'https://led-usually-license-pub.trycloudflare.com',

  // Health check endpoint
  healthCheck: 'https://led-usually-license-pub.trycloudflare.com/health',

  // Authentication endpoint
  authEndpoint: 'https://led-usually-license-pub.trycloudflare.com/auth/login',

  // Face recognition endpoints
  faceEnrollment: 'https://led-usually-license-pub.trycloudflare.com/facialAuth/enroll',
  faceVerification: 'https://led-usually-license-pub.trycloudflare.com/facialAuth/verify',

  // Attendance endpoints
  clockIn: 'https://led-usually-license-pub.trycloudflare.com/attendance/clock-in',
  clockOut: 'https://led-usually-license-pub.trycloudflare.com/attendance/clock-out',

  // CORS settings for production
  corsOrigins: [
    'https://led-usually-license-pub.trycloudflare.com'
  ]
};

export default productionConfig;
