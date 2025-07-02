// Command Manager JavaScript

let commands = [];
let editingCommandId = null;

// Load commands from server
async function loadCommands() {
    try {
        console.log('Loading commands from server...');
        const response = await fetch('/api/commands');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        commands = await response.json();
        console.log(`Loaded ${commands.length} commands:`, commands);
        renderCommands();
        updateStats();
    } catch (error) {
        console.error('Failed to load commands:', error);
        showNotification('Failed to load commands: ' + error.message, 'error');
    }
}

// Render commands in the grid
function renderCommands() {
    const grid = document.getElementById('commands-grid');
    
    if (commands.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No commands yet</h3>
                <p>Create your first custom command to get started!</p>
                <button onclick="showAddCommandModal()" class="add-btn">Create Command</button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = commands.map(command => `
        <div class="command-card ${!command.enabled ? 'disabled' : ''}" data-id="${command.id}">
            <div class="command-header">
                <div class="command-trigger">!${command.trigger}</div>
                <div class="command-status">
                    ${command.enabled ? 
                        '<span class="status-badge status-enabled">Enabled</span>' : 
                        '<span class="status-badge status-disabled">Disabled</span>'
                    }
                    ${command.cooldown > 0 ? 
                        `<span class="status-badge status-cooldown">${command.cooldown}s CD</span>` : 
                        ''
                    }
                </div>
            </div>
            
            <div class="command-output">${escapeHtml(command.output)}</div>
            
            ${command.description ? 
                `<div class="command-description">${escapeHtml(command.description)}</div>` : 
                ''
            }
            
            <div class="command-meta">
                <div class="command-uses">
                    <span>👥 ${command.permissions}</span>
                </div>
                <div class="command-uses">
                    <span>📊 ${command.uses || 0} uses</span>
                </div>
            </div>
            
            <div class="command-actions">
                <button onclick="editCommand('${command.id}')" class="action-btn edit-btn">Edit</button>
                <button onclick="deleteCommand('${command.id}')" class="action-btn delete-btn">Delete</button>
                <button onclick="viewUsage('${command.id}')" class="action-btn usage-btn">Usage</button>
            </div>
        </div>
    `).join('');
}

// Show add command modal
function showAddCommandModal() {
    editingCommandId = null;
    document.getElementById('modal-title').textContent = 'Add New Command';
    document.getElementById('command-form').reset();
    document.getElementById('command-id').value = '';
    document.getElementById('test-btn').style.display = 'none';
    document.getElementById('command-modal').style.display = 'block';
}

// Show edit command modal
async function editCommand(commandId) {
    const command = commands.find(c => c.id === commandId);
    if (!command) return;
    
    editingCommandId = commandId;
    document.getElementById('modal-title').textContent = 'Edit Command';
    document.getElementById('command-id').value = command.id;
    document.getElementById('command-trigger').value = command.trigger;
    document.getElementById('command-output').value = command.output;
    document.getElementById('command-description').value = command.description || '';
    document.getElementById('command-cooldown').value = command.cooldown || 0;
    document.getElementById('command-enabled').checked = command.enabled;
    document.getElementById('command-permissions').value = command.permissions;
    document.getElementById('test-btn').style.display = 'inline-block';
    
    document.getElementById('command-modal').style.display = 'block';
}

// Close command modal
function closeCommandModal() {
    document.getElementById('command-modal').style.display = 'none';
    editingCommandId = null;
}

// Save command
async function saveCommand(formData) {
    const commandData = {
        trigger: formData.get('trigger'),
        output: formData.get('output'),
        description: formData.get('description'),
        cooldown: parseInt(formData.get('cooldown')) || 0,
        enabled: formData.get('enabled') === 'on',
        permissions: formData.get('permissions')
    };
    
    console.log('Saving command:', commandData);
    
    try {
        const url = editingCommandId ? 
            `/api/commands/${editingCommandId}` : 
            '/api/commands';
        
        const method = editingCommandId ? 'PUT' : 'POST';
        
        console.log(`Making ${method} request to ${url}`);
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(commandData)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Save result:', result);
        showNotification(result.message, 'success');
        closeCommandModal();
        loadCommands();
    } catch (error) {
        console.error('Failed to save command:', error);
        showNotification('Failed to save command: ' + error.message, 'error');
    }
}

// Delete command
async function deleteCommand(commandId) {
    if (!confirm('Are you sure you want to delete this command?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/commands/${commandId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        showNotification(result.message, 'success');
        loadCommands();
    } catch (error) {
        console.error('Failed to delete command:', error);
        showNotification('Failed to delete command', 'error');
    }
}

// Test command
async function testCommand() {
    const form = document.getElementById('command-form');
    const formData = new FormData(form);
    const output = formData.get('output');
    
    if (!output.trim()) {
        showNotification('Please enter a command output to test', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: output })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(`Test command sent successfully: ${output}`, 'success');
        } else {
            showNotification(`Test failed: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Failed to test command:', error);
        showNotification('Failed to test command', 'error');
    }
}

// View command usage history
async function viewUsage(commandId) {
    try {
        const response = await fetch(`/api/commands/${commandId}/usage`);
        const usage = await response.json();
        
        const usageList = document.getElementById('usage-list');
        
        if (usage.length === 0) {
            usageList.innerHTML = '<p>No usage history for this command yet.</p>';
        } else {
            usageList.innerHTML = usage.map(entry => `
                <div class="usage-item">
                    <div class="usage-header">
                        <span class="usage-username">${escapeHtml(entry.username)}</span>
                        <span class="usage-time">${new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="usage-output">${escapeHtml(entry.output)}</div>
                </div>
            `).join('');
        }
        
        document.getElementById('usage-modal').style.display = 'block';
    } catch (error) {
        console.error('Failed to load usage history:', error);
        showNotification('Failed to load usage history', 'error');
    }
}

// Close usage modal
function closeUsageModal() {
    document.getElementById('usage-modal').style.display = 'none';
}

// Update statistics
function updateStats() {
    const totalCommands = commands.length;
    const activeCommands = commands.filter(c => c.enabled).length;
    const totalUses = commands.reduce((sum, c) => sum + (c.uses || 0), 0);
    
    document.getElementById('total-commands').textContent = totalCommands;
    document.getElementById('active-commands').textContent = activeCommands;
    document.getElementById('total-uses').textContent = totalUses;
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadCommands();
    updateStats();
    
    // Handle form submission
    document.getElementById('command-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        saveCommand(formData);
    });
});

// Close modals when clicking outside
window.onclick = function(event) {
    const commandModal = document.getElementById('command-modal');
    const usageModal = document.getElementById('usage-modal');
    
    if (event.target === commandModal) {
        closeCommandModal();
    }
    if (event.target === usageModal) {
        closeUsageModal();
    }
} 