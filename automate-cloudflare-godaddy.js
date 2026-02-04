#!/usr/bin/env node
/**
 * Automate Cloudflare + GoDaddy Setup
 * Connects endlessmolt.xyz to Cloudflare and updates GoDaddy nameservers
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');

// Get credentials from 1Password
function get1PasswordItem(itemName) {
  try {
    const result = execSync(`op item get "${itemName}" --format json`, { encoding: 'utf-8' });
    return JSON.parse(result);
  } catch (error) {
    console.error(`Failed to get ${itemName} from 1Password:`, error.message);
    return null;
  }
}

async function setupCloudflare(browser) {
  console.log('\n🔷 Step 1: Setting up Cloudflare...\n');

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Cloudflare login
    console.log('→ Navigating to Cloudflare dashboard...');
    await page.goto('https://dash.cloudflare.com/', { waitUntil: 'networkidle' });

    // Check if already logged in or need to login with GitHub
    const needsLogin = await page.locator('text=Log in').isVisible().catch(() => false);

    if (needsLogin) {
      console.log('→ Logging in with GitHub OAuth...');
      await page.click('text=Log in with GitHub');
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });
    }

    // Wait for dashboard to load
    await page.waitForSelector('text=Add a site', { timeout: 30000 });
    console.log('✓ Logged in to Cloudflare');

    // Add site
    console.log('→ Adding endlessmolt.xyz to Cloudflare...');
    await page.click('text=Add a site');
    await page.fill('input[type="text"]', 'endlessmolt.xyz');
    await page.click('button:has-text("Add site")');

    // Select Free plan
    await page.waitForSelector('text=Free', { timeout: 10000 });
    console.log('→ Selecting Free plan...');
    await page.click('button:has-text("Free")');
    await page.click('button:has-text("Continue")');

    // Wait for nameservers page
    await page.waitForSelector('text=nameserver', { timeout: 30000 });
    console.log('✓ Site added to Cloudflare');

    // Extract nameservers
    const nameserverElements = await page.locator('code').allTextContents();
    const nameservers = nameserverElements.filter(text => text.includes('.ns.cloudflare.com'));

    console.log('\n📋 Cloudflare Nameservers:');
    nameservers.forEach((ns, i) => console.log(`   ${i + 1}. ${ns}`));

    await context.close();
    return nameservers;

  } catch (error) {
    console.error('❌ Cloudflare setup failed:', error.message);
    await page.screenshot({ path: '/tmp/cloudflare-error.png' });
    console.log('Screenshot saved to /tmp/cloudflare-error.png');
    await context.close();
    return null;
  }
}

async function setupGoDaddy(browser, nameservers) {
  console.log('\n🌐 Step 2: Updating GoDaddy nameservers...\n');

  // Get GoDaddy credentials
  const godaddyCreds = get1PasswordItem('GoDaddy');
  if (!godaddyCreds) {
    console.error('❌ Could not retrieve GoDaddy credentials');
    return false;
  }

  const username = godaddyCreds.fields.find(f => f.purpose === 'USERNAME')?.value || 'calbotsman@proton.me';
  const password = godaddyCreds.fields.find(f => f.purpose === 'PASSWORD')?.value;

  if (!password) {
    console.error('❌ GoDaddy password not found in 1Password');
    return false;
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to GoDaddy login
    console.log('→ Navigating to GoDaddy...');
    await page.goto('https://sso.godaddy.com/', { waitUntil: 'networkidle' });

    // Login
    console.log('→ Logging in to GoDaddy...');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });
    console.log('✓ Logged in to GoDaddy');

    // Navigate to domain management
    console.log('→ Navigating to domain management...');
    await page.goto('https://dcc.godaddy.com/domains', { waitUntil: 'networkidle' });

    // Find and click endlessmolt.xyz
    console.log('→ Opening endlessmolt.xyz settings...');
    await page.click('text=endlessmolt.xyz');
    await page.waitForLoadState('networkidle');

    // Click DNS tab
    console.log('→ Opening DNS settings...');
    await page.click('text=DNS');
    await page.waitForLoadState('networkidle');

    // Scroll to Nameservers section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Click Change nameservers
    console.log('→ Changing nameservers...');
    await page.click('text=Change');
    await page.click('text=Enter my own nameservers');

    // Enter Cloudflare nameservers
    console.log('→ Entering Cloudflare nameservers...');
    for (let i = 0; i < nameservers.length && i < 2; i++) {
      await page.fill(`input[name="nameserver${i + 1}"]`, nameservers[i]);
    }

    // Save changes
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=successful', { timeout: 10000 });
    console.log('✓ Nameservers updated successfully!');

    await context.close();
    return true;

  } catch (error) {
    console.error('❌ GoDaddy setup failed:', error.message);
    await page.screenshot({ path: '/tmp/godaddy-error.png' });
    console.log('Screenshot saved to /tmp/godaddy-error.png');
    await context.close();
    return false;
  }
}

async function verifySetup() {
  console.log('\n🔍 Step 3: Verifying DNS setup...\n');

  try {
    const nsRecords = execSync('dig endlessmolt.xyz NS +short', { encoding: 'utf-8' });
    console.log('Current nameservers:');
    console.log(nsRecords);

    if (nsRecords.includes('cloudflare')) {
      console.log('✅ DNS propagated! Domain pointing to Cloudflare.');
      return true;
    } else {
      console.log('⏳ DNS not yet propagated (normal - takes 15-60 minutes)');
      console.log('   Check back later with: dig endlessmolt.xyz NS');
      return false;
    }
  } catch (error) {
    console.log('⏳ DNS records not yet available (propagating...)');
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Cloudflare + GoDaddy Automation                        ║');
  console.log('║  Domain: endlessmolt.xyz                                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({
    headless: false, // Show browser so you can see what's happening
    slowMo: 500 // Slow down for visibility
  });

  try {
    // Step 1: Setup Cloudflare
    const nameservers = await setupCloudflare(browser);

    if (!nameservers || nameservers.length === 0) {
      console.error('\n❌ Failed to get Cloudflare nameservers. Aborting.');
      await browser.close();
      return;
    }

    // Step 2: Update GoDaddy
    const godaddySuccess = await setupGoDaddy(browser, nameservers);

    if (!godaddySuccess) {
      console.error('\n❌ Failed to update GoDaddy nameservers.');
      await browser.close();
      return;
    }

    // Step 3: Verify (will show pending if not propagated yet)
    await verifySetup();

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ SETUP COMPLETE!                                      ║');
    console.log('║                                                          ║');
    console.log('║  Cloudflare: Connected ✓                                ║');
    console.log('║  GoDaddy: Nameservers updated ✓                         ║');
    console.log('║  DNS: Propagating (15-60 min)                           ║');
    console.log('║                                                          ║');
    console.log('║  endlessmolt.xyz will be live soon!                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Automation failed:', error);
  } finally {
    await browser.close();
  }
}

// Run it
main().catch(console.error);
