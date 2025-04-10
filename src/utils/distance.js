/**
 * Calculates the covariance matrix for a set of vectors
 * @param {number[][]} vectors - Array of vectors
 * @returns {number[][]} Covariance matrix
 */
function calculateCovarianceMatrix(vectors) {
    const n = vectors.length;
    const dim = vectors[0].length;
    
    // Calculate means for each dimension
    const means = new Array(dim).fill(0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < dim; j++) {
            means[j] += vectors[i][j];
        }
    }
    for (let j = 0; j < dim; j++) {
        means[j] /= n;
    }
    
    // Calculate covariance matrix
    const covariance = Array(dim).fill().map(() => Array(dim).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < dim; j++) {
            for (let k = 0; k < dim; k++) {
                covariance[j][k] += (vectors[i][j] - means[j]) * (vectors[i][k] - means[k]);
            }
        }
    }
    
    // Normalize and add regularization term for numerical stability
    const epsilon = 1e-6;
    for (let j = 0; j < dim; j++) {
        for (let k = 0; k < dim; k++) {
            covariance[j][k] = covariance[j][k] / (n - 1) + (j === k ? epsilon : 0);
        }
    }
    
    return covariance;
}

/**
 * Inverts a matrix using Gaussian elimination
 * @param {number[][]} matrix - Square matrix to invert
 * @returns {number[][]} Inverted matrix
 */
function invertMatrix(matrix) {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => {
        const augRow = new Array(2 * n).fill(0);
        for (let j = 0; j < n; j++) {
            augRow[j] = row[j];
            augRow[j + n] = i === j ? 1 : 0;
        }
        return augRow;
    });
    
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
        let pivot = augmented[i][i];
        if (Math.abs(pivot) < 1e-10) {
            throw new Error("Matrix is singular or nearly singular");
        }
        
        // Normalize row i
        for (let j = 0; j < 2 * n; j++) {
            augmented[i][j] /= pivot;
        }
        
        // Eliminate column i from all other rows
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = augmented[k][i];
                for (let j = 0; j < 2 * n; j++) {
                    augmented[k][j] -= factor * augmented[i][j];
                }
            }
        }
    }
    
    // Extract the inverse matrix
    return augmented.map(row => row.slice(n));
}

/**
 * Calculates the Mahalanobis distance between two vectors
 * @param {number[]} v1 - First vector
 * @param {number[]} v2 - Second vector
 * @param {number[][]} invCov - Inverse of covariance matrix
 * @returns {number} Mahalanobis distance
 */
function mahalanobisDistance(v1, v2, invCov) {
    const diff = v1.map((val, i) => val - v2[i]);
    let distance = 0;
    
    for (let i = 0; i < diff.length; i++) {
        for (let j = 0; j < diff.length; j++) {
            distance += diff[i] * invCov[i][j] * diff[j];
        }
    }
    
    return Math.sqrt(Math.max(0, distance)); // Ensure non-negative due to numerical precision
}

export { calculateCovarianceMatrix, invertMatrix, mahalanobisDistance };
