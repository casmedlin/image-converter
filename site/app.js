const REPO = 'casmedlin/image-converter';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

const assetMap = {
  'mac-arm64':     { pattern: /mac-arm64\.dmg$/ },
  'mac-x64':       { pattern: /mac-x64\.dmg$/ },
  'win-x64':       { pattern: /win-x64\.exe$/, exclude: /blockmap/ },
  'win-arm64':     { pattern: /win-arm64\.exe$/, exclude: /blockmap/ },
  'linux-x86_64':  { pattern: /linux-x86_64\.AppImage$/ },
  'linux-arm64':   { pattern: /linux-arm64\.AppImage$/ },
};

function detectOS() {
  const ua = navigator.userAgent;
  const arch = navigator.platform.toLowerCase();
  if (/mac/i.test(ua)) {
    return arch.includes('arm') || ua.includes('arm') ? 'mac-arm64' : 'mac-x64';
  }
  if (/win/i.test(ua)) {
    return ua.includes('arm64') || ua.includes('aarch64') ? 'win-arm64' : 'win-x64';
  }
  if (/linux/i.test(ua)) {
    return arch.includes('aarch64') || arch.includes('arm64') ? 'linux-arm64' : 'linux-x86_64';
  }
  return null;
}

async function fetchRelease() {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch release');
  return res.json();
}

function mapAssets(release) {
  const assets = {};
  for (const [key, { pattern, exclude }] of Object.entries(assetMap)) {
    const asset = release.assets.find(a =>
      pattern.test(a.name) && (!exclude || !exclude.test(a.name))
    );
    if (asset) assets[key] = asset.browser_download_url;
  }
  return assets;
}

async function init() {
  const detectedPrompt = document.getElementById('detected-prompt');
  const detectedText = document.getElementById('detected-text');
  const detectedLink = document.getElementById('detected-link');
  const showAllBtn = document.getElementById('show-all-btn');
  const allDownloads = document.getElementById('all-downloads');
  const versionInfo = document.getElementById('version-info');

  try {
    const release = await fetchRelease();
    const assets = mapAssets(release);

    versionInfo.textContent = release.tag_name;

    for (const btn of document.querySelectorAll('.download-btn')) {
      const key = btn.dataset.asset;
      if (assets[key]) {
        btn.href = assets[key];
      } else {
        btn.textContent = 'N/A';
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
      }
    }

    const detected = detectOS();
    if (detected && assets[detected]) {
      const labels = {
        'mac-arm64': 'macOS (Apple Silicon)',
        'mac-x64': 'macOS (Intel)',
        'win-x64': 'Windows (x64)',
        'win-arm64': 'Windows (ARM64)',
        'linux-x86_64': 'Linux (x86_64)',
        'linux-arm64': 'Linux (ARM64)',
      };
      detectedText.textContent = `Detected ${labels[detected]} — ready to download:`;
      detectedLink.href = assets[detected];
      detectedPrompt.classList.remove('hidden');
    } else {
      allDownloads.classList.remove('hidden');
    }

    showAllBtn.addEventListener('click', () => {
      detectedPrompt.classList.add('hidden');
      allDownloads.classList.remove('hidden');
    });

  } catch (e) {
    versionInfo.textContent = 'v1.0.0';
    allDownloads.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', init);
