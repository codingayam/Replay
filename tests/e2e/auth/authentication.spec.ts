import { test, expect } from '@playwright/test';
import { testUsers, selectors } from '../fixtures/test-data';

test.describe('User Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page - should redirect to login if not authenticated
    await page.goto('/');
  });

  test('should redirect unauthenticated users to login page', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText(/sign in|login/i);
  });

  test('should display login form with all required fields', async ({ page }) => {
    await expect(page.locator(selectors.loginEmailInput)).toBeVisible();
    await expect(page.locator(selectors.loginPasswordInput)).toBeVisible();
    await expect(page.locator(selectors.loginSubmitButton)).toBeVisible();
    
    // Should have link to signup page
    const signupLink = page.locator('text=Sign up');
    await expect(signupLink).toBeVisible();
  });

  test('should validate required fields on login form', async ({ page }) => {
    // Try to submit without filling fields
    await page.locator(selectors.loginSubmitButton).click();
    
    // Should show validation errors
    await expect(page.locator('[role="alert"], .error')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.locator(selectors.loginEmailInput).fill('invalid@example.com');
    await page.locator(selectors.loginPasswordInput).fill('wrongpassword');
    await page.locator(selectors.loginSubmitButton).click();
    
    // Should show error message
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText(/invalid|error/i);
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    // Mock successful login response
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          user: {
            id: 'test-user-123',
            email: testUsers.existingUser.email
          }
        })
      });
    });
    
    await page.locator(selectors.loginEmailInput).fill(testUsers.existingUser.email);
    await page.locator(selectors.loginPasswordInput).fill(testUsers.existingUser.password);
    await page.locator(selectors.loginSubmitButton).click();
    
    // Should redirect to experiences page after successful login
    await expect(page).toHaveURL(/\/experiences/);
  });

  test('should navigate to signup page from login', async ({ page }) => {
    const signupLink = page.locator('text=Sign up');
    await signupLink.click();
    
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.locator('h1')).toContainText(/sign up|create account/i);
  });
});

test.describe('User Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('should display signup form with all required fields', async ({ page }) => {
    await expect(page.locator(selectors.signupEmailInput)).toBeVisible();
    await expect(page.locator(selectors.signupPasswordInput)).toBeVisible();
    await expect(page.locator(selectors.signupSubmitButton)).toBeVisible();
    
    // Should have link to login page
    const loginLink = page.locator('text=Sign in');
    await expect(loginLink).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.locator(selectors.signupEmailInput).fill('invalid-email');
    await page.locator(selectors.signupPasswordInput).fill('ValidPassword123!');
    await page.locator(selectors.signupSubmitButton).click();
    
    // Should show email validation error
    await expect(page.locator('[role="alert"], .error')).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    await page.locator(selectors.signupEmailInput).fill('test@example.com');
    await page.locator(selectors.signupPasswordInput).fill('weak');
    await page.locator(selectors.signupSubmitButton).click();
    
    // Should show password validation error
    await expect(page.locator('[role="alert"], .error')).toBeVisible();
  });

  test('should successfully create account and redirect to onboarding', async ({ page }) => {
    // Mock successful signup response
    await page.route('**/auth/v1/signup**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          user: {
            id: 'new-user-123',
            email: testUsers.newUser.email,
            email_confirmed_at: new Date().toISOString()
          }
        })
      });
    });
    
    await page.locator(selectors.signupEmailInput).fill(testUsers.newUser.email);
    await page.locator(selectors.signupPasswordInput).fill(testUsers.newUser.password);
    await page.locator(selectors.signupSubmitButton).click();
    
    // Should redirect to onboarding after successful signup
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test('should handle existing user error', async ({ page }) => {
    // Mock user already exists error
    await page.route('**/auth/v1/signup**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'User already registered'
        })
      });
    });
    
    await page.locator(selectors.signupEmailInput).fill(testUsers.existingUser.email);
    await page.locator(selectors.signupPasswordInput).fill(testUsers.newUser.password);
    await page.locator(selectors.signupSubmitButton).click();
    
    // Should show error message
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText(/already/i);
  });
});

test.describe('Session Management', () => {
  test('should maintain session across page refreshes', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() + 3600000,
        user: { id: 'test-user', email: 'test@example.com' }
      }));
    });
    
    // Mock API calls for authenticated state
    await page.route('**/auth/v1/user**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          email: 'test@example.com'
        })
      });
    });
    
    await page.goto('/experiences');
    await expect(page).toHaveURL(/\/experiences/);
    
    // Refresh page
    await page.reload();
    
    // Should still be on experiences page (not redirected to login)
    await expect(page).toHaveURL(/\/experiences/);
  });

  test('should redirect to login when token expires', async ({ page }) => {
    // Mock expired token
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'expired-token',
        refresh_token: 'expired-refresh',
        expires_at: Date.now() - 3600000, // Expired 1 hour ago
        user: { id: 'test-user', email: 'test@example.com' }
      }));
    });
    
    // Mock API call returning unauthorized
    await page.route('**/auth/v1/user**', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'JWT expired'
        })
      });
    });
    
    await page.goto('/experiences');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should successfully logout and redirect to login', async ({ page }) => {
    // Setup authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' }
      }));
    });
    
    // Mock logout API call
    await page.route('**/auth/v1/logout**', async route => {
      await route.fulfill({
        status: 204,
        body: ''
      });
    });
    
    await page.goto('/profile');
    
    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Sign out"), button:has-text("Logout")');
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    
    // Should not be able to access protected routes
    await page.goto('/experiences');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Authentication Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/login');
    
    // Mock network failure
    await page.route('**/auth/v1/token**', async route => {
      await route.abort();
    });
    
    await page.locator(selectors.loginEmailInput).fill(testUsers.existingUser.email);
    await page.locator(selectors.loginPasswordInput).fill(testUsers.existingUser.password);
    await page.locator(selectors.loginSubmitButton).click();
    
    // Should show network error message
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText(/network|connection/i);
  });

  test('should handle server errors gracefully', async ({ page }) => {
    await page.goto('/login');
    
    // Mock server error
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      });
    });
    
    await page.locator(selectors.loginEmailInput).fill(testUsers.existingUser.email);
    await page.locator(selectors.loginPasswordInput).fill(testUsers.existingUser.password);
    await page.locator(selectors.loginSubmitButton).click();
    
    // Should show server error message
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
  });

  test('should disable submit button during login process', async ({ page }) => {
    await page.goto('/login');
    
    // Mock slow API response
    await page.route('**/auth/v1/token**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'token', user: { id: '1' } })
      });
    });
    
    await page.locator(selectors.loginEmailInput).fill(testUsers.existingUser.email);
    await page.locator(selectors.loginPasswordInput).fill(testUsers.existingUser.password);
    
    const submitButton = page.locator(selectors.loginSubmitButton);
    await submitButton.click();
    
    // Button should be disabled while request is in progress
    await expect(submitButton).toBeDisabled();
    
    // Should show loading state
    await expect(page.locator(selectors.loadingSpinner)).toBeVisible();
  });
});