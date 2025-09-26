const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const port = process.env.PORT || 8080;

// Create an HTTP server
const server = http.createServer((req, res) => {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
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
                const receivedData = JSON.parse(body);
                console.log('[Server] Raw received data:', JSON.stringify(receivedData, null, 2));
                
                // Extract vehicles array and create individual messages
                if (receivedData.vehicles && Array.isArray(receivedData.vehicles)) {
                    console.log(`[Server] Processing ${receivedData.vehicles.length} vehicles`);
                    
                    let sentMessages = 0;
                    receivedData.vehicles.forEach((vehicle, index) => {
                        const message = {
                            timestamp: receivedData.timestamp,
                            vehicle_id: vehicle.vehicle_id,
                            speed: parseFloat(vehicle.speed) || 0,
                            fuel_consumption: parseFloat(vehicle.fuel_consumption) || 0,
                            co2_emission: parseFloat(vehicle.co2_emission) || 0,
                            platooning_status: vehicle.platooning_status ? 'on' : 'off',
                            platoon_size: parseInt(vehicle.platoon_size) || 1,
                            acceleration: parseFloat(vehicle.acceleration) || 0,
                            distance_to_leader: parseFloat(vehicle.distance_to_leader) || 0,
                            efficiency_score: parseFloat(vehicle.efficiency_score) || 0,
                            current_lane: parseInt(vehicle.current_lane) || 0
                        };
                        
                        console.log(`[Server] Vehicle ${index + 1} processed:`, JSON.stringify(message, null, 2));
                        
                        // Broadcast each vehicle's data to all connected dashboard clients
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(message));
                                sentMessages++;
                            }
                        });
                    });
                    
                    console.log(`[Server] Sent ${sentMessages} messages to ${wss.clients.size} connected clients`);
                } else {
                    console.log('[Server] Invalid data format - no vehicles array found');
                    console.log('[Server] Received keys:', Object.keys(receivedData));
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success', 
                    received_vehicles: receivedData.vehicles ? receivedData.vehicles.length : 0,
                    connected_clients: wss.clients.size
                }));
            } catch (e) {
                console.error("[Server] Error parsing incoming data:", e);
                console.error("[Server] Raw body was:", body);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
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

wss.on('connection', ws => {
    console.log(`[Server] Dashboard client connected. Total clients: ${wss.clients.size}`);
    
    // Send a welcome message to test the connection
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Vehicle Platooning Server',
        timestamp: new Date().toISOString(),
        server_status: 'ready'
    }));
    
    ws.on('close', () => {
        console.log(`[Server] Dashboard client disconnected. Remaining clients: ${wss.clients.size - 1}`);
    });
    
    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

server.listen(port, () => {
    console.log(`[Server] HTTP and WebSocket server started on port ${port}`);
    console.log(`[Server] WebSocket URL: ws://localhost:${port} (or wss:// for production)`);
    console.log(`[Server] Waiting for CARLA data at POST /data`);
});

