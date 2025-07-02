// Browser-compatible JavaScript that communicates with Node.js backend

// Function to send data via TCP through the backend
async function sendViaTCP(message) {
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.log('TCP send result:', result);
        return result;
    } catch (error) {
        console.error('Error sending via TCP:', error);
        throw error;
    }
}

// Function to get TCP connection status
async function getTCPStatus() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();
        console.log('TCP Status:', status);
        return status;
    } catch (error) {
        console.error('Error getting TCP status:', error);
        throw error;
    }
}

// Function to manually reconnect TCP
async function reconnectTCP() {
    try {
        const response = await fetch('/api/reconnect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        console.log('Reconnect result:', result);
        return result;
    } catch (error) {
        console.error('Error reconnecting TCP:', error);
        throw error;
    }
}

// Twitch functions
async function getTwitchStatus() {
    try {
        const response = await fetch('/api/twitch/status');
        const status = await response.json();
        console.log('Twitch Status:', status);
        return status;
    } catch (error) {
        console.error('Error getting Twitch status:', error);
        throw error;
    }
}

async function connectTwitch() {
    try {
        const response = await fetch('/api/twitch/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        console.log('Twitch connect result:', result);
        return result;
    } catch (error) {
        console.error('Error connecting to Twitch:', error);
        throw error;
    }
}

async function disconnectTwitch() {
    try {
        const response = await fetch('/api/twitch/disconnect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        console.log('Twitch disconnect result:', result);
        return result;
    } catch (error) {
        console.error('Error disconnecting from Twitch:', error);
        throw error;
    }
}

async function getTwitchHistory() {
    try {
        const response = await fetch('/api/twitch/history');
        const history = await response.json();
        console.log('Twitch History:', history);
        return history;
    } catch (error) {
        console.error('Error getting Twitch history:', error);
        throw error;
    }
}

async function getTwitchConfig() {
    try {
        const response = await fetch('/api/twitch/config');
        const config = await response.json();
        console.log('Twitch Config:', config);
        return config;
    } catch (error) {
        console.error('Error getting Twitch config:', error);
        throw error;
    }
}

async function updateTwitchConfig(newConfig) {
    try {
        const response = await fetch('/api/twitch/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newConfig)
        });
        
        const result = await response.json();
        console.log('Twitch config update result:', result);
        return result;
    } catch (error) {
        console.error('Error updating Twitch config:', error);
        throw error;
    }
}

// Example usage
document.addEventListener('DOMContentLoaded', function() {
    console.log('Web page loaded, checking connections...');
    
    // Check TCP connection status
    getTCPStatus().then(status => {
        if (status.connected) {
            console.log('TCP connection is active');
        } else {
            console.log('TCP connection is not active');
        }
    }).catch(error => {
        console.error('Failed to get TCP status:', error);
    });
    
    // Check Twitch connection status
    getTwitchStatus().then(status => {
        if (status.enabled) {
            console.log('Twitch integration is enabled');
            if (status.connected) {
                console.log('Twitch connection is active');
            } else {
                console.log('Twitch connection is not active');
            }
        } else {
            console.log('Twitch integration is disabled');
        }
    }).catch(error => {
        console.error('Failed to get Twitch status:', error);
    });
});

// Export functions for use in other scripts
window.TCPClient = {
    send: sendViaTCP,
    getStatus: getTCPStatus,
    reconnect: reconnectTCP
};

window.TwitchClient = {
    getStatus: getTwitchStatus,
    connect: connectTwitch,
    disconnect: disconnectTwitch,
    getHistory: getTwitchHistory,
    getConfig: getTwitchConfig,
    updateConfig: updateTwitchConfig
};