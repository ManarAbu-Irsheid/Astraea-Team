/**
 * Astraea - Mission Server & Backend API
 * Handles:
 * - REST API for Authentication (Login, Register, Logout, Me)
 * - Persistent Dataset for User Accounts, Levels, Research Findings, XP & Progress
 * - Atomic JSON Database Storage in data/users_dataset.json
 * - Static Web Asset Serving with Content Security & MIME Routing
 * - Landing routing: `/` routes to `/start.html` (Planetary Mission Clearance Start Screen)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const DB_FILE = path.join(BASE_DIR, 'data', 'users_dataset.json');

// Level brackets standard definition
const LEVELS = [
  { level: 1, minXp: 0, maxXp: 150, titleEn: 'Cadet Explorer', titleAr: 'باحث مستجد' },
  { level: 2, minXp: 151, maxXp: 350, titleEn: 'Planetary Surveyor', titleAr: 'مسّاح كوكبي' },
  { level: 3, minXp: 351, maxXp: 650, titleEn: 'Analog Specialist', titleAr: 'اختصاصي مواقع شبيهة' },
  { level: 4, minXp: 651, maxXp: 1050, titleEn: 'Mission Commander', titleAr: 'قائد استكشاف فضائي' },
  { level: 5, minXp: 1051, maxXp: 99999, titleEn: 'Chief Astrobiologist', titleAr: 'كبير علماء الكواكب' }
];

function calculateLevel(xp) {
  const currentXp = Number(xp) || 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (currentXp >= LEVELS[i].minXp) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Database Management Helpers
function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { version: '1.0.0', lastUpdated: new Date().toISOString(), users: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading database:', err);
    return { version: '1.0.0', lastUpdated: new Date().toISOString(), users: [] };
  }
}

function saveDatabase(db) {
  try {
    db.lastUpdated = new Date().toISOString();
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error saving database:', err);
    return false;
  }
}

// Password & Token Cryptography
function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(String(password) + salt).digest('hex');
}

function generateToken() {
  return 'ast_' + crypto.randomBytes(32).toString('hex');
}

function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.passwordHash;
  delete safe.salt;
  delete safe.resetCode;
  delete safe.resetCodeExpiresAt;
  return safe;
}

// Request Body Parser Helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', err => reject(err));
  });
}

// Helper to extract authenticated user
function getAuthenticatedUser(req, db) {
  const authHeader = req.headers['authorization'] || '';
  const customHeader = req.headers['x-auth-token'] || '';
  const parsedUrl = url.parse(req.url, true);
  const queryToken = parsedUrl.query ? parsedUrl.query.token : '';

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (customHeader) {
    token = customHeader.trim();
  } else if (queryToken) {
    token = String(queryToken).trim();
  }

  if (!token) return null;

  const found = db.users.find(u => u.sessionToken === token);
  return found || null;
}

// Send Standard JSON Response
function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(payload);
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURI(parsedUrl.pathname);

  // =========================================================================
  // API ROUTING: /api/...
  // =========================================================================
  if (pathname.startsWith('/api/')) {
    const db = loadDatabase();

    // 1. POST /api/auth/register
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      try {
        const data = await parseJsonBody(req);
        const email = (data.email || '').trim().toLowerCase();
        const password = String(data.password || '');
        const name = (data.name || '').trim();

        if (!email || !password || !name) {
          sendJson(res, 400, { success: false, message: 'Missing required fields: email, password, name.' });
          return;
        }

        if (password.length < 4) {
          sendJson(res, 400, { success: false, message: 'Password must be at least 4 characters.' });
          return;
        }

        const existing = db.users.find(u => u.email.toLowerCase() === email);
        if (existing) {
          sendJson(res, 409, { success: false, message: 'This email is already registered. Please sign in.' });
          return;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const token = generateToken();
        const initialXp = 200;
        const initialLvl = calculateLevel(initialXp);

        const newUser = {
          id: 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
          email,
          name,
          nameAr: data.nameAr || name,
          phone: data.phone || '',
          passwordHash,
          salt,
          avatar: data.avatar || '👩‍🚀',
          gender: data.gender || 'female',
          role: data.role || 'Planetary Analog Researcher',
          roleAr: data.roleAr || 'باحث في النظائر الكوكبية',
          bio: data.bio || 'Scientific researcher contributing to Astraea planetary analog matching.',
          xp: initialXp,
          level: initialLvl,
          visitedPages: ['home'],
          discoveredSites: ['atacama_yungay', 'antarctica_dryvalleys'],
          searchesCount: 0,
          comparisonsCount: 0,
          researchFindings: [
            {
              id: 'rf_' + Date.now(),
              siteId: 'atacama_yungay',
              siteName: 'Atacama Yungay Basin',
              siteNameAr: 'حوض يونغاي - صحراء أتاكاما',
              target: 'Jezero Crater Delta (Mars)',
              targetAr: 'دلتا فوهة جيزيرو (المريخ)',
              similarity: 91.2,
              date: new Date().toISOString(),
              notes: 'Initial mission briefing discovery.'
            }
          ],
          sessionToken: token,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        db.users.push(newUser);
        saveDatabase(db);

        sendJson(res, 201, {
          success: true,
          message: 'Account successfully registered and clearance granted.',
          token,
          user: sanitizeUser(newUser)
        });
        return;
      } catch (err) {
        sendJson(res, 500, { success: false, message: 'Registration failed: ' + err.message });
        return;
      }
    }

    // 2. POST /api/auth/login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const data = await parseJsonBody(req);
        const email = (data.email || '').trim().toLowerCase();
        const password = String(data.password || '');
        const isDemo = !!data.isDemo;

        let user = db.users.find(u => u.email.toLowerCase() === email);

        if (isDemo && !user) {
          user = db.users.find(u => u.email.toLowerCase() === 'researcher@terratwin.space') || db.users[0];
        }

        if (!user) {
          sendJson(res, 401, { success: false, message: 'Invalid credentials. User not found.' });
          return;
        }

        const matchHash = hashPassword(password, user.salt);
        const isDemoAccount = isDemo && user.email.toLowerCase() === 'researcher@terratwin.space';
        const isValid = isDemoAccount || matchHash === user.passwordHash;

        if (!isValid) {
          sendJson(res, 401, { success: false, message: 'Invalid email or password.' });
          return;
        }

        const token = generateToken();
        user.sessionToken = token;
        user.lastLoginAt = new Date().toISOString();
        user.updatedAt = new Date().toISOString();
        
        // Add daily login XP bonus
        user.xp = (user.xp || 0) + 20;
        user.level = calculateLevel(user.xp);

        saveDatabase(db);

        sendJson(res, 200, {
          success: true,
          message: 'Clearance verified. Welcome to Astraea Platform.',
          token,
          user: sanitizeUser(user)
        });
        return;
      } catch (err) {
        sendJson(res, 500, { success: false, message: 'Authentication error: ' + err.message });
        return;
      }
    }

    // 3. GET /api/auth/me
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const user = getAuthenticatedUser(req, db);
      if (!user) {
        sendJson(res, 401, { success: false, message: 'Session expired or unauthenticated.' });
        return;
      }
      sendJson(res, 200, {
        success: true,
        user: sanitizeUser(user)
      });
      return;
    }

    // 4. POST /api/auth/logout
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const user = getAuthenticatedUser(req, db);
      if (user) {
        user.sessionToken = null;
        user.updatedAt = new Date().toISOString();
        saveDatabase(db);
      }
      sendJson(res, 200, { success: true, message: 'Logged out successfully.' });
      return;
    }

    // 4b. POST /api/auth/forgot-password (Generates 6-digit email reset code)
    if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
      try {
        const data = await parseJsonBody(req);
        const email = (data.email || '').trim().toLowerCase();
        if (!email) {
          sendJson(res, 400, { success: false, message: 'Email address is required.' });
          return;
        }

        const user = db.users.find(u => u.email.toLowerCase() === email);
        if (!user) {
          sendJson(res, 404, { success: false, message: 'No account found with this email address.' });
          return;
        }

        const resetCode = String(crypto.randomInt(100000, 999999));
        user.resetCode = resetCode;
        user.resetCodeExpiresAt = Date.now() + 15 * 60 * 1000;
        user.updatedAt = new Date().toISOString();
        saveDatabase(db);

        sendJson(res, 200, {
          success: true,
          message: 'Verification code generated for your email.',
          email: user.email,
          expiresInMinutes: 15,
          previewCode: resetCode
        });
        return;
      } catch (err) {
        sendJson(res, 500, { success: false, message: 'Password reset request failed: ' + err.message });
        return;
      }
    }

    // 4c. POST /api/auth/reset-password (Verifies code and updates password)
    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      try {
        const data = await parseJsonBody(req);
        const email = (data.email || '').trim().toLowerCase();
        const code = String(data.code || '').trim();
        const newPassword = String(data.newPassword || '');

        if (!email || !code || !newPassword) {
          sendJson(res, 400, { success: false, message: 'Email, verification code, and new password are required.' });
          return;
        }

        if (newPassword.length < 5) {
          sendJson(res, 400, { success: false, message: 'New password must be at least 5 characters.' });
          return;
        }

        const user = db.users.find(u => u.email.toLowerCase() === email);
        if (!user || !user.resetCode) {
          sendJson(res, 400, { success: false, message: 'Invalid or missing password reset request.' });
          return;
        }

        if (Date.now() > Number(user.resetCodeExpiresAt || 0)) {
          delete user.resetCode;
          delete user.resetCodeExpiresAt;
          saveDatabase(db);
          sendJson(res, 400, { success: false, message: 'Verification code has expired. Please request a new one.' });
          return;
        }

        if (user.resetCode !== code) {
          sendJson(res, 400, { success: false, message: 'Invalid verification code.' });
          return;
        }

        user.salt = crypto.randomBytes(16).toString('hex');
        user.passwordHash = hashPassword(newPassword, user.salt);
        delete user.resetCode;
        delete user.resetCodeExpiresAt;
        user.updatedAt = new Date().toISOString();
        saveDatabase(db);

        sendJson(res, 200, {
          success: true,
          message: 'Password updated successfully. You can now sign in with your new password.'
        });
        return;
      } catch (err) {
        sendJson(res, 500, { success: false, message: 'Password reset failed: ' + err.message });
        return;
      }
    }

    // 5. PUT /api/user/profile
    if (pathname === '/api/user/profile' && (req.method === 'PUT' || req.method === 'POST')) {
      const user = getAuthenticatedUser(req, db);
      if (!user) {
        sendJson(res, 401, { success: false, message: 'Authentication required to update profile.' });
        return;
      }

      try {
        const data = await parseJsonBody(req);
        if (data.email !== undefined) {
          const nextEmail = String(data.email).trim().toLowerCase();
          if (!nextEmail) {
            sendJson(res, 400, { success: false, message: 'Email cannot be empty.' });
            return;
          }
          const collision = db.users.find(u => u.id !== user.id && u.email.toLowerCase() === nextEmail);
          if (collision) {
            sendJson(res, 409, { success: false, message: 'This email is already in use by another account.' });
            return;
          }
          user.email = nextEmail;
        }
        if (data.name) user.name = data.name.trim();
        if (data.nameAr) user.nameAr = data.nameAr.trim();
        if (data.phone !== undefined) user.phone = String(data.phone).trim();
        if (data.avatar) user.avatar = data.avatar;
        if (data.gender) user.gender = data.gender;
        if (data.role) user.role = data.role.trim();
        if (data.roleAr) user.roleAr = data.roleAr.trim();
        if (data.bio) user.bio = data.bio.trim();

        if (data.password && String(data.password).length >= 4) {
          user.salt = crypto.randomBytes(16).toString('hex');
          user.passwordHash = hashPassword(data.password, user.salt);
        }

        user.updatedAt = new Date().toISOString();
        saveDatabase(db);

        sendJson(res, 200, {
          success: true,
          message: 'Profile updated successfully.',
          user: sanitizeUser(user)
        });
        return;
      } catch (err) {
        sendJson(res, 500, { success: false, message: 'Update failed: ' + err.message });
        return;
      }
    }

    // 6. POST /api/user/progress (Syncs level, XP, visitedPages, counts)
    if (pathname === '/api/user/progress' && req.method === 'POST') {
      const user = getAuthenticatedUser(req, db);
      if (!user) {
        sendJson(res, 401, { success: false, message: 'Authentication required to sync research progress.' });
        return;
      }

      try {
        const data = await parseJsonBody(req);

        if (typeof data.xp === 'number' && data.xp >= 0) {
          user.xp = data.xp;
        }
        user.level = calculateLevel(user.xp);

        if (Array.isArray(data.visitedPages)) {
          const set = new Set([...user.visitedPages, ...data.visitedPages]);
          user.visitedPages = Array.from(set);
        }

        if (Array.isArray(data.discoveredSites)) {
          const set = new Set([...user.discoveredSites, ...data.discoveredSites]);
          user.discoveredSites = Array.from(set);
        }

        if (typeof data.searchesCount === 'number') {
          user.searchesCount = Math.max(user.searchesCount || 0, data.searchesCount);
        }

        if (typeof data.comparisonsCount === 'number') {
          user.comparisonsCount = Math.max(user.comparisonsCount || 0, data.comparisonsCount);
        }

        user.updatedAt = new Date().toISOString();
        saveDatabase(db);

        sendJson(res, 200, {
          success: true,
          message: 'Progress and research level saved.',
          user: sanitizeUser(user)
        });
        return;
      } catch (err) {
        sendJson(res, 500, { success: false, message: 'Sync failed: ' + err.message });
        return;
      }
    }

    // 7. POST /api/user/discover-site (Records new analog site and finding)
    if (pathname === '/api/user/discover-site' && req.method === 'POST') {
      const user = getAuthenticatedUser(req, db);
      if (!user) {
        sendJson(res, 401, { success: false, message: 'Authentication required.' });
        return;
      }

      try {
        const data = await parseJsonBody(req);
        const siteId = data.siteId;
        const siteName = data.siteName || siteId;
        const target = data.target || 'General Planetary Target';
        const similarity = Number(data.similarity) || 85.0;

        if (!siteId) {
          sendJson(res, 400, { success: false, message: 'siteId is required.' });
          return;
        }

        if (!user.discoveredSites.includes(siteId)) {
          user.discoveredSites.push(siteId);
          user.xp = (user.xp || 0) + 35;
          user.level = calculateLevel(user.xp);

          if (!Array.isArray(user.researchFindings)) {
            user.researchFindings = [];
          }

          user.researchFindings.push({
            id: 'rf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            siteId,
            siteName,
            siteNameAr: data.siteNameAr || siteName,
            target,
            targetAr: data.targetAr || target,
            similarity,
            date: new Date().toISOString(),
            notes: data.notes || 'Discovered during active mission exploration.'
          });

          user.updatedAt = new Date().toISOString();
          saveDatabase(db);
        }

        sendJson(res, 200, {
          success: true,
          message: `Discovered analog site: ${siteName}`,
          user: sanitizeUser(user)
        });
        return;
      } catch (err) {
        sendJson(res, 500, { success: false, message: 'Discovery record failed: ' + err.message });
        return;
      }
    }

    // 8. GET /api/user/findings (Retrieve researcher findings list)
    if (pathname === '/api/user/findings' && req.method === 'GET') {
      const user = getAuthenticatedUser(req, db);
      if (!user) {
        sendJson(res, 401, { success: false, message: 'Authentication required.' });
        return;
      }
      sendJson(res, 200, {
        success: true,
        findings: user.researchFindings || [],
        discoveredSites: user.discoveredSites || [],
        level: user.level,
        xp: user.xp
      });
      return;
    }

    // 9. GET /api/dataset/summary (Public stats overview)
    if (pathname === '/api/dataset/summary' && req.method === 'GET') {
      sendJson(res, 200, {
        success: true,
        totalRegisteredUsers: db.users.length,
        totalAnalogCandidates: 421800,
        knownRecallRate: '94.2%',
        validatedCandidates: 38,
        activeMission: 'Astraea-TerraTwin TASI Exploration',
        serverTimestamp: new Date().toISOString()
      });
      return;
    }

    // Unknown API Route
    sendJson(res, 404, { success: false, message: 'API Endpoint not found.' });
    return;
  }

  // =========================================================================
  // STATIC FILE SERVING
  // =========================================================================
  let reqPath = pathname;

  // Direct root requests `/` to the Start Landing Experience
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/start.html';
  }

  let filePath = path.join(BASE_DIR, reqPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback: if user asked for an html route without extension
      const fallbackHtml = filePath + '.html';
      if (fs.existsSync(fallbackHtml)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(fallbackHtml).pipe(res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🌌 Astraea Planetary Analog Intelligence Server Active`);
  console.log(`📡 URL: http://localhost:${PORT}/`);
  console.log(`🚀 Start Page: http://localhost:${PORT}/start.html`);
  console.log(`🪐 Home / 3D Observatory: http://localhost:${PORT}/index.html`);
  console.log(`🔐 Sign In / Register: http://localhost:${PORT}/login.html`);
  console.log(`🤖 Mission Guide: http://localhost:${PORT}/guide.html`);
  console.log(`💾 Dataset: ${DB_FILE}`);
  console.log(`=======================================================`);
});
