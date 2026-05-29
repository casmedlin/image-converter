if (navigator.platform.toLowerCase().includes('mac')) {
  document.getElementById('titlebar').classList.add('macos');
}

const dropZone = document.getElementById('drop-zone');
const dropEmpty = document.getElementById('drop-empty');
const imageGrid = document.getElementById('image-grid');
const clearBtn = document.getElementById('clear-btn');
const convertBtn = document.getElementById('convert-btn');
const convertText = document.getElementById('convert-text');
const stats = document.getElementById('stats');
const statsText = document.getElementById('stats-text');
const outputDirInput = document.getElementById('output-dir');
const browseBtn = document.getElementById('browse-output');
const browseFilesBtn = document.getElementById('browse-btn');
const folderBtn = document.getElementById('folder-btn');
const scaleMode = document.getElementById('scale-mode');
const scalePercent = document.getElementById('scale-percent');
const scaleValueGroup = document.getElementById('scale-value-group');
const scaleDimGroup = document.getElementById('scale-dim-group');
const scaleWidth = document.getElementById('scale-width');
const scaleHeight = document.getElementById('scale-height');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const formatSelect = document.getElementById('format');
const previewsToggle = document.getElementById('previews-toggle');
const metadataToggle = document.getElementById('metadata-toggle');
const presetSelect = document.getElementById('preset');
const resultOverlay = document.getElementById('result-overlay');
const resultList = document.getElementById('result-list');
const closeResult = document.getElementById('close-result');
const resultOk = document.getElementById('result-ok');

const privacyOverlay = document.getElementById('privacy-overlay');
const termsOverlay = document.getElementById('terms-overlay');
const debugOverlay = document.getElementById('debug-overlay');

let images = [];
let isProcessing = false;
let previewsEnabled = true;

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return val < 10 ? val.toFixed(1) + ' ' + units[i] : Math.round(val) + ' ' + units[i];
}

function formatDimensions(w, h) {
  return (w && h) ? `${w} × ${h}` : 'Unknown';
}

function showDropEmpty() {
  dropEmpty.classList.remove('hidden');
  imageGrid.classList.add('hidden');
}

function showGrid() {
  dropEmpty.classList.add('hidden');
  imageGrid.classList.remove('hidden');
}

function renderGrid() {
  imageGrid.innerHTML = '';
  if (images.length === 0) {
    showDropEmpty();
    updateStats();
    return;
  }
  showGrid();

  images.forEach((img, i) => {
    const item = document.createElement('div');
    item.className = 'grid-item' + (img.selected ? ' selected' : '');
    item.dataset.index = i;

    const imgEl = document.createElement('img');
    imgEl.src = img.thumbnail || '';
    imgEl.alt = img.name;
    imgEl.draggable = false;
    if (!img.thumbnail) imgEl.style.display = 'none';

    const overlay = document.createElement('div');
    overlay.className = 'item-overlay';
    overlay.innerHTML = `
      <div class="item-name">${img.name}</div>
      <div class="item-size">${formatDimensions(img.width, img.height)} &middot; ${formatSize(img.size)}</div>
    `;

    const check = document.createElement('div');
    check.className = 'item-check';
    check.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    const progress = document.createElement('div');
    progress.className = 'item-progress';
    progress.innerHTML = `
      <svg class="progress-ring" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
        <circle class="progress-circle" cx="18" cy="18" r="16" fill="none" stroke="var(--accent)" stroke-width="2"
          stroke-dasharray="100.53" stroke-dashoffset="100.53" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <div class="progress-status">Processing...</div>
    `;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'item-error';
    errorDiv.textContent = 'Error';

    item.appendChild(imgEl);
    item.appendChild(overlay);
    item.appendChild(check);
    item.appendChild(progress);
    item.appendChild(errorDiv);

    item.addEventListener('click', () => {
      if (isProcessing) return;
      img.selected = !img.selected;
      item.classList.toggle('selected', img.selected);
      updateStats();
    });

    imageGrid.appendChild(item);
  });

  updateStats();
}

