import { test, expect } from '@playwright/test';
import { testUsers, testContent, testFiles, selectors } from '../fixtures/test-data';

test.describe('Audio Journaling Flow', () => {
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
    
    // Mock initial empty notes
    await page.route('**/api/notes', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      }
    });
    
    await page.goto('/experiences');
  });

  test('should display empty experiences page initially', async ({ page }) => {
    await expect(page).toHaveURL(/\/experiences/);
    await expect(page.locator('h1')).toContainText(/experiences/i);
    
    // Should show floating upload button
    await expect(page.locator(selectors.floatingUploadButton)).toBeVisible();
    
    // Should show empty state message
    await expect(page.locator('text=No experiences yet')).toBeVisible();
  });

  test('should open audio recording modal when clicking record button', async ({ page }) => {
    // Click floating upload button
    await page.locator(selectors.floatingUploadButton).click();
    
    // Should show upload options modal
    await expect(page.locator(selectors.modalOverlay)).toBeVisible();
    
    // Click audio record option
    await page.locator(selectors.audioRecordButton).click();
    
    // Should open audio recorder modal
    await expect(page.locator(selectors.audioRecorderModal)).toBeVisible();
    await expect(page.locator('text=Record Audio Note')).toBeVisible();
  });

  test('should handle microphone permission request', async ({ page }) => {
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    // Should show record button
    const recordButton = page.locator('button:has-text("Start Recording")');
    await expect(recordButton).toBeVisible();
    
    await recordButton.click();
    
    // Should show recording state
    await expect(page.locator('text=Recording...')).toBeVisible();
    await expect(page.locator('[data-testid="recording-duration"]')).toBeVisible();
  });

  test('should handle microphone permission denied', async ({ page }) => {
    // Deny microphone permission
    await page.context().grantPermissions([]);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    // Should show permission error
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText(/microphone|permission/i);
  });

  test('should record and create audio note successfully', async ({ page }) => {
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    // Mock successful note creation
    const mockNote = testContent.audioNotes[0];
    await page.route('**/api/notes', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-note-1',
            title: mockNote.expectedTitle,
            transcript: mockNote.transcript,
            type: 'audio',
            category: 'experience',
            date: new Date().toISOString(),
            audioUrl: '/audio/test-user/new-note-1.wav'
          })
        });
      }
    });
    
    // Mock updated notes list
    await page.route('**/api/notes', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'new-note-1',
            title: mockNote.expectedTitle,
            transcript: mockNote.transcript,
            type: 'audio',
            category: 'experience',
            date: new Date().toISOString(),
            audioUrl: '/audio/test-user/new-note-1.wav'
          }])
        });
      }
    });
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    // Start recording
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    // Wait a moment for recording
    await page.waitForTimeout(2000);
    
    // Stop recording
    const stopButton = page.locator('button:has-text("Stop Recording")');
    await stopButton.click();
    
    // Should show processing state
    await expect(page.locator('text=Processing...')).toBeVisible();
    
    // Should close modal and show new note
    await expect(page.locator(selectors.audioRecorderModal)).not.toBeVisible();
    await expect(page.locator(selectors.noteCard)).toBeVisible();
    await expect(page.locator(selectors.noteTitle)).toContainText(mockNote.expectedTitle);
  });

  test('should handle recording errors gracefully', async ({ page }) => {
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    // Mock API error
    await page.route('**/api/notes', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to process audio'
          })
        });
      }
    });
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    await page.waitForTimeout(1000);
    
    const stopButton = page.locator('button:has-text("Stop Recording")');
    await stopButton.click();
    
    // Should show error message
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText(/failed|error/i);
  });

  test('should allow canceling recording', async ({ page }) => {
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    // Should show recording state
    await expect(page.locator('text=Recording...')).toBeVisible();
    
    // Click cancel or close modal
    await page.locator(selectors.modalClose).click();
    
    // Should close modal without creating note
    await expect(page.locator(selectors.audioRecorderModal)).not.toBeVisible();
    await expect(page.locator(selectors.noteCard)).not.toBeVisible();
  });

  test('should show recording duration during recording', async ({ page }) => {
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    // Should show duration counter
    const durationDisplay = page.locator('[data-testid="recording-duration"]');
    await expect(durationDisplay).toBeVisible();
    await expect(durationDisplay).toContainText('0:01');
    
    // Wait and check duration updates
    await page.waitForTimeout(2000);
    await expect(durationDisplay).toContainText(/0:0[2-3]/);
  });

  test('should validate minimum recording duration', async ({ page }) => {
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    // Try to stop immediately (too short)
    await page.waitForTimeout(500); // Less than 1 second
    
    const stopButton = page.locator('button:has-text("Stop Recording")');
    await stopButton.click();
    
    // Should show minimum duration error
    await expect(page.locator(selectors.errorMessage)).toBeVisible();
    await expect(page.locator(selectors.errorMessage)).toContainText(/too short|minimum/i);
  });

  test('should handle maximum recording duration', async ({ page }) => {
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    // Mock maximum duration reached (speed up time)
    await page.addInitScript(() => {
      // Override Date.now to simulate time passing quickly
      const startTime = Date.now();
      const originalNow = Date.now;
      Date.now = () => startTime + (5 * 60 * 1000); // 5 minutes later
    });
    
    // Should automatically stop at maximum duration
    await expect(page.locator('text=Maximum recording time reached')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Save Recording")')).toBeVisible();
  });

  test('should show playback controls after recording', async ({ page }) => {
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    
    await page.waitForTimeout(2000);
    
    const stopButton = page.locator('button:has-text("Stop Recording")');
    await stopButton.click();
    
    // Should show playback controls
    await expect(page.locator('[data-testid="audio-player"]')).toBeVisible();
    await expect(page.locator('button:has-text("Play")')).toBeVisible();
    await expect(page.locator('button:has-text("Re-record")')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
  });

  test('should allow re-recording if not satisfied', async ({ page }) => {
    await page.context().grantPermissions(['microphone']);
    
    await page.locator(selectors.floatingUploadButton).click();
    await page.locator(selectors.audioRecordButton).click();
    
    // Record first attempt
    const recordButton = page.locator('button:has-text("Start Recording")');
    await recordButton.click();
    await page.waitForTimeout(1000);
    
    const stopButton = page.locator('button:has-text("Stop Recording")');
    await stopButton.click();
    
    // Click re-record
    const reRecordButton = page.locator('button:has-text("Re-record")');
    await reRecordButton.click();
    
    // Should be back in recording state
    await expect(page.locator('button:has-text("Start Recording")')).toBeVisible();
    await expect(page.locator('[data-testid="audio-player"]')).not.toBeVisible();
  });
});