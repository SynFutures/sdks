import { SynfError } from './synfError';

export class SimulationError extends SynfError {
  readonly name: string = 'SimulationError';

  constructor(message: string) {
    super(message);
  }
}