function updateStats() {
  const selectedCount = images.filter(i => i.selected).length;
  const totalCount = images.length;

  if (totalCount === 0) {
    stats.classList.add('hidden');
    clearBtn.classList.add('hidden');
    convertBtn.disabled = true;
    return;
  }

  stats.classList.remove('hidden');
  clearBtn.classList.remove('hidden');

  if (selectedCount === totalCount) {
    statsText.textContent = `${totalCount} image${totalCount !== 1 ? 's' : ''}`;
  } else {
    statsText.textContent = `${selectedCount} / ${totalCount} selected`;
  }

  convertBtn.disabled = selectedCount === 0 || isProcessing;
}

// ─── Import files ──────────────────────────────────────────────
async function importFile(file, filePath) {
  let metadata = null;
  try { metadata = await window.api.getMetadata(filePath); } catch {}

  let thumbnail = null;
  if (previewsEnabled) {
    try { thumbnail = await window.api.generateThumbnail(filePath); } catch {}
  }

  images.push({
    path: filePath,
    name: file.name,
    size: file.size || 0,
    width: metadata ? metadata.width : 0,
    height: metadata ? metadata.height : 0,
    thumbnail,
    selected: true,
  });
}

async function addFiles(fileList) {
  const loadingEl = document.getElementById('import-loading');
  const statusEl = document.getElementById('import-status');
  let imported = 0;
  const total = fileList.length;

  loadingEl.classList.remove('hidden');
  dropEmpty.classList.add('hidden');

  for (const file of fileList) {
    const filePath = file.path || file.name;
    statusEl.textContent = `Importing ${file.name}...`;
    await importFile(file, filePath);

    imported++;
    statusEl.textContent = `Imported ${imported} of ${total}`;
  }

  loadingEl.classList.add('hidden');
  renderGrid();
}

async function selectFilesNative() {
  const selected = await window.api.selectFiles();
  if (selected && selected.length > 0) {
    addFiles(selected);
  }
}

// ─── Import folder ─────────────────────────────────────────────
async function addFolder() {
  const loadingEl = document.getElementById('import-loading');
  const statusEl = document.getElementById('import-status');

  loadingEl.classList.remove('hidden');
  dropEmpty.classList.add('hidden');
  statusEl.textContent = 'Scanning folder...';

  try {
    const files = await window.api.openFolder();
    if (!files || files.length === 0) {
      loadingEl.classList.add('hidden');
      dropEmpty.classList.remove('hidden');
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      statusEl.textContent = `Importing ${f.name} (${i + 1}/${files.length})...`;
      await importFile(
        { name: f.name, size: f.size },
        f.path
      );
    }

    statusEl.textContent = `Imported ${files.length} images`;
  } catch (e) {
    statusEl.textContent = 'Error scanning folder';
  }

  loadingEl.classList.add('hidden');
  renderGrid();
}

// ─── Event listeners ───────────────────────────────────────────

dropZone.addEventListener('click', (e) => {
  if (e.target.closest('.grid-item') || e.target.closest('#controls') || e.target.closest('button')) return;
  selectFilesNative();
});

browseFilesBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  selectFilesNative();
});

folderBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  addFolder();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropEmpty.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropEmpty.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropEmpty.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    addFiles(e.dataTransfer.files);
  }
});

clearBtn.addEventListener('click', () => {
  images = [];
  renderGrid();
});

scaleMode.addEventListener('change', () => {
  const val = scaleMode.value;
  scaleValueGroup.classList.toggle('hidden', val !== 'percent');
  scaleDimGroup.classList.toggle('hidden', val !== 'dimensions');
});

qualitySlider.addEventListener('input', () => {
  qualityValue.textContent = qualitySlider.value;
});

browseBtn.addEventListener('click', async () => {
  const dir = await window.api.selectOutputDir();
  if (dir) outputDirInput.value = dir;
});

