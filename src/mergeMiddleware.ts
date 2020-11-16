import { JsonRpcEngine, JsonRpcMiddleware } from './JsonRpcEngine';

export function mergeMiddleware(middlewareStack: JsonRpcMiddleware[]) {
  const engine = new JsonRpcEngine();
  middlewareStack.forEach((middleware) => engine.push(middleware));
  return engine.asMiddleware();
}
