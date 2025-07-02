const express = require('express');
const net = require('net');
const path = require('path');
const fs = require('fs');
const TwitchClient = require('./twitch-client');

const app = express();
const PORT = 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// TCP client setup
let client = null;
let isConnected = false;

// Twitch client setup
let twitchClient = null;
let twitchConfig = null;

// Commands setup
let commands = [];
let commandCooldowns = new Map(); // Track cooldowns per user per command

// Load commands from file
function loadCommands() {
    try {
        const commandsPath = path.join(__dirname, 'commands.json');
        if (fs.existsSync(commandsPath)) {
            commands = JSON.parse(fs.readFileSync(commandsPath, 'utf8'));
            console.log(`Loaded ${commands.length} commands`);
        } else {
            commands = [];
            fs.writeFileSync(commandsPath, JSON.stringify(commands, null, 2));
            console.log('Created new commands file');
        }
        
        // Update Twitch client with new commands if it exists
        if (twitchClient) {
            twitchClient.setCommands(commands);
        }
    } catch (error) {
        console.error('Error loading commands:', error);
        commands = [];
    }
}

// Save commands to file
function saveCommands() {
    try {
        console.log('Saving commands to file...');
        const commandsPath = path.join(__dirname, 'commands.json');
        fs.writeFileSync(commandsPath, JSON.stringify(commands, null, 2));
        console.log(`Saved ${commands.length} commands to file`);
        
        // Update Twitch client with new commands
        if (twitchClient) {
            console.log('Updating Twitch client with commands');
            twitchClient.setCommands(commands);
        } else {
            console.log('Twitch client not available for command update');
        }
    } catch (error) {
        console.error('Error saving commands:', error);
    }
}

// Add command usage
function addCommandUsage(commandId, username, output) {
    const command = commands.find(c => c.id === commandId);
    if (command) {
        if (!command.usage) command.usage = [];
        command.usage.push({
            username: username,
            output: output,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 usage entries
        if (command.usage.length > 50) {
            command.usage = command.usage.slice(-50);
        }
        
        command.uses = (command.uses || 0) + 1;
        saveCommands();
    }
}

// Check command cooldown
function isOnCooldown(commandId, username) {
    const key = `${commandId}-${username}`;
    const lastUse = commandCooldowns.get(key);
    if (!lastUse) return false;
    
    const command = commands.find(c => c.id === commandId);
    if (!command || !command.cooldown) return false;
    
    const timeSinceLastUse = Date.now() - lastUse;
    return timeSinceLastUse < (command.cooldown * 1000);
}

// Set command cooldown
function setCommandCooldown(commandId, username) {
    const key = `${commandId}-${username}`;
    commandCooldowns.set(key, Date.now());
}

// Check user permissions
function checkUserPermissions(command, username, isModerator, isSubscriber, isBroadcaster) {
    switch (command.permissions) {
        case 'everyone':
            return true;
        case 'subscribers':
            return isSubscriber || isModerator || isBroadcaster;
        case 'moderators':
            return isModerator || isBroadcaster;
        case 'broadcaster':
            return isBroadcaster;
        default:
            return true;
    }
}

// Load Twitch configuration
function loadTwitchConfig() {
    try {
        const configPath = path.join(__dirname, 'twitch-config.json');
        if (fs.existsSync(configPath)) {
            twitchConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log('Twitch config loaded:', twitchConfig);
        } else {
            console.log('Twitch config file not found, using defaults');
            twitchConfig = {
                enabled: false,
                username: 'your_bot_username',
                oauth: 'oauth:your_oauth_token_here',
                channels: ['your_channel_name'],
                commandPrefix: '!',
                allowedUsers: [],
                autoConnect: true,
                logCommands: true,
                maxCommandLength: 100
            };
        }
    } catch (error) {
        console.error('Error loading Twitch config:', error);
        twitchConfig = { enabled: false };
    }
}

// Initialize Twitch client
function initTwitchClient() {
    if (twitchConfig && twitchConfig.enabled) {
        // Destroy existing client if it exists
        if (twitchClient) {
            twitchClient.disconnect();
        }
        
        twitchClient = new TwitchClient(client, twitchConfig);
        
        // Pass custom commands to Twitch client
        twitchClient.setCommands(commands);
        
        if (twitchConfig.autoConnect) {
            twitchClient.connect();
        }
        
        console.log('Twitch client initialized');
    }
}

function createTCPConnection() {
    // Clean up existing connection if it exists
    if (client) {
        client.destroy();
        client = null;
    }
    
    client = new net.Socket();
    
    // Set encoding to handle kOS data properly
    client.setEncoding('utf8');
    
    // Set TCP keep-alive to maintain connection
    client.setKeepAlive(true, 1000);
    
    client.connect(5410, '127.0.0.1', function() {
        console.log('TCP Connected to 127.0.0.1:5410');
        isConnected = true;
        
        // Send initial handshake to kOS
        setTimeout(() => {
            if (client && !client.destroyed) {
                console.log('Sending initial handshake to kOS...');
                client.write('HANDSHAKE\n');
            }
        }, 1000);
        
        // Reinitialize Twitch client with the connected TCP client
        if (twitchConfig && twitchConfig.enabled && !twitchClient) {
            initTwitchClient();
        }
    });

    client.on('connect', function() {
        console.log('TCP Connection established');
        isConnected = true;
        
        // Update Twitch client's TCP reference if it exists
        if (twitchClient) {
            twitchClient.updateTCPClient(client);
        }
    });

    client.on('data', function(data) {
        const dataStr = data.toString().trim();
        console.log('TCP Data received:', dataStr);
        
        // Check for kOS disconnection messages
        if (dataStr.includes('Detaching from') && dataStr.includes('CPU:') && dataStr.includes('Space Craft')) {
            console.log('Detected kOS disconnection, will attempt to reconnect...');
            createTCPConnection();
            // Don't immediately reconnect, let the close event handle it
        }
        
        // You can emit this data to connected web clients via WebSocket if needed
    });

    client.on('close', function(hadError) {
        console.log(`TCP Connection closed${hadError ? ' due to error' : ''}`);
        isConnected = false;
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
            console.log('Attempting to reconnect to kOS...');
            createTCPConnection();
        }, 3000); // Wait 3 seconds before reconnecting
    });

    client.on('error', function(err) {
        console.log('TCP Connection error:', err.message);
        isConnected = false;
        
        // Don't reconnect immediately on error, let the close event handle it
    });

    client.on('timeout', function() {
        console.log('TCP Connection timeout');
        client.destroy();
    });
}

