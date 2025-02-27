import { SynfError } from './synfError';

export class ParamsEncodeError extends SynfError {
  readonly name: string = 'ParamsEncodeError';

  constructor(message: string, data: object) {
    const msg = message + `,invalid params is: ${JSON.stringify(data)}`;
    super(msg);
  }
}
