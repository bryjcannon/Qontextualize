/**
 * Simple utility for timing operations
 */

class Timer {
    constructor() {
        this.timers = new Map();
    }

    /**
     * Start timing an operation
     * @param {string} label - Label for the operation
     */
    start(label) {
        this.timers.set(label, process.hrtime.bigint());
    }

    /**
     * End timing an operation and log the duration
     * @param {string} label - Label for the operation
     * @param {Object} metadata - Additional data to log
     * @returns {number} Duration in milliseconds
     */
    end(label, metadata = {}) {
        const start = this.timers.get(label);
        if (!start) return 0;

        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1e6; // Convert to milliseconds
        this.timers.delete(label);

        // Format duration for display
        const formattedDuration = duration >= 1000 
            ? `${(duration / 1000).toFixed(2)}s`
            : `${Math.round(duration)}ms`;

        const metadataStr = Object.keys(metadata).length 
            ? ` | ${Object.entries(metadata)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')}`
            : '';

        console.log(`✓ ${label} (${formattedDuration})${metadataStr}`);
        return duration;
    }

    /**
     * Wrap an async function with timing
     * @param {string} label - Label for the operation
     * @param {Function} fn - Async function to time
     * @param {Object} metadata - Additional data to log
     * @returns {Promise<T>} Result of the function
     */
    async time(label, fn, metadata = {}) {
        this.start(label);
        try {
            const result = await fn();
            this.end(label, metadata);
            return result;
        } catch (error) {
            console.error(`✗ ${label} failed after ${this.end(label)}ms:`, error);
            throw error;
        }
    }
}

// Export singleton instance
const timer = new Timer();
export default timer;
