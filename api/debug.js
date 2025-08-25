// Debug endpoint to check environment variables
module.exports = async function handler(req, res) {
  try {
    const envStatus = {
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY ? 'Set' : 'Missing',
      SUPABASE_URL: !!process.env.SUPABASE_URL ? 'Set' : 'Missing',
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
      NODE_ENV: process.env.NODE_ENV || 'undefined'
    };

    const runtimeInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      message: 'Debug endpoint working',
      environment: envStatus,
      runtime: runtimeInfo,
      headers: {
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent'],
        authorization: req.headers.authorization ? 'Present' : 'Missing'
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message,
      stack: error.stack
    });
  }
};