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
                            current_lane: parseInt(vehicle.current_lane) || 0,
                            // New detailed metrics
                            role: vehicle.role || 'solo',
                            alignment_score: parseFloat(vehicle.alignment_score) || 0,
                            total_distance: parseFloat(vehicle.total_distance) || 0,
                            avg_speed: parseFloat(vehicle.avg_speed) || 0,
                            fuel_savings: parseFloat(vehicle.fuel_savings) || 0,
                            platoon_id: vehicle.platoon_id || null,
                            position_in_platoon: parseInt(vehicle.position_in_platoon) || 0
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

// Add a simple heartbeat to send test data if no real data comes in
let testDataInterval = null;

wss.on('connection', ws => {
    console.log(`[Server] Dashboard client connected. Total clients: ${wss.clients.size}`);
    
    // Send a welcome message to test the connection
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Vehicle Platooning Server',
        timestamp: new Date().toISOString(),
        server_status: 'ready'
    }));
    
    // Start sending test data every 10 seconds if no real data is received
    if (!testDataInterval && wss.clients.size === 1) {
        console.log('[Server] Starting test data heartbeat...');
        testDataInterval = setInterval(() => {
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

