/**
 * Utility for processing items in batches with progress tracking
 */

import timer from './timing.js';

/**
 * Process items in batches with timing and progress tracking
 * @template T, R
 * @param {T[]} items - Items to process
 * @param {(item: T) => Promise<R>} processor - Async function to process each item
 * @param {Object} options - Processing options
 * @param {number} [options.batchSize=5] - Number of items to process in parallel
 * @param {string} [options.operationName='Process batch'] - Name of the operation for logging
 * @param {Object} [options.metadata={}] - Additional metadata to log
 * @returns {AsyncGenerator<R[], void>} Generator yielding processed batches
 */
export async function* processBatches(items, processor, options = {}) {
    const {
        batchSize = 5,
        operationName = 'Process batch',
        metadata = {}
    } = options;

    const totalBatches = Math.ceil(items.length / batchSize);
    let processedCount = 0;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        const results = await timer.time(
            `${operationName} ${batchNum}/${totalBatches}`,
            () => Promise.all(batch.map(processor)),
            {
                batchSize: batch.length,
                progress: `${processedCount + batch.length}/${items.length}`,
                ...metadata
            }
        );

        processedCount += batch.length;
        yield results;
    }
}

/**
 * Process items sequentially with timing and progress tracking
 * @template T, R
 * @param {T[]} items - Items to process
 * @param {(item: T) => Promise<R>} processor - Async function to process each item
 * @param {Object} options - Processing options
 * @param {string} [options.operationName='Process item'] - Name of the operation for logging
 * @param {Object} [options.metadata={}] - Additional metadata to log
 * @returns {AsyncGenerator<R, void>} Generator yielding processed items
 */
export async function* processSequentially(items, processor, options = {}) {
    const {
        operationName = 'Process item',
        metadata = {}
    } = options;

    for (let i = 0; i < items.length; i++) {
        const result = await timer.time(
            `${operationName} ${i + 1}/${items.length}`,
            () => processor(items[i]),
            {
                progress: `${i + 1}/${items.length}`,
                ...metadata
            }
        );
        yield result;
    }
}

/**
 * Collect all results from an async generator
 * @template T
 * @param {AsyncGenerator<T>} generator - Generator to collect from
 * @returns {Promise<T[]>} Array of all results
 */
export async function collectResults(generator) {
    const results = [];
    for await (const result of generator) {
        results.push(result);
    }
    return results.flat();
}
