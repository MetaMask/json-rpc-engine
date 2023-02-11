import type { Json } from '@metamask/utils';
import { JsonRpcEngine, JsonRpcMiddleware } from './JsonRpcEngine';
import { engineAsMiddleware } from './engineAsMiddleware';
import type { JsonRpcMessage, ValidParam } from './JsonRpcEngine';

type OneOrMore<T> = [T, ...T[]];

/**
 * Type guard for ensuring an array has at least one element.
 * TODO: Migrate to utils.
 *
 * @param list - The array to check.
 * @returns Whether the array has at least one element.
 */
function hasOneOrMore<T>(list: T[]): list is OneOrMore<T> {
  return list.length >= 1;
}

/**
 * Takes a stack of middleware and joins them into a single middleware function.
 *
 * @param middleware - The middleware stack to merge.
 * @returns The merged middleware function.
 */
export function mergeMiddleware(
  middleware: JsonRpcMiddleware<JsonRpcMessage<ValidParam>, Json>[],
) {
  if (!hasOneOrMore(middleware)) {
    return middleware;
  }
  const engine = new JsonRpcEngine({
    middleware,
  });
  return engineAsMiddleware(engine);
}
