import { SynfError } from './synfError';

export class CalculationError extends SynfError {
  readonly name: string = 'CalculationError';

  constructor(message: string, data: object) {
    const msg = message + `,invalid params is: ${JSON.stringify(data)}`;
    super(msg);
  }
}
