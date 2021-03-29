import { Json, JsonRpcMiddleware, JsonRpcSuccess } from './JsonRpcEngine';

type ScaffoldMiddlewareHandler<T, U> = JsonRpcMiddleware<T, U> | Json;

export function createScaffoldMiddleware(handlers: {
  [methodName: string]: ScaffoldMiddlewareHandler<unknown, unknown>;
}): JsonRpcMiddleware<unknown, unknown> {
  return (req, res, end) => {
    const handler = handlers[req.method];
    // if no handler, return
    if (handler === undefined) {
      return undefined;
    }
    // if handler is fn, call as middleware
    if (typeof handler === 'function') {
      return handler(req, res, end);
    }
    // if handler is some other value, use as result
    (res as JsonRpcSuccess<unknown>).result = handler;
    return end();
  };
}
