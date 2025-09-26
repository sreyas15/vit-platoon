const WebSocket = require('ws');
const http = require('http');
const fs = require('fs'); // Corrected import
const path = require('path'); // Corrected import

// --- Configuration ---
const port = process.env.PORT || 8080;
let testDataInterval = null; // To hold our test data generator

// Create an HTTP server
const server = http.createServer((req, res) => {
    // --- Data Endpoint for CARLA ---
    if (req.method === 'POST' && req.url === '/data') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const newDataRow = JSON.parse(body);
                console.log('[Server] Received data from simulation:', newDataRow);
                
                // When real data is received, stop the test data generator if it's running
                if (testDataInterval) {
                    clearInterval(testDataInterval);
                    testDataInterval = null;
                    console.log('[Server] Real data received, stopping test data generator.');
                }

                // Broadcast the new row to all connected dashboard clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        // Sending a single vehicle object, as the frontend expects
                        client.send(JSON.stringify(newDataRow));
                    }
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (e) {
                console.error("Error parsing incoming data:", e);
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
            }
        });
        return; // End execution for this endpoint
    }

    // --- Static File Serving for Frontend ---
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
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
    console.log(`[Server] New WebSocket connection. Total clients: ${wss.clients.size}`);

    // Send immediate confirmation to the new client
    ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString()
    }));

    // If this is the first client and test data isn't running, start it.
    if (!testDataInterval && wss.clients.size === 1) {
        console.log('[Server] First client connected. Starting test data generator.');
        testDataInterval = setInterval(() => {
            const testData = {
                timestamp: new Date().toISOString(),
                vehicle_id: `test_${Math.floor(Math.random() * 100)}`,
                speed: 45 + Math.random() * 30,
                fuel_consumption: 6 + Math.random() * 4,
                co2_emission: 150 + Math.random() * 100,
                platooning_status: Math.random() > 0.5, // Use boolean for consistency
                platoon_size: Math.floor(Math.random() * 5) + 1,
                acceleration: (Math.random() - 0.5) * 2,
                distance_to_leader: Math.random() * 20,
                efficiency_score: 50 + Math.random() * 50,
                current_lane: Math.floor(Math.random() * 3) + 1
            };

            // Send test data to all connected clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(testData));
                }
            });
        }, 3000); // Every 3 seconds
    }

    ws.on('close', () => {
        console.log(`[Server] Client disconnected. Remaining: ${wss.clients.size}`);
        // If no clients are left, stop the test data generator to save resources
        if (wss.clients.size === 0 && testDataInterval) {
            clearInterval(testDataInterval);
            testDataInterval = null;
            console.log('[Server] Last client disconnected. Stopped test data generator.');
        }
    });

    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

server.listen(port, () => {
    console.log(`[Server] HTTP and WebSocket server started on port ${port}`);
});