previewsToggle.addEventListener('change', () => {
  previewsEnabled = previewsToggle.checked;
  const label = previewsToggle.nextElementSibling.nextElementSibling;
  if (label) label.textContent = previewsEnabled ? 'On' : 'Off';
});

metadataToggle.addEventListener('change', () => {
  const label = metadataToggle.nextElementSibling.nextElementSibling;
  if (label) label.textContent = metadataToggle.checked ? 'Keep' : 'Strip';
});

// ─── Convert ───────────────────────────────────────────────────
convertBtn.addEventListener('click', async () => {
  if (isProcessing) return;
  const toProcess = images.filter(i => i.selected);
  if (toProcess.length === 0) return;

  const format = formatSelect.value;
  const outputDir = outputDirInput.value || null;

  const settings = {
    scaleMode: scaleMode.value,
    scalePercent: parseInt(scalePercent.value) || 100,
    scaleWidth: parseInt(scaleWidth.value) || 1920,
    scaleHeight: parseInt(scaleHeight.value) || 1080,
    quality: parseInt(qualitySlider.value) || 85,
    format,
    outputDir,
    keepMetadata: metadataToggle.checked,
  };

  isProcessing = true;
  convertBtn.disabled = true;
  const ct = convertBtn.querySelector('#convert-text');
  if (ct) ct.textContent = 'Converting...';
  convertBtn.classList.add('processing');
  const svg = convertBtn.querySelector('svg');
  if (svg) svg.remove();
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  convertBtn.insertBefore(spinner, convertBtn.firstChild);

  toProcess.forEach(img => {
    const idx = images.indexOf(img);
    const el = imageGrid.querySelector(`[data-index="${idx}"]`);
    if (el) el.classList.add('processing');
  });

  window.api.onProgress((data) => {
    const el = toProcess[data.current - 1]
      ? imageGrid.querySelector(`[data-index="${images.indexOf(toProcess[data.current - 1])}"]`)
      : null;
    if (el) {
      const circle = el.querySelector('.progress-circle');
      if (circle) {
        circle.style.strokeDashoffset = 100.53 * (1 - data.current / data.total);
      }
      const status = el.querySelector('.progress-status');
      if (status) {
        status.textContent = data.success ? `${Math.round((data.current / data.total) * 100)}%` : 'Error';
      }
      if (!data.success) {
        el.classList.remove('processing');
        el.classList.add('errored');
        const errDiv = el.querySelector('.item-error');
        if (errDiv) errDiv.textContent = data.error || 'Error';
      }
    }
  });

  const results = await window.api.processImages({
    images: toProcess.map(img => ({ path: img.path, size: img.size })),
    settings,
  });

  window.api.removeProgressListeners();

  toProcess.forEach(img => {
    const idx = images.indexOf(img);
    const el = imageGrid.querySelector(`[data-index="${idx}"]`);
    if (el) el.classList.remove('processing');
  });

  showResults(results);

  isProcessing = false;
  convertBtn.innerHTML = `
    <span id="convert-text">Convert</span>
  `;
  convertBtn.disabled = false;
  convertBtn.classList.remove('processing');
  updateStats();
});

