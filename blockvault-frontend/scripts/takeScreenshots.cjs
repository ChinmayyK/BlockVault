const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1280, height: 800 } 
  });
  
  const page = await browser.newPage();
  const outDir = path.join(__dirname, '../public/images/home');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    console.log('Navigating to app...');
    // Login via demo
    await page.goto('http://localhost:3001/demo', { waitUntil: 'networkidle0' });
    await wait(2000); // Wait for auth and redirect

    console.log('Capturing Step 1 (Upload Modal)...');
    // Click Upload Document button (assuming it has text 'Upload Legal Document' or similar)
    // Actually, in /files page, there's an Upload button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const uploadBtn = buttons.find(b => b.textContent && b.textContent.includes('Upload'));
      if (uploadBtn) uploadBtn.click();
    });
    await wait(1000); // Wait for modal animation
    
    // Screenshot the modal content
    const modalElement = await page.$('.legal-modal, [role="dialog"] > div');
    if (modalElement) {
      await modalElement.screenshot({ path: path.join(outDir, 'step1.png') });
      console.log('Saved step1.png');
    } else {
      // Fallback: screenshot center of screen
      await page.screenshot({ 
        path: path.join(outDir, 'step1.png'),
        clip: { x: 300, y: 150, width: 680, height: 500 }
      });
      console.log('Saved step1.png (fallback clip)');
    }

    // Close modal
    await page.keyboard.press('Escape');
    await wait(500);

    console.log('Capturing step 2 (Redaction)...');
    // Navigate to a redact page directly (demo sets up a mock file ID 'demo_doc_1')
    await page.goto('http://localhost:3001/demo/redact/demo_doc_1', { waitUntil: 'networkidle0' });
    await wait(3000); // Wait for entities to load
    
    // Screenshot the DocumentViewer or RiskScanPanel
    const viewerElement = await page.$('.document-viewer-container') || await page.$('main');
    if (viewerElement) {
      // Just take a nice clip of the top part of the viewer showing highlights
      await page.screenshot({
        path: path.join(outDir, 'step2.png'),
        clip: { x: 300, y: 100, width: 800, height: 400 }
      });
      console.log('Saved step2.png');
    }

    console.log('Capturing step 3 & 4 (File Details)...');
    // Go to file details page
    await page.goto('http://localhost:3001/files/demo_doc_1', { waitUntil: 'networkidle0' });
    await wait(2000);

    // Click on a button to open details panel if it's not open, or just screenshot the panel
    // The details panel is usually on the right side if implemented that way, or we can just screenshot it
    await page.screenshot({
      path: path.join(outDir, 'step3.png'),
      clip: { x: 800, y: 100, width: 400, height: 600 } // Guessing right sidebar position
    });
    console.log('Saved step3.png');
    
    // Step 4: same or different clip
    await page.screenshot({
      path: path.join(outDir, 'step4.png'),
      clip: { x: 800, y: 500, width: 400, height: 200 } // Lower section
    });
    console.log('Saved step4.png');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
  } finally {
    await browser.close();
    console.log('Done.');
  }
}

run();
