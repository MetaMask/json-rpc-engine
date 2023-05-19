import {
  Json,
  JsonRpcParams,
  JsonRpcRequest,
  PendingJsonRpcResponse,
} from '@metamask/utils';

import { JsonRpcMiddleware } from './JsonRpcEngine';

export type AsyncJsonRpcEngineNextCallback = () => Promise<void>;

export type AsyncJsonrpcMiddleware<
  Params extends JsonRpcParams,
  Result extends Json,
> = (
  request: JsonRpcRequest<Params>,
  response: PendingJsonRpcResponse<Result>,
  next: AsyncJsonRpcEngineNextCallback,
) => Promise<void>;

type ReturnHandlerCallback = (error: null | Error) => void;

/**
 * Originally, JsonRpcEngine could only accept synchronous middleware functions.
 * `createAsyncMiddleware` was created to enable consumers to pass in async
 * middleware functions.
 *
 * These async middleware have no `end` function. Instead, they `end` if they
 * return without calling `next`. Rather than passing in explicit return
 * handlers, async middleware can simply await `next`, and perform operations
 * on the response object when execution resumes.
 *
 * To accomplish this, `createAsyncMiddleware` passes the async middleware a
 * wrapped `next` function. That function calls the internal `JsonRpcEngine`
 * `next` function with a return handler that resolves a promise when called.
 *
 * The return handler will always be called. Its resolution of the promise
 * enables the control flow described above.
 *
 * @deprecated As of version 7.1.0, middleware functions can be asnync. This
 * should no longer be used.
 * @param asyncMiddleware - The asynchronous middleware function to wrap.
 * @returns The wrapped asynchronous middleware function, ready to be consumed
 * by JsonRpcEngine.
 */
export function createAsyncMiddleware<
  Params extends JsonRpcParams,
  Result extends Json,
>(
  asyncMiddleware: AsyncJsonrpcMiddleware<Params, Result>,
): JsonRpcMiddleware<Params, Result> {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return (request, response, next, end) => {
    // nextPromise is the key to the implementation
    // it is resolved by the return handler passed to the
    // "next" function
    let resolveNextPromise: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      resolveNextPromise = resolve;
    });

    let returnHandlerCallback: unknown = null;
    let nextWasCalled = false;
    let endWasCalled = false;

    // The control flow gets pretty messy in here, and we have to guard against
    // accidentally ending the request multiple times.
    // If this function weren't deprecated we probably wouldn't tolerate this.
    const innerEnd = (error: null | Error) => {
      if (!endWasCalled) {
        end(error);
      }
      endWasCalled = true;
    };

    // This will be called by the consumer's async middleware.
    const asyncNext = async () => {
      nextWasCalled = true;

      // We pass a return handler to next(). When it is called by the engine,
      // the consumer's async middleware will resume executing.
      // eslint-disable-next-line node/callback-return
      next((runReturnHandlersCallback) => {
        // This callback comes from JsonRpcEngine.#runReturnHandlers
        returnHandlerCallback = runReturnHandlersCallback;
        resolveNextPromise();
      });
      await nextPromise;
    };

    // We have to await the async middleware in order to process the return handler
    // and allow the engine to complete request handling.
    (async () => {
      try {
        await asyncMiddleware(request, response, asyncNext);

        if (nextWasCalled) {
          await nextPromise; // we must wait until the return handler is called
          (returnHandlerCallback as ReturnHandlerCallback)(null);
        } else {
          innerEnd(null);
        }
      } catch (error: any) {
        if (returnHandlerCallback) {
          (returnHandlerCallback as ReturnHandlerCallback)(error);
        } else {
          innerEnd(error);
        }
      }
    })()
      // This is mostly to make the linter happy. It should not be possible to
      // hit this in practice.
      .catch(
        /* istanbul ignore next */ (error) => {
          innerEnd(error);
        },
      );
  };
}
