import { Json } from '@metamask/utils';
import type {
  JsonRpcMessage,
  JsonRpcMiddleware,
  Next,
  ValidParam,
} from './JsonRpcEngine';

type ScaffoldMiddlewareHandler = Next<JsonRpcMessage<ValidParam>, Json> | Json;

/**
 * Creates a middleware function from an object of RPC method handler functions,
 * keyed to particular method names. If a method corresponding to a key of this
 * object is requested, this middleware will pass it to the corresponding
 * handler and return the result.
 *
 * @param handlers - The RPC method handler functions.
 * @returns The scaffold middleware function.
 */
export function createScaffoldMiddleware(handlers: {
  [methodName: string]: ScaffoldMiddlewareHandler;
}): JsonRpcMiddleware<JsonRpcMessage<ValidParam>, Json> {
  return ({
    next,
    request,
  }: {
    next: Next<JsonRpcMessage<ValidParam>, Json>;
    request: JsonRpcMessage<ValidParam>;
  }) => {
    const handler = handlers[request.method];
    // if no handler, return
    if (handler === undefined) {
      return next(request);
    }

    // if handler is fn, call as middleware
    if (typeof handler === 'function') {
      return handler(request);
    }
    return handler;
  };
}
