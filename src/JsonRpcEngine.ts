import SafeEventEmitter from '@metamask/safe-event-emitter';
import { errorCodes, EthereumRpcError, serializeError } from 'eth-rpc-errors';

type Maybe<T> = Partial<T> | null | undefined;

export type Json =
  | boolean
  | number
  | string
  | null
  | { [property: string]: Json }
  | Json[];

/**
 * A String specifying the version of the JSON-RPC protocol.
 * MUST be exactly "2.0".
 */
export type JsonRpcVersion = '2.0';

/**
 * An identifier established by the Client that MUST contain a String, Number,
 * or NULL value if included. If it is not included it is assumed to be a
 * notification. The value SHOULD normally not be Null and Numbers SHOULD
 * NOT contain fractional parts.
 */
export type JsonRpcId = number | string | void;

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
  stack?: string;
}

export interface JsonRpcRequest<T> {
  jsonrpc: JsonRpcVersion;
  method: string;
  id: JsonRpcId;
  params?: T;
}

export interface JsonRpcNotification<T> {
  jsonrpc: JsonRpcVersion;
  method: string;
  params?: T;
}

interface JsonRpcResponseBase {
  jsonrpc: JsonRpcVersion;
  id: JsonRpcId;
}

export interface JsonRpcSuccess<T> extends JsonRpcResponseBase {
  result: Maybe<T>;
}

export interface JsonRpcFailure extends JsonRpcResponseBase {
  error: JsonRpcError;
}

export type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

export type JsonRpcEngineCallbackError = Error | JsonRpcError | null;

export type JsonRpcEngineReturnHandler = (
  done: (error?: JsonRpcEngineCallbackError) => void
) => void;

export type JsonRpcEngineNextCallback = (
  returnHandlerCallback?: JsonRpcEngineReturnHandler
) => void;

export type JsonRpcEngineEndCallback = (
  error?: JsonRpcEngineCallbackError
) => void;

export type JsonRpcMiddleware<T, U> = (
  req: JsonRpcRequest<T>,
  res: JsonRpcResponse<U>,
  next: JsonRpcEngineNextCallback,
  end: JsonRpcEngineEndCallback
) => void;

