const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const port = process.env.PORT || 8080;

// Add CORS headers for development
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

// Create an HTTP server
const server = http.createServer((req, res) => {
    // Add CORS headers to all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // --- Data Endpoint for CARLA ---
    if (req.method === 'POST' && req.url === '/data') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                console.log('[Server] Received data request');
                const data = JSON.parse(body);
                
                if (!data.vehicles || !Array.isArray(data.vehicles)) {
                    throw new Error('Invalid data format: missing vehicles array');
                }
                
                console.log(`[Server] Processing ${data.vehicles.length} vehicles`);
                
                // Broadcast to all connected WebSocket clients
                const message = JSON.stringify({
                    type: 'vehicleData',
                    timestamp: data.timestamp,
                    vehicles: data.vehicles
                });
                
                let clientCount = 0;
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(message);
                        clientCount++;
                    }
                });
                
                console.log(`[Server] Data broadcast to ${clientCount} clients`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success',
                    clientCount,
                    vehicleCount: data.vehicles.length 
                }));
            } catch (error) {
                console.error('[Server] Error processing data:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'error', 
                    message: error.message 
                }));
            }
        });
        return;
    }

    // --- Static File Serving for Frontend ---
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    let extname = String(path.extname(filePath)).toLowerCase();
    let mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
    };

    let contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Attach the WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

// Modify WebSocket server setup
wss.on('connection', ws => {
    console.log(`[Server] New WebSocket connection. Total clients: ${wss.clients.size}`);
    
    // Send immediate confirmation
    ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString()
    }));
    
    ws.on('error', error => {
        console.error('[Server] WebSocket error:', error);
    });
    
    ws.on('close', () => {
        console.log(`[Server] Client disconnected. Remaining: ${wss.clients.size}`);
    });
});

// Add error handler for the server
server.on('error', (error) => {
    console.error('[Server] HTTP server error:', error);
});

server.listen(port, () => {
    console.log(`[Server] HTTP and WebSocket server started on port ${port}`);
    console.log(`[Server] WebSocket URL: ws://localhost:${port} (or wss:// for production)`);
    console.log(`[Server] Waiting for CARLA data at POST /data`);
    console.log(`[Server] Dashboard URL: ${port === 8080 ? 'http://localhost:8080' : 'https://your-app-url.onrender.com'}`);
});
            const testData = {
                timestamp: new Date().toISOString(),
                vehicle_id: `test_${Math.floor(Math.random() * 100)}`,
                speed: 45 + Math.random() * 30,
                fuel_consumption: 6 + Math.random() * 4,
                co2_emission: 150 + Math.random() * 100,
                platooning_status: Math.random() > 0.5 ? 'on' : 'off',
                platoon_size: Math.floor(Math.random() * 5) + 1,
                acceleration: (Math.random() - 0.5) * 2,
                distance_to_leader: Math.random() * 20,
                efficiency_score: 50 + Math.random() * 50,
                current_lane: Math.floor(Math.random() * 3) + 1
            };
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(testData));
                }
            });
            console.log('[Server] Sent test data to clients');
        }, 3000); // Every 3 seconds
    }
    
    ws.on('close', () => {
        console.log(`[Server] Dashboard client disconnected. Remaining clients: ${wss.clients.size - 1}`);
        
        // Stop test data if no clients connected
        if (wss.clients.size === 0 && testDataInterval) {
            clearInterval(testDataInterval);
            testDataInterval = null;
            console.log('[Server] Stopped test data heartbeat');
        }
    });
    
    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

server.listen(port, () => {
    console.log(`[Server] HTTP and WebSocket server started on port ${port}`);
    console.log(`[Server] WebSocket URL: ws://localhost:${port} (or wss:// for production)`);
    console.log(`[Server] Waiting for CARLA data at POST /data`);
    console.log(`[Server] Dashboard URL: ${port === 8080 ? 'http://localhost:8080' : 'https://your-app-url.onrender.com'}`);
});

