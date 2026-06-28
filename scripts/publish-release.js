const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = 'dipantan/Saddhamma';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (currentUrl) => {
      https.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          request(response.headers.location);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: HTTP status ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    };
    request(url);
  });
}

async function main() {
  try {
    console.log('🔍 Fetching latest finished Android builds from EAS...');
    const buildListRaw = execSync('eas build:list --platform android --status finished --json --limit 5', { encoding: 'utf8' });
    
    // Parse JSON (ignoring CLI output warnings/lines before JSON array)
    const jsonStartIndex = buildListRaw.indexOf('[');
    if (jsonStartIndex === -1) {
      throw new Error('Could not find valid JSON in EAS CLI output.');
    }
    const builds = JSON.parse(buildListRaw.slice(jsonStartIndex));

    const apkBuild = builds.find(b => 
      b.artifacts && 
      (b.artifacts.buildUrl?.endsWith('.apk') || b.artifacts.applicationArchiveUrl?.endsWith('.apk'))
    );

    if (!apkBuild) {
      throw new Error('No finished Android APK builds found in EAS history.');
    }

    const apkUrl = apkBuild.artifacts.buildUrl || apkBuild.artifacts.applicationArchiveUrl;
    const version = apkBuild.appVersion || '1.0.0';
    const buildNum = apkBuild.appBuildVersion || '1';
    
    // Custom tag from command-line arg or default to vX.X.X-bY (e.g. v1.0.0-b5)
    const customTag = process.argv[2];
    const tag = customTag || `v${version}-b${buildNum}`;
    const releaseTitle = `Saddhamma ${tag}`;

    console.log(`✅ Found latest APK build!`);
    console.log(`   Build ID: ${apkBuild.id}`);
    console.log(`   App Version: ${version} (Build #${buildNum})`);
    console.log(`   APK URL: ${apkUrl}\n`);

    const tempDir = path.join(__dirname, '../temp_release');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const apkFileName = `Saddhamma-${tag}.apk`;
    const apkPath = path.join(tempDir, apkFileName);
    const genericApkPath = path.join(tempDir, 'Saddhamma.apk');

    console.log(`📥 Downloading APK to ${apkPath}...`);
    await downloadFile(apkUrl, apkPath);
    fs.copyFileSync(apkPath, genericApkPath);
    console.log(`✅ Download complete! File size: ${(fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2)} MB\n`);

    console.log(`🚀 Publishing release to GitHub repository (${REPO})...`);
    
    // Check if gh CLI is available
    let hasGhCli = false;
    try {
      execSync('gh --version', { stdio: 'ignore' });
      hasGhCli = true;
    } catch (e) {
      hasGhCli = false;
    }

    if (hasGhCli) {
      console.log(`Using GitHub CLI (gh)...`);
      const notes = `Automated release for version ${version} (build #${buildNum}). Generated from Expo EAS build artifact.`;
      
      console.log(`Creating release ${tag}...`);
      const createRes = spawnSync('gh', ['release', 'create', tag, apkPath, genericApkPath, '--repo', REPO, '--title', releaseTitle, '--notes', notes], { stdio: 'inherit' });
      
      if (createRes.status !== 0) {
        console.log(`\nℹ️ Release tag ${tag} already exists or create skipped. Uploading APK assets to existing release...`);
        const uploadRes = spawnSync('gh', ['release', 'upload', tag, apkPath, genericApkPath, '--repo', REPO, '--clobber'], { stdio: 'inherit' });
        if (uploadRes.status === 0) {
          console.log(`\n🎉 APK assets successfully updated on existing GitHub release ${tag}!`);
        } else {
          throw new Error('Failed to upload release assets via gh CLI.');
        }
      } else {
        console.log(`\n🎉 Release ${tag} successfully created on GitHub!`);
      }
      console.log(`🔗 https://github.com/${REPO}/releases/tag/${tag}`);
    } else {
      console.log(`⚠️ GitHub CLI (gh) is not installed on your system.`);
      console.log(`📁 Your downloaded APK is saved at: ${apkPath}`);
      console.log(`\nTo publish automatically, install GitHub CLI (gh) or upload manually at:`);
      console.log(`🔗 https://github.com/${REPO}/releases/new?tag=${tag}`);
    }

  } catch (error) {
    console.error(`❌ Error in publish script:`, error.message);
    process.exit(1);
  }
}

main();
