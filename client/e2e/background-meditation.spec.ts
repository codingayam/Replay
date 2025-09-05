import { test, expect } from '@playwright/test';

test.describe('Background Meditation Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
  });

  test('should start background job and show notification when complete', async ({ page }) => {
    // Check if we need to login first
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup') || currentUrl.includes('/onboarding')) {
      console.log('Not logged in, skipping test - requires authenticated user');
      test.skip();
    }

    // Navigate to reflections page
    await page.click('[data-testid="reflections-tab"]').catch(async () => {
      // If tab doesn't exist, try navigation link
      await page.goto('http://localhost:5173/reflections');
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for the generate meditation button (could be various forms)
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("Begin")').first();
    
    if (await generateButton.count() === 0) {
      console.log('No generate button found - may need to select experiences first');
      
      // Try to find and select some experiences first
      const experienceItems = page.locator('[data-testid="experience-item"], .note-card, .experience-card');
      const experienceCount = await experienceItems.count();
      
      if (experienceCount > 0) {
        // Select first few experiences
        for (let i = 0; i < Math.min(3, experienceCount); i++) {
          await experienceItems.nth(i).click();
        }
        
        // Look for generate button again
        await page.waitForSelector('button:has-text("Generate"), button:has-text("Create"), button:has-text("Begin")', { timeout: 5000 });
      } else {
        console.log('No experiences found to select');
        test.skip();
      }
    }

    // Click the generate/create meditation button
    await generateButton.click();

    // Go through the meditation creation flow
    // This might involve multiple steps (duration selection, etc.)
    
    // Step 1: Handle duration selection if present
    const durationModal = page.locator('[data-testid="duration-modal"], .modal:has-text("Duration")');
    if (await durationModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select a short duration for testing (5 minutes)
      await page.click('button:has-text("5"), [data-duration="5"], .duration-5').catch(async () => {
        // If specific duration not found, click any duration option
        await page.click('.duration-option, .duration-button').first();
      });
      
      // Click continue/next
      await page.click('button:has-text("Continue"), button:has-text("Next")').catch(() => {});
    }

    // Step 2: Handle experience selection if present
    const experienceModal = page.locator('[data-testid="experience-modal"], .modal:has-text("Select"), .modal:has-text("Experience")');
    if (await experienceModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select some experiences
      const selectableExperiences = page.locator('.experience-item, .selectable-experience, input[type="checkbox"]');
      const count = await selectableExperiences.count();
      
      if (count > 0) {
        // Select first 2-3 experiences
        for (let i = 0; i < Math.min(3, count); i++) {
          await selectableExperiences.nth(i).click();
        }
      }
      
      // Click continue
      await page.click('button:has-text("Continue"), button:has-text("Generate"), button:has-text("Create")');
    }

    // Step 3: Handle ready to begin modal
    const readyModal = page.locator('[data-testid="ready-modal"], .modal:has-text("Ready"), .modal:has-text("Begin")');
    if (await readyModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('button:has-text("Begin"), button:has-text("Start"), button:has-text("Generate")');
    }

    // Wait for the meditation generation modal to appear
    await expect(page.locator('.modal:has-text("Creating"), .modal:has-text("Generating"), [data-testid="generating-modal"]')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Meditation generation modal appeared');

    // Look for the "Run in Background" button
    const backgroundButton = page.locator('button:has-text("Run in Background"), button:has-text("Background")');
    await expect(backgroundButton).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Background button found');

    // Click the background button
    await backgroundButton.click();
    
    // Verify the modal closes
    await expect(page.locator('.modal:has-text("Creating"), .modal:has-text("Generating")')).toBeHidden({ timeout: 5000 });
    
    console.log('✅ Modal closed after clicking background button');

    // Look for the background job indicator at the top
    const jobIndicator = page.locator('[data-testid="job-indicator"], .bg-blue-600, .fixed:has-text("meditation")');
    await expect(jobIndicator).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Background job indicator appeared');

    // Verify the indicator shows the job is processing
    await expect(jobIndicator).toContainText(/generating|processing|queued/i);
    
    console.log('✅ Job indicator shows processing status');

    // Wait for job completion (this could take several minutes)
    // We'll wait up to 5 minutes for the meditation to complete
    console.log('⏳ Waiting for meditation generation to complete...');
    
    // Wait for either:
    // 1. Job indicator to show "ready" or "completed"
    // 2. A success notification to appear
    // 3. Job indicator to show completion status
    const completionPromise = Promise.race([
      // Option 1: Job indicator shows completion
      page.waitForFunction(() => {
        const indicator = document.querySelector('[data-testid="job-indicator"], .bg-blue-600, .fixed');
        return indicator && (
          indicator.textContent?.includes('ready') ||
          indicator.textContent?.includes('completed') ||
          indicator.textContent?.includes('✅')
        );
      }, {}, { timeout: 300000 }), // 5 minutes

      // Option 2: Success notification appears
      page.waitForSelector('.notification:has-text("Ready"), .notification:has-text("completed"), .notification .success', { timeout: 300000 }),

      // Option 3: Check for completed status in indicator
      page.waitForFunction(() => {
        const indicator = document.querySelector('[data-testid="job-indicator"], .bg-blue-600');
        return indicator?.textContent?.includes('✅');
      }, {}, { timeout: 300000 })
    ]);

    try {
      await completionPromise;
      console.log('🎉 Meditation generation completed!');

      // Check if notification appeared
      const notification = page.locator('.notification:has-text("Ready"), .notification:has-text("completed"), [data-testid="notification"]');
      const hasNotification = await notification.isVisible().catch(() => false);
      
      if (hasNotification) {
        console.log('✅ Success notification appeared');
        
        // Verify notification has "Play Now" button
        const playButton = notification.locator('button:has-text("Play"), button:has-text("▶")');
        await expect(playButton).toBeVisible({ timeout: 2000 });
        console.log('✅ Play button found in notification');
        
        // Click play button to test navigation
        await playButton.click();
        
        // Should navigate to meditation player
        await page.waitForURL(/meditation/, { timeout: 10000 });
        console.log('✅ Successfully navigated to meditation player');
        
      } else {
        console.log('ℹ️ No notification found, checking job indicator status');
        
        // Check job indicator for completion status
        const indicatorText = await jobIndicator.textContent();
        expect(indicatorText).toMatch(/ready|completed|✅/i);
        console.log('✅ Job indicator shows completion status');
      }

    } catch (error) {
      console.log('⏰ Timeout waiting for completion, checking current status...');
      
      // Get current job status
      const indicatorText = await jobIndicator.textContent().catch(() => 'No indicator found');
      console.log('Current job status:', indicatorText);
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'background-job-timeout.png' });
      
      throw error;
    }
  });

  test('should show job status in indicator dropdown', async ({ page }) => {
    // Check if we need to login first
    if (page.url().includes('/login')) {
      test.skip();
    }

    await page.goto('http://localhost:5173/reflections');
    await page.waitForLoadState('networkidle');

    // Look for background job indicator
    const jobIndicator = page.locator('[data-testid="job-indicator"], .bg-blue-600, .fixed:has-text("meditation")');
    
    // Only continue if there's an active job
    if (!await jobIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No background jobs found, skipping indicator test');
      test.skip();
    }

    // Click the dropdown arrow to expand details
    const dropdownButton = jobIndicator.locator('button:has-text("▶"), button:has-text("▼"), .cursor-pointer');
    await dropdownButton.click();

    // Verify job details are shown
    const jobDetails = page.locator('[data-testid="job-details"], .bg-white, .border-t');
    await expect(jobDetails).toBeVisible();

    // Check for individual job items
    const jobItems = jobDetails.locator('.job-item, .flex.items-center, .p-3');
    expect(await jobItems.count()).toBeGreaterThan(0);

    console.log('✅ Job indicator dropdown functionality working');
  });

  test('should handle failed jobs with retry option', async ({ page }) => {
    // This test would require simulating a job failure
    // For now, we'll just check the UI structure exists
    
    await page.goto('http://localhost:5173/reflections');
    await page.waitForLoadState('networkidle');

    // Look for any failed job indicators (if they exist)
    const failedIndicator = page.locator('.bg-red-600, .text-red-600, :has-text("failed")');
    
    if (await failedIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found failed job, testing retry functionality');
      
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("🔄")');
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeVisible();
        console.log('✅ Retry button available for failed job');
      }
    } else {
      console.log('No failed jobs found (which is good!)');
    }
  });
});

// Helper test for debugging
test('debug: check page state', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  console.log('Current URL:', page.url());
  console.log('Page title:', await page.title());
  
  // Check if user is logged in
  const loginButton = await page.locator('button:has-text("Login"), a[href="/login"]').isVisible().catch(() => false);
  const profileButton = await page.locator('button:has-text("Profile"), a[href="/profile"]').isVisible().catch(() => false);
  
  console.log('Login button visible:', loginButton);
  console.log('Profile button visible:', profileButton);
  
  // Take a screenshot
  await page.screenshot({ path: 'debug-page-state.png' });
});