// Initialize everything
createTCPConnection();
loadTwitchConfig();
initTwitchClient();
loadCommands();

// API endpoint to send data via TCP
app.post('/api/send', express.json(), (req, res) => {
    const message = req.body.message;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!isConnected || !client || client.destroyed) {
        return res.status(503).json({ error: 'TCP connection not available' });
    }
    
    try {
        // Ensure message is properly formatted for kOS
        let formattedMessage = message.trim();
        
        // Add newline if not present (kOS expects this)
        if (!formattedMessage.endsWith('\n')) {
            formattedMessage = formattedMessage + '\n';
        }
        
        console.log('Sending TCP message to kOS:', formattedMessage.trim());
        
        // Send the message with error handling
        const bytesWritten = client.write(formattedMessage, (err) => {
            if (err) {
                console.error('Error writing to TCP:', err);
                return res.status(500).json({ error: 'Failed to send message', details: err.message });
            }
            console.log('Message sent successfully to kOS');
        });
        
        if (bytesWritten === false) {
            // Buffer is full, wait for drain event
            client.once('drain', () => {
                console.log('TCP buffer drained, message sent successfully');
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Data sent via TCP',
            bytesWritten: bytesWritten,
            formattedMessage: formattedMessage.trim()
        });
        
    } catch (error) {
        console.error('Error in send endpoint:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// API endpoint to get connection status
app.get('/api/status', (req, res) => {
    res.json({ 
        connected: isConnected && client && !client.destroyed,
        remoteAddress: client ? client.remoteAddress : null,
        remotePort: client ? client.remotePort : null,
        destroyed: client ? client.destroyed : true
    });
});

// API endpoint to manually reconnect
app.post('/api/reconnect', (req, res) => {
    if (client) {
        client.destroy();
    }
    createTCPConnection();
    res.json({ success: true, message: 'Reconnection initiated' });
});

// Commands API endpoints
app.get('/api/commands', (req, res) => {
    res.json(commands);
});

app.post('/api/commands', express.json(), (req, res) => {
    try {
        console.log('Received command creation request:', req.body);
        const { trigger, output, description, cooldown, enabled, permissions } = req.body;
        
        if (!trigger || !output) {
            console.log('Missing required fields - trigger:', trigger, 'output:', output);
            return res.status(400).json({ error: 'Trigger and output are required' });
        }
        
        // Check if trigger already exists
        if (commands.some(c => c.trigger === trigger)) {
            console.log('Trigger already exists:', trigger);
            return res.status(400).json({ error: 'Command trigger already exists' });
        }
        
        const newCommand = {
            id: Date.now().toString(),
            trigger: trigger.toLowerCase(),
            output: output,
            description: description || '',
            cooldown: parseInt(cooldown) || 0,
            enabled: enabled !== false,
            permissions: permissions || 'everyone',
            uses: 0,
            usage: [],
            createdAt: new Date().toISOString()
        };
        
        console.log('Creating new command:', newCommand);
        commands.push(newCommand);
        saveCommands();
        
        // Update Twitch client with new commands
        if (twitchClient) {
            console.log('Updating Twitch client with commands');
            twitchClient.setCommands(commands);
        } else {
            console.log('Twitch client not available');
        }
        
        console.log('Command created successfully');
        res.json({ success: true, message: 'Command created successfully', command: newCommand });
    } catch (error) {
        console.error('Error creating command:', error);
        res.status(500).json({ error: 'Failed to create command' });
    }
});

app.put('/api/commands/:id', express.json(), (req, res) => {
    try {
        const { id } = req.params;
        const { trigger, output, description, cooldown, enabled, permissions } = req.body;
        
        const commandIndex = commands.findIndex(c => c.id === id);
        if (commandIndex === -1) {
            return res.status(404).json({ error: 'Command not found' });
        }
        
        // Check if trigger already exists (excluding current command)
        if (commands.some(c => c.trigger === trigger && c.id !== id)) {
            return res.status(400).json({ error: 'Command trigger already exists' });
        }
        
        const updatedCommand = {
            ...commands[commandIndex],
            trigger: trigger.toLowerCase(),
            output: output,
            description: description || '',
            cooldown: parseInt(cooldown) || 0,
            enabled: enabled !== false,
            permissions: permissions || 'everyone',
            updatedAt: new Date().toISOString()
        };
        
        commands[commandIndex] = updatedCommand;
        saveCommands();
        
        // Update Twitch client with new commands
        if (twitchClient) {
            twitchClient.setCommands(commands);
        }
        
        res.json({ success: true, message: 'Command updated successfully', command: updatedCommand });
    } catch (error) {
        console.error('Error updating command:', error);
        res.status(500).json({ error: 'Failed to update command' });
    }
});

app.delete('/api/commands/:id', (req, res) => {
    try {
        const { id } = req.params;
        const commandIndex = commands.findIndex(c => c.id === id);
        
        if (commandIndex === -1) {
            return res.status(404).json({ error: 'Command not found' });
        }
        
        const deletedCommand = commands.splice(commandIndex, 1)[0];
        saveCommands();
        
        // Update Twitch client with new commands
        if (twitchClient) {
            twitchClient.setCommands(commands);
        }
        
        res.json({ success: true, message: 'Command deleted successfully', command: deletedCommand });
    } catch (error) {
        console.error('Error deleting command:', error);
        res.status(500).json({ error: 'Failed to delete command' });
    }
});

app.get('/api/commands/:id/usage', (req, res) => {
    try {
        const { id } = req.params;
        const command = commands.find(c => c.id === id);
        
        if (!command) {
            return res.status(404).json({ error: 'Command not found' });
        }
        
        res.json(command.usage || []);
    } catch (error) {
        console.error('Error getting command usage:', error);
        res.status(500).json({ error: 'Failed to get command usage' });
    }
});

// Twitch API endpoints
app.get('/api/twitch/status', (req, res) => {
    if (!twitchClient) {
        return res.json({ enabled: false, connected: false });
    }
    
    const status = twitchClient.getStatus();
    res.json({
        enabled: twitchConfig.enabled,
        ...status
    });
});

app.post('/api/twitch/connect', (req, res) => {
    if (!twitchClient) {
        return res.status(400).json({ error: 'Twitch client not initialized' });
    }
    
    try {
        twitchClient.connect();
        res.json({ success: true, message: 'Twitch connection initiated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to connect to Twitch', details: error.message });
    }
});

app.post('/api/twitch/disconnect', (req, res) => {
    if (!twitchClient) {
        return res.status(400).json({ error: 'Twitch client not initialized' });
    }
    
    try {
        twitchClient.disconnect();
        res.json({ success: true, message: 'Twitch disconnected' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disconnect from Twitch', details: error.message });
    }
});

app.get('/api/twitch/history', (req, res) => {
    if (!twitchClient) {
        return res.json([]);
    }
    
    const history = twitchClient.getCommandHistory();
    res.json(history);
});

app.get('/api/twitch/config', (req, res) => {
    res.json(twitchConfig || { enabled: false });
});

app.post('/api/twitch/config', express.json(), (req, res) => {
    try {
        const newConfig = { ...twitchConfig, ...req.body };
        
        // Save to file
        const configPath = path.join(__dirname, 'twitch-config.json');
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
        
        // Update in memory
        twitchConfig = newConfig;
        
        // Reinitialize Twitch client if needed
        if (twitchConfig.enabled && !twitchClient) {
            initTwitchClient();
        } else if (!twitchConfig.enabled && twitchClient) {
            twitchClient.disconnect();
            twitchClient = null;
        }
        
        res.json({ success: true, message: 'Twitch config updated', config: newConfig });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update Twitch config', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Web server running on http://localhost:${PORT}`);
    console.log(`Twitch integration: ${twitchConfig.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`Loaded ${commands.length} custom commands`);
}); 