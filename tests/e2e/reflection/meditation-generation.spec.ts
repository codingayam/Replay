import { test, expect } from '@playwright/test';
import { testUsers, testContent, mockApiResponses, selectors } from '../fixtures/test-data';

test.describe('Meditation Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup authenticated user
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' }
      }));
    });
    
    // Mock auth validation
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
    
    // Mock notes for reflection selection
    await page.route('**/api/notes', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notes)
      });
    });
    
    // Mock profile data
    await page.route('**/api/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.profile)
      });
    });
    
    await page.goto('/reflections');
  });

  test('should display reflections page with create reflection option', async ({ page }) => {
    await expect(page).toHaveURL(/\/reflections/);
    await expect(page.locator('h1')).toContainText(/reflections/i);
    
    // Should show create reflection button
    await expect(page.locator(selectors.createReflectionButton)).toBeVisible();
  });

  test('should open reflection creation flow when clicking create button', async ({ page }) => {
    await page.locator(selectors.createReflectionButton).click();
    
    // Should show first step - time period selection
    await expect(page.locator(selectors.modalOverlay)).toBeVisible();
    await expect(page.locator('text=Choose Time Period')).toBeVisible();
  });

  test('should navigate through reflection creation steps', async ({ page }) => {
    await page.locator(selectors.createReflectionButton).click();
    
    // Step 1: Time period selection
    await expect(page.locator('text=Choose Time Period')).toBeVisible();
    await page.locator('button:has-text("Last 7 days")').click();
    
    // Step 2: Duration selection
    await expect(page.locator('text=Choose Duration')).toBeVisible();
    await page.locator('button:has-text("5 minutes")').click();
    
    // Step 3: Time of reflection
    await expect(page.locator('text=Time of Reflection')).toBeVisible();
    await page.locator('button:has-text("Day")').click();
    
    // Step 4: Experience selection
    await expect(page.locator('text=Select Experiences')).toBeVisible();
  });

  test('should show available experiences for selection', async ({ page }) => {
    // Mock notes in date range
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notes)
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Navigate to experience selection
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    
    // Should show experiences
    await expect(page.locator(selectors.experienceSelector)).toBeVisible();
    
    // Should show individual experiences
    for (const note of mockApiResponses.notes) {
      await expect(page.locator(`text=${note.title}`)).toBeVisible();
    }
  });

  test('should allow selecting multiple experiences', async ({ page }) => {
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notes)
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Navigate to experience selection
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    
    // Select multiple experiences
    const firstExperience = page.locator(`[data-testid="experience-${mockApiResponses.notes[0].id}"]`);
    const secondExperience = page.locator(`[data-testid="experience-${mockApiResponses.notes[1].id}"]`);
    
    await firstExperience.click();
    await secondExperience.click();
    
    // Should show selected state
    await expect(firstExperience).toHaveClass(/selected/);
    await expect(secondExperience).toHaveClass(/selected/);
    
    // Should enable continue button
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeEnabled();
  });

  test('should show reflection summary before generating meditation', async ({ page }) => {
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notes)
      });
    });
    
    // Mock reflection summary
    await page.route('**/api/reflect/summary', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: 'Your reflection reveals themes of gratitude and mindfulness...',
          reflectedOn: 2,
          duration: 5
        })
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Navigate through steps
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    
    // Select experiences
    await page.locator(`[data-testid="experience-${mockApiResponses.notes[0].id}"]`).click();
    await page.locator(`[data-testid="experience-${mockApiResponses.notes[1].id}"]`).click();
    await page.locator('button:has-text("Continue")').click();
    
    // Should show summary
    await expect(page.locator('text=Reflection Summary')).toBeVisible();
    await expect(page.locator('text=Your reflection reveals themes of gratitude')).toBeVisible();
    await expect(page.locator('text=2 experiences')).toBeVisible();
    await expect(page.locator('text=5 minutes')).toBeVisible();
  });

  test('should successfully generate meditation', async ({ page }) => {
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notes)
      });
    });
    
    await page.route('**/api/reflect/summary', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: 'Your reflection reveals themes of gratitude and mindfulness...',
          reflectedOn: 2,
          duration: 5
        })
      });
    });
    
    // Mock successful meditation generation
    await page.route('**/api/meditate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playlist: mockApiResponses.meditation.playlist,
          meditationId: mockApiResponses.meditation.id,
          summary: mockApiResponses.meditation.summary
        })
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Complete the flow
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    await page.locator(`[data-testid="experience-${mockApiResponses.notes[0].id}"]`).click();
    await page.locator('button:has-text("Continue")').click();
    
    // Generate meditation
    await page.locator(selectors.generateMeditationButton).click();
    
    // Should show generation progress
    await expect(page.locator('text=Generating your meditation')).toBeVisible();
    await expect(page.locator(selectors.loadingSpinner)).toBeVisible();
    
    // Should show meditation player when complete
    await expect(page.locator(selectors.meditationPlayer)).toBeVisible();
    await expect(page.locator('text=Your meditation is ready')).toBeVisible();
  });

  test('should handle meditation generation errors', async ({ page }) => {
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notes)
      });
    });
    
    await page.route('**/api/reflect/summary', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: 'Summary',
          reflectedOn: 2,
          duration: 5
        })
      });
    });
    
    // Mock meditation generation error
    await page.route('**/api/meditate', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to generate meditation'
        })
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Complete the flow
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    await page.locator(`[data-testid="experience-${mockApiResponses.notes[0].id}"]`).click();
    await page.locator('button:has-text("Continue")').click();
    
    await page.locator(selectors.generateMeditationButton).click();
    
    // Should show error message
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText(/failed|error/i);
    
    // Should allow retrying
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('should play generated meditation audio', async ({ page }) => {
    // Setup successful generation
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockApiResponses.notes) });
    });
    await page.route('**/api/reflect/summary', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: 'Summary', reflectedOn: 2, duration: 5 }) });
    });
    await page.route('**/api/meditate', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockApiResponses.meditation) });
    });
    
    // Mock meditation audio files
    await page.route('**/meditations/**/*.wav', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: Buffer.alloc(1024) // Mock audio data
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Complete generation flow (simplified)
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    await page.locator(`[data-testid="experience-${mockApiResponses.notes[0].id}"]`).click();
    await page.locator('button:has-text("Continue")').click();
    await page.locator(selectors.generateMeditationButton).click();
    
    // Wait for meditation to be ready
    await expect(page.locator(selectors.meditationPlayer)).toBeVisible();
    
    // Should show play controls
    const playButton = page.locator('[data-testid="meditation-play"]');
    await expect(playButton).toBeVisible();
    
    // Click play
    await playButton.click();
    
    // Should show playing state
    await expect(page.locator('[data-testid="meditation-pause"]')).toBeVisible();
    await expect(page.locator('[data-testid="meditation-progress"]')).toBeVisible();
  });

  test('should save meditation after generation', async ({ page }) => {
    // Setup successful generation
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockApiResponses.notes) });
    });
    await page.route('**/api/reflect/summary', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: 'Summary', reflectedOn: 2, duration: 5 }) });
    });
    await page.route('**/api/meditate', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockApiResponses.meditation) });
    });
    
    // Mock saved meditations list
    await page.route('**/api/meditations', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockApiResponses.meditation])
        });
      }
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Complete generation
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    await page.locator(`[data-testid="experience-${mockApiResponses.notes[0].id}"]`).click();
    await page.locator('button:has-text("Continue")').click();
    await page.locator(selectors.generateMeditationButton).click();
    
    await expect(page.locator(selectors.meditationPlayer)).toBeVisible();
    
    // Should show save option
    const saveButton = page.locator('button:has-text("Save Meditation")');
    await expect(saveButton).toBeVisible();
    
    await saveButton.click();
    
    // Should show success message
    await expect(page.locator(selectors.successMessage)).toBeVisible();
    await expect(page.locator(selectors.successMessage)).toContainText(/saved/i);
  });

  test('should validate minimum experience selection', async ({ page }) => {
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notes)
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Navigate to experience selection
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    
    // Try to continue without selecting experiences
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeDisabled();
    
    // Should show validation message
    await expect(page.locator('text=Please select at least one experience')).toBeVisible();
  });

  test('should handle no experiences in date range', async ({ page }) => {
    // Mock empty notes response
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Navigate to experience selection
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    
    // Should show no experiences message
    await expect(page.locator('text=No experiences found in this time period')).toBeVisible();
    await expect(page.locator('button:has-text("Choose Different Period")')).toBeVisible();
  });

  test('should allow going back to modify selections', async ({ page }) => {
    await page.route('**/api/notes/date-range**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockApiResponses.notes) });
    });
    
    await page.locator(selectors.createReflectionButton).click();
    
    // Navigate forward
    await page.locator('button:has-text("Last 7 days")').click();
    await page.locator('button:has-text("5 minutes")').click();
    
    // Go back to change duration
    const backButton = page.locator('button:has-text("Back")');
    await backButton.click();
    
    // Should be back on duration selection
    await expect(page.locator('text=Choose Duration')).toBeVisible();
    
    // Change selection
    await page.locator('button:has-text("10 minutes")').click();
    await page.locator('button:has-text("Day")').click();
    
    // Should proceed with new duration
    await expect(page.locator('text=Select Experiences')).toBeVisible();
  });
});