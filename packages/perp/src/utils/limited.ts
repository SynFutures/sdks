import LinkedList, { Node } from 'yallist';

/**
 * Blockable counter
 */
export class Counter {
    // TODO: maybe Number.MIN_SAFE_INTEGER?
    private _count = 0;
    private resolve?: () => void;
    private promise?: Promise<void>;

    get count() {
        return this._count;
    }

    private create() {
        this.promise = new Promise<void>((r) => (this.resolve = r));
    }

    private destroy() {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.resolve!();
        this.resolve = undefined;
        this.promise = undefined;
    }

    /**
     * Increase counter
     */
    increase(i = 1) {
        this._count += i;
        if (this._count - i === 0) {
            this.create();
        }
    }

    /**
     * Descrease counter
     */
    decrease(i = 1) {
        if (i > this._count) {
            i = this._count;
        }
        this._count -= i;
        if (this._count === 0) {
            this.destroy();
        }
    }

    /**
     * Wait until the counter reaches zero
     */
    wait() {
        return this.promise ?? Promise.resolve();
    }
}

export enum TokenStatus {
    Idle,
    Using,
}

// A Token represents a concurrent
export class Token {
    readonly limited: Limited;

    status: TokenStatus = TokenStatus.Idle;

    constructor(limited: Limited) {
        this.limited = limited;
    }
}

export enum RequestStatus {
    Queued,
    Finished,
    Canceled,
}

type RequestValue = {
    status: RequestStatus;
    resolve: (token: Token) => void;
    reject: (reason?: any) => void;
};

export type Request = Node<RequestValue>;

function toNode<T>(value: T) {
    return {
        prev: null,
        next: null,
        value,
    };
}

/**
 * Simple concurrency controller
 */
export class Limited {
    private readonly idle = LinkedList.create<Token>();
    private readonly queue = LinkedList.create<RequestValue>();
    private readonly maxTokens: number;
    private readonly maxQueued: number;
    private readonly counter = new Counter();

    /**
     * @param maxTokens Max number of tokens
     * @param maxQueued Max size of queue
     */
    constructor(maxTokens: number, maxQueued = Infinity) {
        for (let i = 0; i < maxTokens; i++) {
            this.idle.push(new Token(this));
        }
        this.maxTokens = maxTokens;
        this.maxQueued = maxQueued;
    }

    /**
     * Get the current number of concurrency
     */
    get parallels() {
        return this.counter.count;
    }

    /**
     * Get the currently available concurrency
     */
    get tokens() {
        return this.maxTokens - this.parallels;
    }

    /**
     * Get the currently queue size
     */
    get queued() {
        return this.queue.length;
    }

    /**
     * Get the currently available queue size
     */
    get available() {
        return this.maxQueued - this.queued;
    }

    /**
     * Get idle token
     * @returns A token promise and a request object
     */
    get(): { getToken: Promise<Token>; request?: Request } {
        if (this.idle.length > 0) {
            const token = this.idle.shift()!;
            token.status = TokenStatus.Using;
            this.counter.increase();
            return { getToken: Promise.resolve(token) };
        } else if (this.queue.length + 1 <= this.maxQueued) {
            let resolve!: (token: Token) => void;
            let reject!: (reason?: any) => void;
            const getToken = new Promise<Token>((_resolve, _reject) => {
                resolve = _resolve;
                reject = _reject;
            });
            const requestValue: RequestValue = {
                status: RequestStatus.Queued,
                resolve,
                reject,
            };
            const request = toNode(requestValue);
            this.queue.pushNode(request);
            return { getToken, request };
        } else {
            throw new Error('too many queued');
        }
    }

    /**
     * Get idle Token
     * @returns A token promise
     */
    getToken() {
        return this.get().getToken;
    }

    /**
     * Put back token
     * @param token Token object
     */
    put(token: Token) {
        if (token.limited !== this || token.status !== TokenStatus.Using) {
            throw new Error('invalid token');
        }
        if (this.queue.length > 0) {
            const request = this.queue.shift()!;
            request.status = RequestStatus.Finished;
            request.resolve(token);
        } else {
            token.status = TokenStatus.Idle;
            this.idle.push(token);
            this.counter.decrease();
        }
    }

    /**
     * Cancel request
     * @param request Request object
     * @param reason Cancel reason
     */
    cancel(request: Request, reason?: any) {
        if (request.list !== this.queue) {
            throw new Error('invalid request');
        }
        if (request.value.status !== RequestStatus.Queued) {
            return;
        }
        this.queue.removeNode(request);
        request.value.status = RequestStatus.Canceled;
        request.value.reject(reason);
    }

    /**
     * Wait until all tokens are put back
     */
    wait() {
        return this.counter.wait();
    }
}

/**
 * Get random integer between min and max
 * @param min Minimum
 * @param max Maximum
 * @returns Random integer
 */
export function getRandomIntInclusive(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (max < min) {
        throw new Error('The maximum value should be greater than the minimum value');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Execute multiple concurrent
 * @param array Array
 * @param fn Execution function
 * @param limit Concurrency limit
 * @returns Results
 */
export function limitedMap<T, U>(array: T[], fn: (t: T) => Promise<U>, limit: number): Promise<U[]> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise<U[]>(async (resolve, reject) => {
        let failed = false;
        const limited = new Limited(limit);
        const promises: Promise<U>[] = [];
        for (const element of array) {
            if (failed) {
                break;
            }

            const token = await limited.getToken();

            if (failed) {
                limited.put(token);
                break;
            }

            promises.push(
                fn(element)
                    .catch((err) => {
                        failed = true;
                        reject(err);
                    })
                    .finally(() => limited.put(token)) as Promise<U>,
            );
        }
        resolve(await Promise.all(promises));
    });
}
