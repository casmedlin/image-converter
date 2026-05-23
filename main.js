const { app, BrowserWindow, ipcMain, dialog, nativeTheme, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const sharp = require('sharp');

// ─── Electron runtime optimizations ───────────────────────────
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('js-flags', '--max_old_space_size=512 --optimize_for_size');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'UseSkiaRenderer');
}

// ─── Sharp global optimizations ────────────────────────────────
sharp.cache({ files: 0, items: 0 });
try { sharp.concurrency(Math.max(1, require('os').cpus().length - 1)); } catch {}

let mainWindow;

let filesToOpen = [];
app.on('open-file', (event, fp) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('open-files', [fp]);
  } else {
    filesToOpen.push(fp);
  }
});

function createWindow() {
  const isMac = process.platform === 'darwin';

const imageExtensions = [
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'heic', 'heif', 'tiff', 'tif', 'gif',
  'arw', 'srf', 'sr2', 'cr2', 'cr3', 'crw', 'nef', 'nrw', 'raf', 'rw2', 'orf',
  'pef', 'dng', 'x3f', '3fr', 'rwl', 'iiq', 'mrw', 'raw', 'bay'
];
  const isDark = nativeTheme.shouldUseDarkColors;

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 680,
    minHeight: 480,
    title: 'Image Converter & Optimizer',
    backgroundColor: '#0f0f13',
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    titleBarOverlay: isMac ? false : {
      color: '#1a1a22',
      symbolColor: '#8e8ea0',
      height: 34,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      disableBlinkFeatures: 'Accelerated2dCanvas,AudioVideoTracks,CSSScrollTopBeforeAfter',
      enableBlinkFeatures: 'CSSColorSchemeUARendering,OverlayScrollbars',
      v8CacheOptions: 'code',
    },
    vibrancy: isMac ? 'under-window' : undefined,
  });

  mainWindow.setTitle('Image Converter & Optimizer');

  if (isMac && systemPreferences?.setAppearance) {
    systemPreferences.setAppearance(isDark ? 'dark' : 'light');
  }

  // Fade in instead of flash white
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (filesToOpen.length > 0) {
      mainWindow.webContents.send('open-files', filesToOpen);
      filesToOpen = [];
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

const iconPath = path.join(__dirname, 'build-icon.png');
app.whenReady().then(() => {
  if (isMac) {
    app.dock.setIcon(iconPath);
  }
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Platform helpers ──────────────────────────────────────────
const isMac = process.platform === 'darwin';

const imageExtensions = [
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'heic', 'heif', 'tiff', 'tif', 'gif',
  'arw', 'srf', 'sr2', 'cr2', 'cr3', 'crw', 'nef', 'nrw', 'raf', 'rw2', 'orf',
  'pef', 'dng', 'x3f', '3fr', 'rwl', 'iiq', 'mrw', 'raw', 'bay'
];

function tmpDir() {
  return fs.mkdtempSync(path.join(app.getPath('temp'), 'imgconv-'));
}

function execFileAsync(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs || 30000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

const nonStandardExts = new Set([
  '.heic', '.heif', '.heics', '.avci', '.avcs',
  '.arw', '.srf', '.sr2', '.cr2', '.cr3', '.crw',
  '.nef', '.nrw', '.raf', '.rw2', '.orf', '.pef',
  '.dng', '.x3f', '.3fr', '.rwl', '.iiq', '.mrw', '.raw', '.bay',
  '.svg',
]);

function requiresExternalDecode(ext) { return nonStandardExts.has(ext) && ext !== '.svg'; }

// ─── Placeholder thumbnail ─────────────────────────────────────
async function placeholderThumbnail(_filePath, ext) {
  const label = ext.replace('.', '').toUpperCase();
  const svg = `<svg width="280" height="280" xmlns="http://www.w3.org/2000/svg">
    <rect width="280" height="280" rx="8" fill="#1a1a22" stroke="#2a2a35" stroke-width="1"/>
    <text x="140" y="140" text-anchor="middle" dominant-baseline="central"
      font-family="-apple-system,sans-serif" font-size="48" font-weight="700" fill="#5555ff" opacity="0.6">${label}</text>
    <text x="140" y="200" text-anchor="middle" dominant-baseline="central"
      font-family="-apple-system,sans-serif" font-size="14" fill="#5e5e70">preview</text>
  </svg>`;
  try {
    const buf = await sharp(Buffer.from(svg)).resize(280, 280).png().toBuffer();
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return null; }
}

// ─── macOS sips thumbnail ──────────────────────────────────────
async function thumbnailSips(filePath) {
  const dir = tmpDir();
  const thumbPath = path.join(dir, 'thumb.png');
  try {
    await execFileAsync('sips', ['-Z', '280', filePath, '--out', thumbPath], 15000);
    if (!fs.existsSync(thumbPath)) return null;
    const meta = await sharp(thumbPath).metadata();
    const pipeline = sharp(thumbPath);
    if (meta.hasAlpha) pipeline.flatten({ background: { r: 0, g: 0, b: 0 } });
    const buf = await pipeline.png().toBuffer();
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return null; }
  finally { try { fs.rmSync(dir, { recursive: true }); } catch {} }
}

// ─── Sharp thumbnail ───────────────────────────────────────────
async function thumbnailSharp(filePath) {
  try {
    const buf = await sharp(filePath)
      .resize(280, 280, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: { r: 0, g: 0, b: 0 } }).png().toBuffer();
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return null; }
}

async function generateThumbnail(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (isMac) { const r = await thumbnailSips(filePath); if (r) return r; }
  else if (!requiresExternalDecode(ext)) { const r = await thumbnailSharp(filePath); if (r) return r; }
  return placeholderThumbnail(filePath, ext);
}

// ─── Metadata ──────────────────────────────────────────────────
async function getFileMetadata(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    const size = fs.statSync(filePath).size;
    if (isMac) {
      const out = await execFileAsync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], 10000);
      return {
        width: parseInt(out.match(/pixelWidth: (\d+)/)?.[1] || '0'),
        height: parseInt(out.match(/pixelHeight: (\d+)/)?.[1] || '0'),
        size, format: ext.replace('.', ''),
      };
    }
    if (!requiresExternalDecode(ext)) {
      const meta = await sharp(filePath).metadata();
      return { ...meta, size };
    }
    return { width: 0, height: 0, size, format: ext.replace('.', '') };
  } catch { return null; }
}

