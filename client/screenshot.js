const playwright = require('playwright');

async function takeScreenshot() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5175');
  await page.waitForTimeout(2000); // Wait for page to load
  
  await page.screenshot({ 
    path: 'timeline-screenshot.png',
    fullPage: true 
  });
  
  console.log('Screenshot saved as timeline-screenshot.png');
  await browser.close();
}

takeScreenshot().catch(console.error);