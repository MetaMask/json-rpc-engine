import SafeEventEmitter from '@metamask/safe-event-emitter';
import {
  hasProperty,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@metamask/utils';
import { errorCodes, EthereumRpcError, serializeError } from 'eth-rpc-errors';

export type PendingJsonRpcResponse<Result> = Omit<
  JsonRpcResponse<Result>,
  'error' | 'result'
> & {
  result?: Result;
  error?: JsonRpcError;
};

export type JsonRpcEngineCallbackError = Error | JsonRpcError | null;

export type JsonRpcEngineReturnHandler = (
  done: (error?: JsonRpcEngineCallbackError) => void,
) => void;

export type JsonRpcEngineNextCallback = (
  returnHandlerCallback?: JsonRpcEngineReturnHandler,
) => void;

export type JsonRpcEngineEndCallback = (
  error?: JsonRpcEngineCallbackError,
) => void;

export type JsonRpcMiddleware<Params, Result> = (
  req: JsonRpcRequest<Params>,
  res: PendingJsonRpcResponse<Result>,
  next: JsonRpcEngineNextCallback,
  end: JsonRpcEngineEndCallback,
) => void;

/**
 * A JSON-RPC request and response processor.
 * Give it a stack of middleware, pass it requests, and get back responses.
 */
export class JsonRpcEngine extends SafeEventEmitter {
  private _middleware: JsonRpcMiddleware<unknown, unknown>[];

  constructor() {
    super();
    this._middleware = [];
  }

  /**
   * Cleanup all middleware functions from the engine's middleware stack.
   */
  cleanup(): void {
    this._middleware.forEach((middleware: any) => {
      if (middleware.destroy && typeof middleware.destroy === 'function') {
        middleware.destroy();
      }
    });
    this._middleware = [];
  }

  /**
   * Add a middleware function to the engine's middleware stack.
   *
   * @param middleware - The middleware function to add.
   */
  push<Params, Result>(middleware: JsonRpcMiddleware<Params, Result>): void {
    this._middleware.push(middleware as JsonRpcMiddleware<unknown, unknown>);
  }

  /**
   * Handle a JSON-RPC request, and return a response.
   *
   * @param request - The request to handle.
   * @param callback - An error-first callback that will receive the response.
   */
  handle<Params, Result>(
    request: JsonRpcRequest<Params>,
    callback: (error: unknown, response: JsonRpcResponse<Result>) => void,
  ): void;

  /**
   * Handle an array of JSON-RPC requests, and return an array of responses.
   *
   * @param request - The requests to handle.
   * @param callback - An error-first callback that will receive the array of
   * responses.
   */
  handle<Params, Result>(
    requests: JsonRpcRequest<Params>[],
    callback: (error: unknown, responses: JsonRpcResponse<Result>[]) => void,
  ): void;

  /**
   * Handle a JSON-RPC request, and return a response.
   *
   * @param request - The JSON-RPC request to handle.
   * @returns The JSON-RPC response.
   */
  handle<Params, Result>(
    request: JsonRpcRequest<Params>,
  ): Promise<JsonRpcResponse<Result>>;

  /**
   * Handle an array of JSON-RPC requests, and return an array of responses.
   *
   * @param request - The JSON-RPC requests to handle.
   * @returns An array of JSON-RPC responses.
   */
  handle<Params, Result>(
    requests: JsonRpcRequest<Params>[],
  ): Promise<JsonRpcResponse<Result>[]>;

  handle(req: unknown, callback?: any) {
    if (callback && typeof callback !== 'function') {
      throw new Error('"callback" must be a function if provided.');
    }

    if (Array.isArray(req)) {
      if (callback) {
        return this._handleBatch(req, callback);
      }
      return this._handleBatch(req);
    }

    if (callback) {
      return this._handle(req as JsonRpcRequest<unknown>, callback);
    }
    return this._promiseHandle(req as JsonRpcRequest<unknown>);
  }

  /**
   * Returns this engine as a middleware function that can be pushed to other
   * engines.
   *
   * @returns This engine as a middleware function.
   */
  asMiddleware(): JsonRpcMiddleware<unknown, unknown> {
    return async (req, res, next, end) => {
      try {
        const [middlewareError, isComplete, returnHandlers] =
          await JsonRpcEngine._runAllMiddleware(req, res, this._middleware);

        if (isComplete) {
          await JsonRpcEngine._runReturnHandlers(returnHandlers);
          return end(middlewareError as JsonRpcEngineCallbackError);
        }

        return next(async (handlerCallback) => {
          try {
            await JsonRpcEngine._runReturnHandlers(returnHandlers);
          } catch (error) {
            return handlerCallback(error);
          }
          return handlerCallback();
        });
      } catch (error) {
        return end(error);
      }
    };
  }

  /**
   * Like _handle, but for batch requests.
   */
  private _handleBatch(
    reqs: JsonRpcRequest<unknown>[],
  ): Promise<JsonRpcResponse<unknown>[]>;

  /**
   * Like _handle, but for batch requests.
   */
  private _handleBatch(
    reqs: JsonRpcRequest<unknown>[],
    callback: (error: unknown, responses?: JsonRpcResponse<unknown>[]) => void,
  ): Promise<void>;

  /**
   * Handles a batch of JSON-RPC requests, either in `async` or callback
   * fashion.
   *
   * @param reqs - The request objects to process.
   * @param callback - The completion callback.
   * @returns The array of responses, or nothing if a callback was specified.
   */
  private async _handleBatch(
    reqs: JsonRpcRequest<unknown>[],
    callback?: (error: unknown, responses?: JsonRpcResponse<unknown>[]) => void,
  ): Promise<JsonRpcResponse<unknown>[] | void> {
    // The order here is important
    try {
      // 2. Wait for all requests to finish, or throw on some kind of fatal
      // error
      const responses = await Promise.all(
        // 1. Begin executing each request in the order received
        reqs.map(this._promiseHandle.bind(this)),
      );

      // 3. Return batch response
      if (callback) {
        return callback(null, responses);
      }
      return responses;
    } catch (error) {
      if (callback) {
        return callback(error);
      }

      throw error;
    }
  }

  /**
   * A promise-wrapped _handle.
   *
   * @param req - The JSON-RPC request.
   * @returns The JSON-RPC response.
   */
  private _promiseHandle(
    req: JsonRpcRequest<unknown>,
  ): Promise<JsonRpcResponse<unknown>> {
    return new Promise((resolve) => {
      this._handle(req, (_err, res) => {
        // There will always be a response, and it will always have any error
        // that is caught and propagated.
        resolve(res);
      });
    });
  }

  /**
   * Ensures that the request object is valid, processes it, and passes any
   * error and the response object to the given callback.
   *
   * Does not reject.
   *
   * @param callerReq - The request object from the caller.
   * @param callback - The callback function.
   * @returns Nothing.
   */
  private async _handle(
    callerReq: JsonRpcRequest<unknown>,
    callback: (error: unknown, response: JsonRpcResponse<unknown>) => void,
  ): Promise<void> {
    if (
      !callerReq ||
      Array.isArray(callerReq) ||
      typeof callerReq !== 'object'
    ) {
      const error = new EthereumRpcError(
        errorCodes.rpc.invalidRequest,
        `Requests must be plain objects. Received: ${typeof callerReq}`,
        { request: callerReq },
      );
      return callback(error, { id: null, jsonrpc: '2.0', error });
    }

    if (typeof callerReq.method !== 'string') {
      const error = new EthereumRpcError(
        errorCodes.rpc.invalidRequest,
        `Must specify a string method. Received: ${typeof callerReq.method}`,
        { request: callerReq },
      );
      return callback(error, { id: callerReq.id, jsonrpc: '2.0', error });
    }

    const req: JsonRpcRequest<unknown> = { ...callerReq };
    const res: PendingJsonRpcResponse<unknown> = {
      id: req.id,
      jsonrpc: req.jsonrpc,
    };
    let error: JsonRpcEngineCallbackError = null;

    try {
      await this._processRequest(req, res);
    } catch (_error) {
      // A request handler error, a re-thrown middleware error, or something
      // unexpected.
      error = _error;
    }

    if (error) {
      // Ensure no result is present on an errored response
      delete res.result;
      if (!res.error) {
        res.error = serializeError(error);
      }
    }

    return callback(error, res as JsonRpcResponse<unknown>);
  }

  /**
   * For the given request and response, runs all middleware and their return
   * handlers, if any, and ensures that internal request processing semantics
   * are satisfied.
   *
   * @param req - The request object.
   * @param res - The response object.
   */
  private async _processRequest(
    req: JsonRpcRequest<unknown>,
    res: PendingJsonRpcResponse<unknown>,
  ): Promise<void> {
    const [error, isComplete, returnHandlers] =
      await JsonRpcEngine._runAllMiddleware(req, res, this._middleware);

    // Throw if "end" was not called, or if the response has neither a result
    // nor an error.
    JsonRpcEngine._checkForCompletion(req, res, isComplete);

    // The return handlers should run even if an error was encountered during
    // middleware processing.
    await JsonRpcEngine._runReturnHandlers(returnHandlers);

    // Now we re-throw the middleware processing error, if any, to catch it
    // further up the call chain.
    if (error) {
      throw error;
    }
  }

  /**
   * Serially executes the given stack of middleware.
   *
   * @param req - The request object.
   * @param res - The response object.
   * @param middlewareStack - The stack of middleware functions to execute.
   * @returns An array of any error encountered during middleware execution,
   * a boolean indicating whether the request was completed, and an array of
   * middleware-defined return handlers.
   */
  private static async _runAllMiddleware(
    req: JsonRpcRequest<unknown>,
    res: PendingJsonRpcResponse<unknown>,
    middlewareStack: JsonRpcMiddleware<unknown, unknown>[],
  ): Promise<
    [
      unknown, // error
      boolean, // isComplete
      JsonRpcEngineReturnHandler[],
    ]
  > {
    const returnHandlers: JsonRpcEngineReturnHandler[] = [];
    let error = null;
    let isComplete = false;

    // Go down stack of middleware, call and collect optional returnHandlers
    for (const middleware of middlewareStack) {
      [error, isComplete] = await JsonRpcEngine._runMiddleware(
        req,
        res,
        middleware,
        returnHandlers,
      );

      if (isComplete) {
        break;
      }
    }
    return [error, isComplete, returnHandlers.reverse()];
  }

  /**
   * Runs an individual middleware function.
   *
   * @param req - The request object.
   * @param res - The response object.
   * @param middleware - The middleware function to execute.
   * @param returnHandlers - The return handlers array for the current request.
   * @returns An array of any error encountered during middleware exection,
   * and a boolean indicating whether the request should end.
   */
  private static _runMiddleware(
    req: JsonRpcRequest<unknown>,
    res: PendingJsonRpcResponse<unknown>,
    middleware: JsonRpcMiddleware<unknown, unknown>,
    returnHandlers: JsonRpcEngineReturnHandler[],
  ): Promise<[unknown, boolean]> {
    return new Promise((resolve) => {
      const end: JsonRpcEngineEndCallback = (err?: unknown) => {
        const error = err || res.error;
        if (error) {
          res.error = serializeError(error);
        }
        // True indicates that the request should end
        resolve([error, true]);
      };

      const next: JsonRpcEngineNextCallback = (
        returnHandler?: JsonRpcEngineReturnHandler,
      ) => {
        if (res.error) {
          end(res.error);
        } else {
          if (returnHandler) {
            if (typeof returnHandler !== 'function') {
              end(
                new EthereumRpcError(
                  errorCodes.rpc.internal,
                  `JsonRpcEngine: "next" return handlers must be functions. ` +
                    `Received "${typeof returnHandler}" for request:\n${jsonify(
                      req,
                    )}`,
                  { request: req },
                ),
              );
            }
            returnHandlers.push(returnHandler);
          }

          // False indicates that the request should not end
          resolve([null, false]);
        }
      };

      try {
        middleware(req, res, next, end);
      } catch (error) {
        end(error);
      }
    });
  }

  /**
   * Serially executes array of return handlers. The request and response are
   * assumed to be in their scope.
   *
   * @param handlers - The return handlers to execute.
   */
  private static async _runReturnHandlers(
    handlers: JsonRpcEngineReturnHandler[],
  ): Promise<void> {
    for (const handler of handlers) {
      await new Promise<void>((resolve, reject) => {
        handler((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  /**
   * Throws an error if the response has neither a result nor an error, or if
   * the "isComplete" flag is falsy.
   *
   * @param req - The request object.
   * @param res - The response object.
   * @param isComplete - Boolean from {@link JsonRpcEngine._runAllMiddleware}
   * indicating whether a middleware ended the request.
   */
  private static _checkForCompletion(
    req: JsonRpcRequest<unknown>,
    res: PendingJsonRpcResponse<unknown>,
    isComplete: boolean,
  ): void {
    if (!hasProperty(res, 'result') && !hasProperty(res, 'error')) {
      throw new EthereumRpcError(
        errorCodes.rpc.internal,
        `JsonRpcEngine: Response has no error or result for request:\n${jsonify(
          req,
        )}`,
        { request: req },
      );
    }

    if (!isComplete) {
      throw new EthereumRpcError(
        errorCodes.rpc.internal,
        `JsonRpcEngine: Nothing ended request:\n${jsonify(req)}`,
        { request: req },
      );
    }
  }
}

/**
 * JSON-stringifies a request object.
 *
 * @param request - The request object to JSON-stringify.
 * @returns The JSON-stringified request object.
 */
function jsonify(request: JsonRpcRequest<unknown>): string {
  return JSON.stringify(request, null, 2);
}
