// server.js - A simple Node.js server to stream CSV data over WebSockets.

const WebSocket = require('ws');
const fs = require('fs');
const Papa = require('papaparse');

// --- Configuration ---
const port = 8080; // Port for the WebSocket server
const csvFilePath = 'D:\\vit\\vehicle_data_vit.csv'; // Path to your CSV file
const streamInterval = 2000; // Time in milliseconds between sending each data row

// Create a WebSocket server.
const wss = new WebSocket.Server({ port });

let connectedClients = [];

console.log(`[Server] WebSocket server started on port ${port}`);
console.log(`[Server] Watching CSV file: ${csvFilePath}`);

wss.on('connection', (ws) => {
    console.log('[Server] A client has connected.');
    connectedClients.push(ws);

    ws.on('close', () => {
        console.log('[Server] A client has disconnected.');
        connectedClients = connectedClients.filter(client => client !== ws);
    });
    
    ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
    });
});

// --- Data Streaming Logic ---
function streamCsvData() {
    // Read the CSV file from disk
    const fileContent = fs.readFileSync(csvFilePath, 'utf8');

    // Parse the CSV data using Papa Parse
    Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            const dataRows = results.data;
            let currentIndex = 0;
            console.log(`[Server] Loaded ${dataRows.length} rows from CSV.`);

            // Set up an interval to send one row of data at a time
            const intervalId = setInterval(() => {
                if (connectedClients.length > 0) {
                    if (currentIndex < dataRows.length) {
                        const row = dataRows[currentIndex];
                        const jsonData = JSON.stringify(row);
                        
                        // Send the data row to all connected clients
                        console.log(`[Server] Sending row ${currentIndex + 1}:`, jsonData);
                        connectedClients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(jsonData);
                            }
                        });
                        
                        currentIndex++;
                    } else {
                        // Reset to the beginning to loop the data
                        console.log('[Server] Reached end of CSV, restarting stream.');
                        currentIndex = 0; 
                    }
                } else {
                    // If no clients are connected, pause the sending
                    console.log('[Server] No clients connected, pausing stream.');
                }
            }, streamInterval);
        },
        error: (error) => {
            console.error('[Server] Error parsing CSV file:', error.message);
        }
    });
}

// Start streaming the data when the server starts.
streamCsvData();

