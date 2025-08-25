import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Starting global E2E test setup...');
  
  // Create a browser instance for setup operations
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Health check - ensure server is running
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
    console.log(`Checking server health at ${baseURL}...`);
    
    await page.goto(`${baseURL.replace('5173', '3001')}/api/debug`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    const response = await page.textContent('pre') || await page.textContent('body');
    console.log('Server health check response:', response);
    
    // Setup test database if needed
    // This would typically involve:
    // 1. Running database migrations
    // 2. Creating test data
    // 3. Setting up test users
    
    // For now, we'll just verify the application loads
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    const title = await page.title();
    console.log('Application loaded with title:', title);
    
    // Store any global state that tests might need
    process.env.E2E_BASE_URL = baseURL;
    process.env.E2E_SETUP_COMPLETE = 'true';
    
    console.log('Global E2E test setup completed successfully');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;