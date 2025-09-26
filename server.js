const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const port = process.env.PORT || 8080;

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
                
                // Broadcast the new row to all connected dashboard clients
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
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
        '.mp3': 'audio/mpeg', // Added mp3
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
    ws.on('close', () => {
        console.log('[Server] A dashboard client has disconnected.');
    });
});

server.listen(port, () => {
    console.log(`[Server] HTTP and WebSocket server started on port ${port}`);
});
```

#### Step 3: Deploy on Render (as a single Web Service)

1.  **Update GitHub:** Push your new folder structure (with the `public` folder) and the updated `server.js` file to your GitHub repository.
2.  **Create a New "Web Service" on Render:**
    * Connect your GitHub repository.
    * **Name:** `f1-telemetry-dashboard` (or your preferred name).
    * **Root Directory:** Leave this blank (it will use the main folder).
    * **Environment:** `Node`.
    * **Build Command:** `npm install`.
    * **Start Command:** `node server.js`.
3.  **Deploy:** Click "Create Web Service".

#### Step 4: Update Your URLs

Now that everything is hosted at one address, you just need to use that single Render URL.

1.  **Your Website URL:** The URL Render gives you for the Web Service is now your main website address (e.g., `https://f1-telemetry-dashboard.onrender.com`).
2.  **WebSocket URL (in `index.html`):** Update the WebSocket connection to use this same URL.
    ```javascript
    // In your public/index.html
    socket = new WebSocket('wss://f1-telemetry-dashboard.onrender.com');
    ```
3.  **CARLA Script URL (in Python):** Update your Python script to post data to the `/data` endpoint of this same URL.
    ```python
    # In your Python script
    SERVER_URL = "https://f1-telemetry-dashboard.onrender.com/data"
    

