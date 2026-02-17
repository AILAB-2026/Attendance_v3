// Production Configuration
// This file contains production-specific settings for the attendance API

export const productionConfig = {
  // Production domain
  domain: 'https://brave-smooth-favourite-geek.trycloudflare.com',

  // API base URL for client applications
  apiBaseUrl: 'https://brave-smooth-favourite-geek.trycloudflare.com',

  // Health check endpoint
  healthCheck: 'https://brave-smooth-favourite-geek.trycloudflare.com/health',

  // Authentication endpoint
  authEndpoint: 'https://brave-smooth-favourite-geek.trycloudflare.com/auth/login',

  // Face recognition endpoints
  faceEnrollment: 'https://brave-smooth-favourite-geek.trycloudflare.com/facialAuth/enroll',
  faceVerification: 'https://brave-smooth-favourite-geek.trycloudflare.com/facialAuth/verify',

  // Attendance endpoints
  clockIn: 'https://brave-smooth-favourite-geek.trycloudflare.com/attendance/clock-in',
  clockOut: 'https://brave-smooth-favourite-geek.trycloudflare.com/attendance/clock-out',

  // CORS settings for production
  corsOrigins: [
    'https://brave-smooth-favourite-geek.trycloudflare.com'
  ]
};

export default productionConfig;