// ─── Compute output dimensions ─────────────────────────────────
function computeTargetSize(origW, origH, settings) {
  if (settings.scaleMode === 'percent') {
    const f = settings.scalePercent / 100;
    return { w: Math.round(origW * f), h: Math.round(origH * f) };
  }
  if (settings.scaleMode === 'dimensions') {
    return { w: settings.scaleWidth || origW, h: settings.scaleHeight || origH };
  }
  return { w: origW, h: origH };
}

// ─── Sharp processing (universal, primary on Linux/Windows) ────
async function processSharp(imgPath, outPath, settings, ext) {
  let sourcePath = imgPath;
  let cleanup = null;
  if (requiresExternalDecode(ext)) {
    if (isMac) {
      const dir = tmpDir(); const p = path.join(dir, 'decoded.png');
      await execFileAsync('sips', ['-s', 'format', 'png', imgPath, '--out', p], 60000);
      sourcePath = p; cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
    } else {
      throw new Error('RAW/HEIC requires macOS, or install dcraw/ffmpeg');
    }
  }
  try {
    let p = sharp(sourcePath);
    const meta = await p.metadata();
    const target = computeTargetSize(meta.width, meta.height, settings);
    if (target.w !== meta.width || target.h !== meta.height) {
      p = p.resize(target.w, target.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    const fmt = settings.format === 'original' ? ext.replace('.', '') : settings.format;
    const fm = { jpeg: 'jpeg', jpg: 'jpeg', png: 'png', webp: 'webp', avif: 'avif', tiff: 'tiff', tif: 'tiff', gif: 'gif' };
    const tf = fm[fmt] || 'jpeg';
    const opts = {};
    if (tf === 'jpeg') { opts.quality = settings.quality; opts.mozjpeg = true; }
    else if (tf === 'png') { opts.quality = settings.quality; opts.compressionLevel = 9; }
    else if (tf === 'webp') { opts.quality = settings.quality; }
    else if (tf === 'avif') { opts.quality = settings.quality; }
    else if (tf === 'tiff') { opts.quality = settings.quality; }
    if (settings.keepMetadata) p = p.withMetadata();
    await p[tf](opts).toFile(outPath);
    const outMeta = await sharp(outPath).metadata();
    return { outputWidth: outMeta.width, outputHeight: outMeta.height, outputSize: fs.statSync(outPath).size };
  } finally { if (cleanup) cleanup(); }
}

// ─── HEIC output ───────────────────────────────────────────────
async function processHeicOutput(imgPath, outPath, settings, ext) {
  const dir = tmpDir();
  const pngPath = path.join(dir, 'temp.png');
  try {
    const r = await processSharp(imgPath, pngPath, { ...settings, format: 'png' }, ext);
    if (isMac) {
      await execFileAsync('sips', ['-s', 'format', 'heic', '-s', 'formatOptions', String(settings.quality), pngPath, '--out', outPath], 30000);
    } else {
      const ff = require('child_process').execSync('which ffmpeg 2>/dev/null').toString().trim();
      if (!ff) throw new Error('Install ffmpeg for HEIC output');
      await execFileAsync(ff, ['-y', '-i', pngPath, '-q:v', String(Math.round(settings.quality / 100 * 31)), '-frames:v', '1', outPath], 30000);
    }
    return { outputWidth: r.outputWidth, outputHeight: r.outputHeight, outputSize: fs.statSync(outPath).size };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

async function syncCreationDate(sourcePath, targetPath) {
  try {
    const stats = fs.statSync(sourcePath);
    const btime = stats.birthtime;
    if (!btime || isNaN(btime.getTime())) return;

    if (process.platform === 'darwin') {
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${pad(btime.getMonth() + 1)}/${pad(btime.getDate())}/${btime.getFullYear()} ${pad(btime.getHours())}:${pad(btime.getMinutes())}:${pad(btime.getSeconds())}`;
      await execFileAsync('SetFile', ['-d', dateStr, targetPath], 5000);
    } else if (process.platform === 'win32') {
      const dateStr = btime.toISOString().replace('T', ' ').split('.')[0];
      const cmd = `(Get-Item '${targetPath}').CreationTime = '${dateStr}'`;
      await execFileAsync('powershell.exe', ['-Command', cmd], 5000);
    }
  } catch {}
}

// ─── Process one image ─────────────────────────────────────────
async function processOneImage(img, settings) {
  const ext = path.extname(img.path).toLowerCase();
  try {
    const meta = await getFileMetadata(img.path);
    const ow = meta?.width || 0, oh = meta?.height || 0;
    const of = settings.format === 'original' ? ext.replace('.', '') : settings.format;
    const oe = (of === 'jpeg' || of === 'jpg') ? 'jpg' : of;
    const fullName = path.basename(img.path);
    const lastDot = fullName.lastIndexOf('.');
    const bn = lastDot > 0 ? fullName.substring(0, lastDot) : fullName;
    const od = settings.outputDir || path.dirname(img.path);
    let on = `${bn}.${oe}`, op = path.join(od, on);
    for (let c = 1; fs.existsSync(op); c++) { on = `${bn}_${c}.${oe}`; op = path.join(od, on); }

    let result;
    if (of === 'heic' || of === 'heif') result = await processHeicOutput(img.path, op, settings, ext);
    else result = await processSharp(img.path, op, settings, ext);

    await syncCreationDate(img.path, op);

    return { success: true, inputName: path.basename(img.path), outputName: on, inputSize: img.size || 0, outputSize: result.outputSize, inputWidth: ow, inputHeight: oh, outputWidth: result.outputWidth, outputHeight: result.outputHeight };
  } catch (err) {
    return { success: false, inputName: path.basename(img.path), error: err.message };
  }
}

// ─── IPC handlers ──────────────────────────────────────────────
ipcMain.handle('select-output-dir', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('select-files', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: imageExtensions }
    ]
  });
  if (r.canceled) return [];
  return r.filePaths.map(fp => {
    const s = fs.statSync(fp);
    return { path: fp, name: path.basename(fp), size: s.size };
  });
});

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-metadata', async (_e, fp) => getFileMetadata(fp));
ipcMain.handle('generate-thumbnail', async (_e, fp) => generateThumbnail(fp));

ipcMain.handle('open-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return [];
  const root = r.filePaths[0];
  const results = [];
  const ve = new Set(imageExtensions.map(e => '.' + e));
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) { walk(fp); continue; }
      if (!ve.has(path.extname(e.name).toLowerCase())) continue;
      try { const s = fs.statSync(fp); results.push({ path: fp, name: e.name, size: s.size }); } catch {}
    }
  })(root);
  return results;
});

ipcMain.handle('process-images', async (event, { images, settings }) => {
  const results = [];
  for (let i = 0; i < images.length; i++) {
    const result = await processOneImage(images[i], settings);
    results.push(result);
    event.sender.send('image-progress', { current: i + 1, total: images.length, name: result.inputName, outputName: result.success ? result.outputName : null, success: result.success, error: result.error });
  }
  return results;
});
