class APIStats {
    constructor() {
        this.reset();
    }

    reset() {
        this.stats = {
            totalCalls: 0,
            callsByFunction: {},
            totalTokens: 0,
            estimatedCost: 0,
            startTime: Date.now(),
            endTime: null
        };
    }

    recordCall(functionName, tokens = 0, cost = 0) {
        this.stats.totalCalls++;
        this.stats.totalTokens += tokens;
        this.stats.estimatedCost += cost;
        
        if (!this.stats.callsByFunction[functionName]) {
            this.stats.callsByFunction[functionName] = {
                calls: 0,
                tokens: 0,
                cost: 0
            };
        }
        
        this.stats.callsByFunction[functionName].calls++;
        this.stats.callsByFunction[functionName].tokens += tokens;
        this.stats.callsByFunction[functionName].cost += cost;
    }

    endSession() {
        this.stats.endTime = Date.now();
    }

    getReport() {
        const duration = (this.stats.endTime || Date.now()) - this.stats.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = ((duration % 60000) / 1000).toFixed(1);

        let report = '\n=== OpenAI API Usage Report ===\n';
        report += `Duration: ${minutes}m ${seconds}s\n`;
        report += `Total API Calls: ${this.stats.totalCalls}\n`;
        report += `Total Tokens Used: ${this.stats.totalTokens}\n`;
        report += `Estimated Cost: $${this.stats.estimatedCost.toFixed(4)}\n\n`;
        
        report += 'Breakdown by Function:\n';
        for (const [func, stats] of Object.entries(this.stats.callsByFunction)) {
            report += `${func}:\n`;
            report += `  - Calls: ${stats.calls}\n`;
            report += `  - Tokens: ${stats.tokens}\n`;
            report += `  - Cost: $${stats.cost.toFixed(4)}\n`;
        }
        
        return report;
    }
}

export const apiStats = new APIStats();
