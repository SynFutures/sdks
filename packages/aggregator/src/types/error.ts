/**
 * Error thrown when calculation fails
 */
export class CalculationError extends Error {
    constructor(message: string, details?: Record<string, unknown>) {
        const suffix = details ? ` | details: ${JSON.stringify(details)}` : '';
        super(`${message}${suffix}`);
        this.name = 'CalculationError';
    }
}