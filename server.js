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
                console.log('[Server] Received data from simulation:', receivedData);
                
                // Extract vehicles array and create individual messages
                if (receivedData.vehicles && Array.isArray(receivedData.vehicles)) {
                    receivedData.vehicles.forEach(vehicle => {
                        const message = {
                            timestamp: receivedData.timestamp,
                            vehicle_id: vehicle.vehicle_id,
                            speed: vehicle.speed,
                            fuel_consumption: vehicle.fuel_consumption,
                            co2_emission: vehicle.co2_emission,
                            platooning_status: vehicle.platooning_status ? 'on' : 'off',
                            platoon_size: vehicle.platoon_size,
                            acceleration: vehicle.acceleration,
                            distance_to_leader: vehicle.distance_to_leader,
                            efficiency_score: vehicle.efficiency_score,
                            current_lane: vehicle.current_lane
                        };
                        
                        // Broadcast each vehicle's data to all connected dashboard clients
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify(message));
                            }
                        });
                    });
                    
                    console.log(`[Server] Broadcasted data for ${receivedData.vehicles.length} vehicles`);
                } else {
                    console.log('[Server] No vehicles data found in payload');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success', 
                    received_vehicles: receivedData.vehicles ? receivedData.vehicles.length : 0 
                }));
            } catch (e) {
                console.error("Error parsing incoming data:", e);
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
    console.log('[Server] A dashboard client has connected.');
    
    // Send a welcome message to test the connection
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Vehicle Platooning Server',
        timestamp: new Date().toISOString()
    }));
    
    ws.on('close', () => {
        console.log('[Server] A dashboard client has disconnected.');
    });
    
    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

server.listen(port, () => {
    console.log(`[Server] HTTP and WebSocket server started on port ${port}`);
    console.log(`[Server] WebSocket URL: ws://localhost:${port} (or wss:// for production)`);
});

