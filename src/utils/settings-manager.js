// Environment detection
const isNode = typeof process !== 'undefined' && 
               process.versions != null && 
               process.versions.node != null;

/**
 * Settings manager for both extension and Node.js environments
 */
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            saveLocalData: false // Default to not saving local data
        };
        this.settings = null;
        this.isExtension = typeof chrome !== 'undefined' && chrome.storage;
        this.fs = null;
        this.path = null;
        this.settingsPath = null;
    }

    /**
     * Initialize Node.js modules if in Node environment
     */
    async initNodeModules() {
        if (isNode && !this.fs) {
            const [fsModule, pathModule] = await Promise.all([
                import('fs/promises'),
                import('path')
            ]);
            this.fs = fsModule;
            this.path = pathModule;
            this.settingsPath = this.path.join(process.cwd(), 'data', 'settings.json');
        }
    }

    /**
     * Initialize settings
     */
    async init() {
        if (this.settings === null) {
            if (this.isExtension) {
                try {
                    const result = await chrome.storage.sync.get('settings');
                    this.settings = result.settings || this.defaultSettings;
                } catch (error) {
                    console.warn('Could not load chrome settings, using defaults:', error);
                    this.settings = this.defaultSettings;
                }
            } else if (isNode) {
                await this.initNodeModules();
                try {
                    await this.fs.mkdir(this.path.dirname(this.settingsPath), { recursive: true });
                    const data = await this.fs.readFile(this.settingsPath, 'utf8');
                    this.settings = JSON.parse(data);
                } catch (error) {
                    console.warn('Could not load local settings, using defaults:', error);
                    this.settings = this.defaultSettings;
                    // Save default settings
                    await this.saveToFile();
                }
            } else {
                this.settings = this.defaultSettings;
            }
        }
        return this.settings;
    }

    /**
     * Save settings to file in Node.js environment
     */
    async saveToFile() {
        if (!this.isExtension && isNode) {
            await this.initNodeModules();
            await this.fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
        }
    }

    /**
     * Get a setting value
     * @param {string} key - The setting key
     * @returns {any} The setting value
     */
    async getSetting(key) {
        await this.init();
        return this.settings[key];
    }

    /**
     * Update a setting
     * @param {string} key - The setting key
     * @param {any} value - The new value
     */
    async updateSetting(key, value) {
        await this.init();
        this.settings[key] = value;
        
        if (this.isExtension) {
            try {
                await chrome.storage.sync.set({ settings: this.settings });
            } catch (error) {
                console.error('Failed to save chrome settings:', error);
                throw error;
            }
        } else {
            try {
                await this.saveToFile();
            } catch (error) {
                console.error('Failed to save local settings:', error);
                throw error;
            }
        }
    }

    /**
     * Check if local data saving is enabled
     * @returns {Promise<boolean>}
     */
    async isLocalDataSavingEnabled() {
        return await this.getSetting('saveLocalData');
    }
}

// Export singleton instance
const settingsManager = new SettingsManager();
export default settingsManager;
