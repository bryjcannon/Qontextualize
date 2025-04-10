/**
 * Utility for tracking performance and progress of operations
 */

class PerformanceTracker {
    constructor() {
        this.timers = new Map();
        this.metrics = new Map();
    }

    /**
     * Start timing an operation
     * @param {string} operationName - Name of the operation to time
     */
    start(operationName) {
        this.timers.set(operationName, {
            startTime: process.hrtime.bigint(),
            checkpoints: []
        });
    }

    /**
     * Add a checkpoint to track progress within an operation
     * @param {string} operationName - Name of the operation
     * @param {string} checkpoint - Description of the checkpoint
     * @param {Object} metadata - Additional data to log
     */
    checkpoint(operationName, checkpoint, metadata = {}) {
        const timer = this.timers.get(operationName);
        if (!timer) return;

        const checkpointTime = process.hrtime.bigint();
        const elapsed = Number(checkpointTime - timer.startTime) / 1e6; // Convert to ms
        
        timer.checkpoints.push({
            name: checkpoint,
            elapsed,
            metadata
        });

        console.log(`[${operationName}] ${checkpoint} (${elapsed.toFixed(2)}ms)`, 
            Object.keys(metadata).length ? metadata : '');
    }

    /**
     * End timing an operation and record metrics
     * @param {string} operationName - Name of the operation
     * @returns {Object} Timing data for the operation
     */
    end(operationName) {
        const timer = this.timers.get(operationName);
        if (!timer) return null;

        const endTime = process.hrtime.bigint();
        const totalTime = Number(endTime - timer.startTime) / 1e6;

        const metrics = {
            totalTime,
            checkpoints: timer.checkpoints,
            avgTimeBetweenCheckpoints: totalTime / (timer.checkpoints.length + 1)
        };

        this.metrics.set(operationName, metrics);
        this.timers.delete(operationName);

        console.log(`[${operationName}] Completed in ${totalTime.toFixed(2)}ms`);
        return metrics;
    }

    /**
     * Get metrics for a completed operation
     * @param {string} operationName - Name of the operation
     * @returns {Object|null} Metrics for the operation
     */
    getMetrics(operationName) {
        return this.metrics.get(operationName) || null;
    }

    /**
     * Get all recorded metrics
     * @returns {Object} Map of all operation metrics
     */
    getAllMetrics() {
        return Object.fromEntries(this.metrics);
    }
}

// Export singleton instance
const performanceTracker = new PerformanceTracker();
export default performanceTracker;
