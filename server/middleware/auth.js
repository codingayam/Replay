const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware to verify Supabase JWT tokens
const requireAuth = () => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No token provided' });
            }
            
            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            
            // Verify the JWT token with Supabase
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            
            // Add user info to request object (similar to Clerk's req.auth)
            req.auth = {
                userId: user.id,
                user: user
            };
            
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            return res.status(401).json({ error: 'Authentication failed' });
        }
    };
};

// Optional middleware for routes that don't require auth but should set user if available
const optionalAuth = () => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const { data: { user }, error } = await supabase.auth.getUser(token);
                
                if (!error && user) {
                    req.auth = {
                        userId: user.id,
                        user: user
                    };
                }
            }
            
            next();
        } catch (error) {
            // Continue without auth if there's an error
            next();
        }
    };
};

module.exports = {
    requireAuth,
    optionalAuth,
    supabase
};