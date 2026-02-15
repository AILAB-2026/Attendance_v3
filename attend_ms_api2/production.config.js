// Production Configuration
// This file contains production-specific settings for the attendance API

export const productionConfig = {
  // Production domain
  domain: 'https://tab-summer-charity-anyway.trycloudflare.com',

  // API base URL for client applications
  apiBaseUrl: 'https://tab-summer-charity-anyway.trycloudflare.com',

  // Health check endpoint
  healthCheck: 'https://tab-summer-charity-anyway.trycloudflare.com/health',

  // Authentication endpoint
  authEndpoint: 'https://tab-summer-charity-anyway.trycloudflare.com/auth/login',

  // Face recognition endpoints
  faceEnrollment: 'https://tab-summer-charity-anyway.trycloudflare.com/facialAuth/enroll',
  faceVerification: 'https://tab-summer-charity-anyway.trycloudflare.com/facialAuth/verify',

  // Attendance endpoints
  clockIn: 'https://tab-summer-charity-anyway.trycloudflare.com/attendance/clock-in',
  clockOut: 'https://tab-summer-charity-anyway.trycloudflare.com/attendance/clock-out',

  // CORS settings for production
  corsOrigins: [
    'https://tab-summer-charity-anyway.trycloudflare.com'
  ]
};

export default productionConfig;
