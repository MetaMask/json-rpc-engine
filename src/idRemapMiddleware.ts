import { isJsonRpcRequest } from '@metamask/utils';
import type { Json } from '@metamask/utils';
import { getUniqueId } from './getUniqueId';
import type {
  JsonRpcMiddleware,
  JsonRpcMessage,
  Next,
  ValidParam,
} from './JsonRpcEngine';

/**
 * Returns a middleware function that overwrites the `id` property of each
 * request with an ID that is guaranteed to be unique, and restores the original
 * ID in a return handler.
 *
 * If used, should be the first middleware in the stack.
 *
 * @returns The ID remap middleware function.
 */
export function createIdRemapMiddleware(): JsonRpcMiddleware<
  JsonRpcMessage<ValidParam>,
  Json
> {
  return async ({
    next,
    request,
  }: {
    next: Next<JsonRpcMessage<ValidParam>, Json>;
    request: JsonRpcMessage<ValidParam>;
  }) => {
    if (!isJsonRpcRequest(request)) {
      return next(request);
    }
    const originalId = request.id;
    const newId = getUniqueId();
    request.id = newId;

    try {
      return await next(request);
    } finally {
      // Ignoring this lint rule because we want to reassign the original id here regardless of
      // how the request has been mutated.
      // eslint-disable-next-line require-atomic-updates
      request.id = originalId;
    }
  };
}
