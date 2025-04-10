import settingsManager from '../utils/settings-manager.js';

/**
 * Initialize settings UI
 */
export async function initializeSettings() {
    const settingsContainer = document.getElementById('settings-container');
    if (!settingsContainer) return;

    // Create save local data toggle
    const saveLocalDataDiv = document.createElement('div');
    saveLocalDataDiv.className = 'setting-item';
    
    const saveLocalDataLabel = document.createElement('label');
    saveLocalDataLabel.className = 'setting-label';
    saveLocalDataLabel.htmlFor = 'save-local-data';
    saveLocalDataLabel.textContent = 'Save Processing Data Locally';
    
    const saveLocalDataToggle = document.createElement('input');
    saveLocalDataToggle.type = 'checkbox';
    saveLocalDataToggle.id = 'save-local-data';
    saveLocalDataToggle.className = 'setting-toggle';
    
    // Set initial state
    const isEnabled = await settingsManager.isLocalDataSavingEnabled();
    saveLocalDataToggle.checked = isEnabled;
    
    // Add change listener
    saveLocalDataToggle.addEventListener('change', async (event) => {
        try {
            await settingsManager.updateSetting('saveLocalData', event.target.checked);
            // Show success message
            showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save setting:', error);
            // Show error message
            showMessage('Failed to save settings', 'error');
            // Revert checkbox state
            event.target.checked = !event.target.checked;
        }
    });
    
    // Add help text
    const helpText = document.createElement('p');
    helpText.className = 'setting-help';
    helpText.textContent = 'When enabled, detailed processing data will be saved as CSV and JSON files in the data directory.';
    
    // Assemble the setting item
    saveLocalDataDiv.appendChild(saveLocalDataLabel);
    saveLocalDataDiv.appendChild(saveLocalDataToggle);
    saveLocalDataDiv.appendChild(helpText);
    
    // Add to container
    settingsContainer.appendChild(saveLocalDataDiv);
}

/**
 * Show a message to the user
 * @param {string} message - The message to show
 * @param {string} type - The type of message ('success' or 'error')
 */
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}
