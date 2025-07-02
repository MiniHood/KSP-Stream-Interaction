const tmi = require('tmi.js');

class TwitchClient {
    constructor(tcpClient, config = {}) {
        this.tcpClient = tcpClient;
        this.config = {
            channels: config.channels || [],
            username: config.username || 'your_bot_username',
            oauth: config.oauth || 'oauth:your_oauth_token',
            commandPrefix: config.commandPrefix || '!',
            allowedUsers: config.allowedUsers || [], // Empty array means all users can use commands
            ...config
        };
        
        this.client = null;
        this.isConnected = false;
        this.commandHistory = [];
        this.maxHistorySize = 100;
        this.commands = []; // Custom commands will be loaded here
    }

    // Set custom commands (called from server)
    setCommands(commands) {
        this.commands = commands;
        console.log(`[Twitch] Loaded ${commands.length} custom commands`);
    }

    connect() {
        if (this.client) {
            this.client.disconnect();
        }

        this.client = new tmi.Client({
            options: { debug: true },
            connection: {
                reconnect: true,
                secure: true
            },
            identity: {
                username: this.config.username,
                password: this.config.oauth
            },
            channels: this.config.channels
        });

        this.client.on('connecting', () => {
            console.log('Connecting to Twitch...');
        });

        this.client.on('connected', (addr, port) => {
            console.log(`Connected to Twitch on ${addr}:${port}`);
            this.isConnected = true;
        });

        this.client.on('disconnected', (reason) => {
            console.log(`Disconnected from Twitch: ${reason}`);
            this.isConnected = false;
        });

        this.client.on('message', (channel, tags, message, self) => {
            this.handleMessage(channel, tags, message, self);
        });

        this.client.connect().catch(console.error);
    }

    handleMessage(channel, tags, message, self) {
        // Ignore messages from the bot itself
        if (self) return;

        const username = tags.username;
        const isModerator = tags.mod;
        const isSubscriber = tags.subscriber;
        const isBroadcaster = channel.slice(1) === username;

        // Check if message starts with command prefix
        if (!message.startsWith(this.config.commandPrefix)) {
            return;
        }

        // Extract command
        const command = message.slice(this.config.commandPrefix.length).trim();
        if (!command) return;

        console.log(`[Twitch] ${username}: ${command}`);

        // Check if user is allowed to use commands
        if (!this.isUserAllowed(username, isModerator, isBroadcaster)) {
            console.log(`[Twitch] User ${username} not allowed to use commands`);
            return;
        }

        // First, check for custom commands
        const customCommand = this.findCustomCommand(command);
        if (customCommand) {
            this.handleCustomCommand(customCommand, username, isModerator, isSubscriber, isBroadcaster);
            return;
        }

        // If no custom command found, send as raw command
        this.sendToTCP(command, username);
    }

    findCustomCommand(message) {
        const trigger = message.split(' ')[0].toLowerCase(); // Get first word as trigger
        return this.commands.find(cmd => 
            cmd.enabled && 
            cmd.trigger === trigger
        );
    }

    handleCustomCommand(command, username, isModerator, isSubscriber, isBroadcaster) {
        // Check permissions
        if (!this.checkCommandPermissions(command, username, isModerator, isSubscriber, isBroadcaster)) {
            console.log(`[Twitch] User ${username} doesn't have permission for command ${command.trigger}`);
            return;
        }

        // Check cooldown (this will be handled by the server)
        console.log(`[Twitch] Executing custom command: ${command.trigger} -> ${command.output}`);

        // Add to command history
        this.addToHistory({
            timestamp: new Date(),
            username: username,
            command: `${command.trigger} (custom)`,
            channel: this.config.channels[0] || 'unknown'
        });

        // Send the custom command output to TCP
        this.sendToTCP(command.output, username, command.id);
    }

    checkCommandPermissions(command, username, isModerator, isSubscriber, isBroadcaster) {
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

    isUserAllowed(username, isModerator, isBroadcaster) {
        // If no allowed users specified, everyone can use commands
        if (this.config.allowedUsers.length === 0) {
            return true;
        }

        // Check if user is in allowed list
        if (this.config.allowedUsers.includes(username.toLowerCase())) {
            return true;
        }

        // Moderators and broadcasters are always allowed
        if (isModerator || isBroadcaster) {
            return true;
        }

        return false;
    }

    sendToTCP(command, username, commandId = null) {
        // Check if TCP client exists and is properly connected
        if (!this.isTCPConnected()) {
            console.log(`[Twitch] TCP not connected, cannot send command: ${command}`);
            console.log(`[Twitch] TCP status - client: ${!!this.tcpClient}, destroyed: ${this.tcpClient?.destroyed}, writable: ${this.tcpClient?.writable}, remoteAddress: ${this.tcpClient?.remoteAddress}`);
            return;
        }

        try {
            // Format command with username prefix for kOS
            const formattedCommand = `${command}`;
            console.log(`[Twitch] Sending to kOS: ${formattedCommand}`);
            
            // Ensure proper formatting for kOS
            let messageToSend = formattedCommand;
            if (!messageToSend.endsWith('\n')) {
                messageToSend = messageToSend + '\n';
            }
            
            this.tcpClient.write(messageToSend, (err) => {
                if (err) {
                    console.error(`[Twitch] Error sending command to kOS:`, err);
                } else {
                    console.log(`[Twitch] Command sent successfully to kOS`);
                }
            });
            
            // If this was a custom command, notify the server for usage tracking
            if (commandId) {
                // We'll need to implement a way to notify the server about custom command usage
                // For now, we'll just log it
                console.log(`[Twitch] Custom command ${commandId} used by ${username}`);
            }
        } catch (error) {
            console.error(`[Twitch] Error sending command to kOS:`, error);
        }
    }

    addToHistory(entry) {
        this.commandHistory.push(entry);
        
        // Keep only the last N entries
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory.shift();
        }
    }

    getCommandHistory() {
        return this.commandHistory;
    }

    getStatus() {
        return {
            connected: this.isConnected,
            channels: this.config.channels,
            username: this.config.username,
            commandPrefix: this.config.commandPrefix,
            allowedUsers: this.config.allowedUsers,
            commandCount: this.commandHistory.length,
            customCommands: this.commands.length
        };
    }

    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.isConnected = false;
        }
    }

    // Send a message to Twitch chat
    say(channel, message) {
        if (this.client && this.isConnected) {
            this.client.say(channel, message);
        }
    }

    // Update TCP client reference
    updateTCPClient(newTCPClient) {
        this.tcpClient = newTCPClient;
        console.log('[Twitch] TCP client reference updated');
    }

    // Check if TCP is properly connected
    isTCPConnected() {
        return this.tcpClient && 
               !this.tcpClient.destroyed && 
               this.tcpClient.writable &&
               this.tcpClient.remoteAddress !== null &&
               this.tcpClient.remoteAddress !== undefined;
    }
}

module.exports = TwitchClient; 