function showResults(results) {
  resultList.innerHTML = '';
  let successCount = 0;
  let errorCount = 0;

  results.forEach(r => {
    const item = document.createElement('div');
    item.className = `result-item ${r.success ? 'success' : 'error'}`;

    const icon = document.createElement('div');
    icon.className = 'result-icon';
    if (r.success) {
      icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      successCount++;
    } else {
      icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      errorCount++;
    }

    const info = document.createElement('div');
    info.className = 'result-info';
    const name = document.createElement('div');
    name.className = 'result-name';
    name.textContent = r.success ? r.outputName : `${r.inputName} — failed`;
    const details = document.createElement('div');
    details.className = 'result-details';
    if (r.success) {
      const pct = r.inputSize > 0 ? ((1 - r.outputSize / r.inputSize) * 100).toFixed(1) : 0;
      const cls = parseFloat(pct) >= 0 ? 'savings' : 'increase';
      details.innerHTML = `
        ${formatDimensions(r.inputWidth, r.inputHeight)} → ${formatDimensions(r.outputWidth, r.outputHeight)} &middot;
        ${formatSize(r.inputSize)} → ${formatSize(r.outputSize)}
        <span class="${cls}">(${parseFloat(pct) >= 0 ? '-' : '+'}${Math.abs(pct)}%)</span>
      `;
    } else {
      details.textContent = r.error || 'Unknown error';
    }

    info.appendChild(name);
    info.appendChild(details);
    item.appendChild(icon);
    item.appendChild(info);
    resultList.appendChild(item);
  });

  const header = resultOverlay.querySelector('.overlay-header h2');
  header.textContent = `${successCount} converted${errorCount > 0 ? `, ${errorCount} failed` : ''}`;
  resultOverlay.classList.remove('hidden');
}