interface InternalJsonRpcResponse extends JsonRpcResponseBase {
  result?: unknown;
  error?: Error | JsonRpcError;
}

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
   * Add a middleware function to the engine's middleware stack.
   *
   * @param middleware - The middleware function to add.
   */
  push<T, U>(middleware: JsonRpcMiddleware<T, U>): void {
    this._middleware.push(middleware as JsonRpcMiddleware<unknown, unknown>);
  }

  /**
   * Handle a JSON-RPC request, and return a response.
   *
   * @param request - The request to handle.
   * @param callback - An error-first callback that will receive the response.
   */
  handle<T, U>(
    request: JsonRpcRequest<T>,
    callback: (error: unknown, response: JsonRpcResponse<U>) => void,
  ): void;

  /**
   * Handle an array of JSON-RPC requests, and return an array of responses.
   *
   * @param request - The requests to handle.
   * @param callback - An error-first callback that will receive the array of
   * responses.
   */
  handle<T, U>(
    requests: JsonRpcRequest<T>[],
    callback: (error: unknown, responses: JsonRpcResponse<U>[]) => void,
  ): void;

  /**
   * Handle a JSON-RPC request, and return a response.
   *
   * @param request - The request to handle.
   * @returns A promise that resolves with the response, or rejects with an
   * error.
   */
  handle<T, U>(request: JsonRpcRequest<T>): Promise<JsonRpcResponse<U>>;

  /**
   * Handle an array of JSON-RPC requests, and return an array of responses.
   *
   * @param request - The requests to handle.
   * @returns A promise that resolves with the array of responses, or rejects
   * with an error.
   */
  handle<T, U>(requests: JsonRpcRequest<T>[]): Promise<JsonRpcResponse<U>[]>;

  handle(req: unknown, cb?: any) {
    if (cb && typeof cb !== 'function') {
      throw new Error('"callback" must be a function if provided.');
    }

    if (Array.isArray(req)) {
      if (cb) {
        this._handleBatch(req)
          .then((res) => cb(null, res as JsonRpcResponse<unknown>[]))
          .catch((err) => cb(err)); // fatal error
        return undefined;
      }
      return this._handleBatch(req);
    }

    if (cb) {
      return this._handle(req as JsonRpcRequest<unknown>, cb);
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
    return (req, res, next, end) => {
      JsonRpcEngine._runAllMiddleware(req, res, this._middleware)
        .then(
          async ([middlewareError, isComplete, returnHandlers]) => {
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
          },
        )
        .catch((error) => {
          end(error);
        });
    };
  }

  private async _handleBatch(
    reqs: JsonRpcRequest<unknown>[],
  ): Promise<JsonRpcResponse<unknown>[]> {
    // The order here is important
    // 3. Return batch response, or reject on some kind of fatal error
    return await Promise.all(
      // 2. Wait for all requests to finish
      // 1. Begin executing each request in the order received
      reqs.map(this._promiseHandle.bind(this)),
    );
  }

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

  private async _handle(
    callerReq: JsonRpcRequest<unknown>,
    cb: (error: unknown, response: JsonRpcResponse<unknown>) => void,
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
      return cb(error, { id: undefined, jsonrpc: '2.0', error });
    }

    if (typeof callerReq.method !== 'string') {
      const error = new EthereumRpcError(
        errorCodes.rpc.invalidRequest,
        `Must specify a string method. Received: ${typeof callerReq.method}`,
        { request: callerReq },
      );
      return cb(error, { id: callerReq.id, jsonrpc: '2.0', error });
    }

    const req: JsonRpcRequest<unknown> = { ...callerReq };
    const res: InternalJsonRpcResponse = {
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

    return cb(error, res as JsonRpcResponse<unknown>);
  }

  private async _processRequest(
    req: JsonRpcRequest<unknown>,
    res: InternalJsonRpcResponse,
  ): Promise<void> {
    const [
      error,
      isComplete,
      returnHandlers,
    ] = await JsonRpcEngine._runAllMiddleware(req, res, this._middleware);

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
   * Walks down internal stack of middleware.
   */
  private static async _runAllMiddleware(
    req: JsonRpcRequest<unknown>,
    res: InternalJsonRpcResponse,
    middlewareStack: JsonRpcMiddleware<unknown, unknown>[],
  ): Promise<[
      unknown, // error
      boolean, // isComplete
      JsonRpcEngineReturnHandler[],
    ]> {
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
   * Runs an individual middleware.
   * @returns An array of a boolean indicating whether the request should end,
   * and any error encountered during request processing.
   */
  private static _runMiddleware(
    req: JsonRpcRequest<unknown>,
    res: InternalJsonRpcResponse,
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
              end(new EthereumRpcError(
                errorCodes.rpc.internal,
                `JsonRpcEngine: "next" return handlers must be functions. ` +
                `Received "${typeof returnHandler}" for request:\n${jsonify(req)}`,
                { request: req },
              ));
            }
            returnHandlers.push(returnHandler);
          }

          // False indicates that the request should not end
          resolve([null, false]);
        }
      };

      try {
        middleware(req, res as JsonRpcResponse<unknown>, next, end);
      } catch (error) {
        end(error);
      }
    });
  }

  private static async _runReturnHandlers(
    handlers: JsonRpcEngineReturnHandler[],
  ): Promise<void> {
    for (const handler of handlers) {
      await new Promise((resolve, reject) => {
        handler((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  private static _checkForCompletion(
    req: JsonRpcRequest<unknown>,
    res: InternalJsonRpcResponse,
    isComplete: boolean,
  ): void {
    if (!('result' in res) && !('error' in res)) {
      throw new EthereumRpcError(
        errorCodes.rpc.internal,
        `JsonRpcEngine: Response has no error or result for request:\n${jsonify(req)}`,
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

function jsonify(request: JsonRpcRequest<unknown>): string {
  return JSON.stringify(request, null, 2);
}
