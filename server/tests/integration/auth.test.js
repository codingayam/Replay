const request = require('supertest');
const { requireAuth } = require('../../middleware/auth');
const { createTestUser } = require('../utils/testDatabase');

// Mock Express app for testing auth middleware
const express = require('express');
const app = express();

app.use(express.json());

// Test routes using auth middleware
app.get('/protected', requireAuth(), (req, res) => {
  res.json({
    message: 'Access granted',
    userId: req.auth.userId,
    user: req.auth.user
  });
});

app.get('/unprotected', (req, res) => {
  res.json({ message: 'Public access' });
});

describe('Authentication Middleware Integration Tests', () => {
  let testUser;
  let validToken;

  beforeEach(() => {
    testUser = {
      id: 'test-user-auth',
      email: 'auth@test.com',
      created_at: new Date().toISOString()
    };
    validToken = 'valid-jwt-token';

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('requireAuth middleware', () => {
    it('should allow access with valid Bearer token', async () => {
      // Mock successful Supabase auth validation
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: testUser },
        error: null
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Access granted',
        userId: testUser.id,
        user: testUser
      });

      expect(supabase.auth.getUser).toHaveBeenCalledWith(validToken);
    });

    it('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .expect(401);

      expect(response.body).toEqual({
        error: 'No token provided'
      });
    });

    it('should reject requests with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toEqual({
        error: 'No token provided'
      });
    });

    it('should reject requests with invalid token', async () => {
      // Mock Supabase auth failure
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token')
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Invalid or expired token'
      });
    });

    it('should reject requests with expired token', async () => {
      // Mock Supabase auth with expired token
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT expired' }
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Invalid or expired token'
      });
    });

    it('should handle Supabase service errors', async () => {
      // Mock Supabase service error
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockRejectedValue(
        new Error('Supabase service unavailable')
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication failed'
      });
    });

    it('should extract user ID correctly from token', async () => {
      const customUser = {
        id: 'custom-user-123',
        email: 'custom@test.com'
      };

      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: customUser },
        error: null
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.userId).toBe(customUser.id);
      expect(response.body.user).toEqual(customUser);
    });

    it('should not interfere with unprotected routes', async () => {
      const response = await request(app)
        .get('/unprotected')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Public access'
      });
    });
  });

  describe('Authentication error scenarios', () => {
    it('should handle network timeouts', async () => {
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockRejectedValue(
        Object.assign(new Error('Network timeout'), { code: 'ECONNABORTED' })
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body.error).toBe('Authentication failed');
    });

    it('should handle malformed JWT tokens', async () => {
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid JWT format')
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .expect(401);

      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should handle empty Bearer tokens', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should handle case-insensitive Bearer prefix', async () => {
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: testUser },
        error: null
      });

      // Test with lowercase 'bearer'
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'bearer valid-token')
        .expect(401); // Should fail because we expect 'Bearer'

      expect(response.body.error).toBe('No token provided');
    });
  });

  describe('Token validation edge cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(5000); // Very long token
      
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: testUser },
        error: null
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${longToken}`)
        .expect(200);

      expect(supabase.auth.getUser).toHaveBeenCalledWith(longToken);
    });

    it('should handle tokens with special characters', async () => {
      const specialToken = 'token.with-special_chars+symbols=123';
      
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: testUser },
        error: null
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${specialToken}`)
        .expect(200);

      expect(supabase.auth.getUser).toHaveBeenCalledWith(specialToken);
    });

    it('should handle concurrent authentication requests', async () => {
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: testUser },
        error: null
      });

      // Make multiple concurrent requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.userId).toBe(testUser.id);
      });

      // Supabase getUser should have been called for each request
      expect(supabase.auth.getUser).toHaveBeenCalledTimes(10);
    });
  });

  describe('Authentication context injection', () => {
    it('should properly inject user context into request object', async () => {
      const testRoute = express.Router();
      testRoute.get('/context-test', requireAuth(), (req, res) => {
        // Test that auth context is properly set
        expect(req.auth).toBeDefined();
        expect(req.auth.userId).toBe(testUser.id);
        expect(req.auth.user).toEqual(testUser);
        expect(req.auth.user.email).toBe(testUser.email);
        
        res.json({
          hasAuth: !!req.auth,
          hasUserId: !!req.auth.userId,
          hasUser: !!req.auth.user,
          userEmail: req.auth.user.email
        });
      });

      app.use('/test', testRoute);

      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: testUser },
        error: null
      });

      const response = await request(app)
        .get('/test/context-test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        hasAuth: true,
        hasUserId: true,
        hasUser: true,
        userEmail: testUser.email
      });
    });

    it('should handle missing user data gracefully', async () => {
      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: null }, // No user data
        error: null
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('Middleware integration with Express error handling', () => {
    it('should work with Express error handling middleware', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test-error', requireAuth(), (req, res) => {
        throw new Error('Route handler error');
      });

      // Error handling middleware
      testApp.use((err, req, res, next) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const { supabase } = require('../../middleware/auth');
      supabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: testUser },
        error: null
      });

      const response = await request(testApp)
        .get('/test-error')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });

    it('should not call next middleware when auth fails', async () => {
      const testApp = express();
      testApp.use(express.json());

      const nextMiddleware = jest.fn((req, res, next) => {
        res.json({ message: 'Should not reach here' });
      });

      testApp.get('/test-next', requireAuth(), nextMiddleware);

      const response = await request(testApp)
        .get('/test-next')
        .expect(401);

      expect(nextMiddleware).not.toHaveBeenCalled();
      expect(response.body.error).toBe('No token provided');
    });
  });
});