// ─── Overlay controls ─────────────────────────────────────────
function setupOverlay(overlay, closeBtns) {
  const closers = closeBtns.map(id => document.getElementById(id));
  closers.forEach(el => {
    if (el) el.addEventListener('click', () => overlay.classList.add('hidden'));
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

setupOverlay(resultOverlay, ['close-result', 'result-ok']);
setupOverlay(privacyOverlay, ['close-privacy', 'privacy-ok']);
setupOverlay(termsOverlay, ['close-terms', 'terms-ok']);
setupOverlay(debugOverlay, ['close-debug', 'debug-ok']);

document.getElementById('privacy-link').addEventListener('click', (e) => {
  e.preventDefault();
  privacyOverlay.classList.remove('hidden');
});

document.getElementById('terms-link').addEventListener('click', (e) => {
  e.preventDefault();
  termsOverlay.classList.remove('hidden');
});

document.getElementById('debug-link').addEventListener('click', async (e) => {
  e.preventDefault();
  const v = await window.api.getVersion();
  document.getElementById('version-display').textContent = v || 'unknown';
  debugOverlay.classList.remove('hidden');
});

// ─── Presets ───────────────────────────────────────────────────
const presets = {
  // Icons
  'ios-icon':     { scaleMode: 'dimensions', scaleWidth: 1024, scaleHeight: 1024, format: 'png', quality: 95 },
  'android-icon': { scaleMode: 'dimensions', scaleWidth: 512, scaleHeight: 512, format: 'png', quality: 90 },
  'mac-icon':     { scaleMode: 'dimensions', scaleWidth: 1024, scaleHeight: 1024, format: 'png', quality: 95 },
  'win-icon':     { scaleMode: 'dimensions', scaleWidth: 256, scaleHeight: 256, format: 'png', quality: 95 },
  'web-favicon':  { scaleMode: 'dimensions', scaleWidth: 32, scaleHeight: 32, format: 'png', quality: 95 },
  
  // Social Media
  'insta-post':   { scaleMode: 'dimensions', scaleWidth: 1080, scaleHeight: 1080, format: 'jpeg', quality: 85 },
  'insta-story':  { scaleMode: 'dimensions', scaleWidth: 1080, scaleHeight: 1920, format: 'jpeg', quality: 85 },
  'fb-post':      { scaleMode: 'dimensions', scaleWidth: 1200, scaleHeight: 630, format: 'jpeg', quality: 85 },
  'fb-cover':     { scaleMode: 'dimensions', scaleWidth: 820, scaleHeight: 312, format: 'jpeg', quality: 85 },
  'x-post':       { scaleMode: 'dimensions', scaleWidth: 1600, scaleHeight: 900, format: 'jpeg', quality: 85 },
  'x-header':     { scaleMode: 'dimensions', scaleWidth: 1500, scaleHeight: 500, format: 'jpeg', quality: 85 },
  'linkedin-post':{ scaleMode: 'dimensions', scaleWidth: 1200, scaleHeight: 627, format: 'jpeg', quality: 85 },

  // Web & SEO
  'webp-hero':    { scaleMode: 'dimensions', scaleWidth: 1920, scaleHeight: 1080, format: 'webp', quality: 80 },
  'webp-thumb':   { scaleMode: 'dimensions', scaleWidth: 300, scaleHeight: 300, format: 'webp', quality: 75 },
  'avif-mobile':  { scaleMode: 'dimensions', scaleWidth: 800, scaleHeight: 600, format: 'avif', quality: 65 },

  // Devices
  'hd-1080':      { scaleMode: 'dimensions', scaleWidth: 1920, scaleHeight: 1080, format: 'jpeg', quality: 90 },
  'uhd-4k':       { scaleMode: 'dimensions', scaleWidth: 3840, scaleHeight: 2160, format: 'jpeg', quality: 90 },
  'iphone-15':    { scaleMode: 'dimensions', scaleWidth: 1179, scaleHeight: 2556, format: 'jpeg', quality: 90 },

  // Print
  'print-4x6':    { scaleMode: 'dimensions', scaleWidth: 1800, scaleHeight: 1200, format: 'jpeg', quality: 95 },
  'print-5x7':    { scaleMode: 'dimensions', scaleWidth: 2100, scaleHeight: 1500, format: 'jpeg', quality: 95 },
  'a4-doc':       { scaleMode: 'dimensions', scaleWidth: 2480, scaleHeight: 3508, format: 'jpeg', quality: 95 },
};

presetSelect.addEventListener('change', () => {
  const preset = presets[presetSelect.value];
  if (!preset) return;
  scaleMode.value = preset.scaleMode;
  scaleMode.dispatchEvent(new Event('change'));
  if (preset.scaleMode === 'dimensions') {
    scaleWidth.value = preset.scaleWidth;
    scaleHeight.value = preset.scaleHeight;
  } else if (preset.scaleMode === 'percent') {
    scalePercent.value = preset.scalePercent || 100;
  }
  formatSelect.value = preset.format;
  qualitySlider.value = preset.quality;
  qualityValue.textContent = preset.quality;
});

window.api.onOpenFiles(async (filePaths) => {
  const files = filePaths.map(fp => ({
    path: fp,
    name: fp.split(/[\\/]/).pop(),
    size: 0
  }));
  addFiles(files);
});

// ─── Auto-updater ──────────────────────────────────────────────
const updateBar = document.getElementById('update-bar');
const updateMessage = document.getElementById('update-message');
const updateAction = document.getElementById('update-action');
const updateDismiss = document.getElementById('update-dismiss');

window.api.onUpdateChecking(() => {
  updateBar.classList.remove('hidden');
  updateMessage.textContent = 'Checking for updates...';
  updateAction.classList.add('hidden');
});

window.api.onUpdateAvailable((info) => {
  updateBar.classList.remove('hidden');
  updateMessage.textContent = `Update v${info.version} available`;
  updateAction.textContent = 'Download';
  updateAction.classList.remove('hidden');
  updateAction.disabled = false;
  updateAction.onclick = () => window.api.downloadUpdate();
});

window.api.onUpdateNotAvailable(() => {
  updateBar.classList.add('hidden');
});

window.api.onUpdateError(() => {
  updateBar.classList.add('hidden');
});

window.api.onUpdateDownloadProgress((data) => {
  updateBar.classList.remove('hidden');
  const pct = Math.round(data.percent);
  updateMessage.textContent = `Downloading update... ${pct}%`;
  updateAction.textContent = `${pct}%`;
  updateAction.disabled = true;
});

window.api.onUpdateDownloaded((info) => {
  updateBar.classList.remove('hidden');
  updateMessage.textContent = `Update v${info.version} ready to install`;
  updateAction.textContent = 'Install & Restart';
  updateAction.disabled = false;
  updateAction.onclick = () => window.api.installUpdate();
});

updateDismiss.addEventListener('click', () => {
  updateBar.classList.add('hidden');
});

window.api.checkForUpdates();

renderGrid();
