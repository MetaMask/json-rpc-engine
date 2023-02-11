import { Json } from '@metamask/utils';
import type {
  JsonRpcEngine,
  JsonRpcMessage,
  Next,
  ValidParam,
} from './JsonRpcEngine';

/**
 * Return a JSON-RPC engine as middleware.
 *
 * @param engine - The JSON-RPC engine.
 * @returns A JSON-RPC middleware function that will run the given engine.
 */
export function engineAsMiddleware(
  engine: JsonRpcEngine<JsonRpcMessage<ValidParam>, Json>,
) {
  return ({
    next,
    request,
  }: {
    next: Next<JsonRpcMessage<ValidParam>, Json>;
    request: JsonRpcMessage<ValidParam>;
  }) => {
    return engine.handle(request, { next });
  };
}
