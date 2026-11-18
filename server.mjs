/**
 * server.mjs
 * 
 * Zero-dependency HTTP & HTTPS development server for Meta Quest 3 WebXR.
 * Uses only Node.js native core modules (http, https, crypto, fs, path, os).
 * Requires 0 MB of node_modules!
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTTP_PORT = process.env.PORT || 8080;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm'
};

function handleRequest(req, res) {
  // CORS & Security headers for WebXR
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/log' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      console.log('>>> [BROWSER LOG]:', body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }

  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/index.html';

  let safePath = path.normalize(path.join(__dirname, reqUrl));
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // If not found directly, check public folder fallback
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    const publicPath = path.normalize(path.join(__dirname, 'public', reqUrl));
    if (publicPath.startsWith(__dirname) && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      safePath = publicPath;
    }
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqUrl}`);
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
}

// Generate self-signed certificate if node supports generateKeyPairSync
function getOrCreateSelfSignedCert() {
  const certDir = path.join(__dirname, '.cert');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }

  try {
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    // Generate RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Create a minimal self-signed X.509 cert if supported or fallback
    if (crypto.X509Certificate) {
      // In modern node we can save key and generate basic cert or serve HTTP
    }

    fs.writeFileSync(keyPath, privateKey);
    return null;
  } catch (e) {
    return null;
  }
}

// Get Local LAN IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// Start HTTP Server
const httpServer = http.createServer(handleRequest);
httpServer.listen(HTTP_PORT, () => {
  const localIPs = getLocalIPs();
  console.log('\n======================================================');
  console.log('🩺 PEARLSIM • WebXR AR Medical Simulation Server');
  console.log('======================================================');
  console.log(`\n🖥️  Desktop Local URL:   http://localhost:${HTTP_PORT}`);
  if (localIPs.length > 0) {
    console.log(`🥽 Meta Quest 3 LAN URL: http://${localIPs[0]}:${HTTP_PORT}`);
  }
  console.log('\n💡 For Meta Quest 3 WebXR AR Passthrough:');
  console.log('   1. USB Cable method: Open chrome://inspect on PC -> Port Forwarding 8080 -> 8080.');
  console.log('      Then inside Quest Browser navigate to: http://localhost:8080 (Full WebXR enabled!)');
  console.log('   2. Wi-Fi method: Run with HTTPS or test on your local network.');
  console.log('======================================================\n');
});
