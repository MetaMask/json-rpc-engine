import { errorCodes, EthereumRpcError } from 'eth-rpc-errors';
import {
  isJsonRpcRequest,
  Json,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from '@metamask/utils';

export type JsonRpcMessage<Params extends ValidParam> =
  | JsonRpcRequest<Params>
  | JsonRpcNotification<Params>;

export type Next<
  Request extends JsonRpcMessage<ValidParam>,
  Result extends Json,
> = (request: Request) => Promise<Result | void>;

export type JsonRpcMiddleware<
  Request extends JsonRpcMessage<ValidParam>,
  Result extends Json,
> = ({
  request,
  context,
  next,
}: {
  request: Request;
  context: Record<string, unknown>;
  next: Next<Request, Result>;
}) => Promise<Result | void> | Result | void;

export type ValidParam = Json[] | { [prop: string]: Json };

type OneOrMore<T> = [T, ...T[]];

/**
 * A type guard for ensuring an object has a property.
 * TODO: Migrate to utils.
 *
 * @param objectToCheck - The object to check.
 * @param name - The property name to check for.
 * @returns Whether the specified object has an own property with the specified
 * name, regardless of whether it is enumerable or not.
 */
export const hasProperty = <
  // eslint-disable-next-line @typescript-eslint/ban-types
  ObjectToCheck extends Object,
  Property extends string | number | symbol,
>(
  objectToCheck: ObjectToCheck,
  name: Property,
): objectToCheck is ObjectToCheck & Record<Property, unknown> =>
  Object.hasOwnProperty.call(objectToCheck, name);

/**
 * A JSON-RPC request and response processor.
 * Give it a stack of middleware, pass it requests, and get back responses.
 */
export class JsonRpcEngine<
  Request extends JsonRpcMessage<ValidParam>,
  Result extends Json,
> {
  #middleware: OneOrMore<JsonRpcMiddleware<Request, Result>>;

  /**
   * Constructs a {@link JsonRpcEngine} instance.
   *
   * @param options - Options bag.
   * @param options.middleware - The middleware stack.
   */
  constructor({
    middleware,
  }: {
    middleware: OneOrMore<JsonRpcMiddleware<Request, Result>>;
  }) {
    this.#middleware = middleware;
  }

  /**
   * Handle a JSON-RPC notification. No response will be returned.
   *
   * @param message - The JSON-RPC notification to handle.
   * @param options - Options.
   * @param options.next - An additional middleware function to run at the end of the stack. Used
   * primarily for integrating this engine into other engines as middleware.
   * @returns The JSON-RPC response.
   */
  async handle(
    message: JsonRpcNotification<ValidParam> & Request,
    options?: {
      next?: Next<JsonRpcMessage<ValidParam>, Result>;
    },
  ): Promise<void>;

  /**
   * Handle a JSON-RPC request that is not a notification. A response will be returned.
   *
   * @param message - The non-notification JSON-RPC request to handle.
   * @param options - Options.
   * @param options.next - An additional middleware function to run at the end of the stack. Used
   * primarily for integrating this engine into other engines as middleware.
   * @returns The JSON-RPC response.
   */
  async handle(
    message: JsonRpcRequest<ValidParam> & Request,
    options?: {
      next?: Next<JsonRpcMessage<ValidParam>, Result>;
    },
  ): Promise<JsonRpcResponse<Result>>;

  /**
   * Handle a JSON-RPC request. A response will be returned unless this request is a notification.
   *
   * @param message - The JSON-RPC message to handle.
   * @param options - Options.
   * @param options.next - An additional middleware function to run at the end of the stack. Used
   * primarily for integrating this engine into other engines as middleware.
   * @returns The JSON-RPC response.
   */
  async handle(
    message: Request,
    {
      next,
    }: {
      next?: Next<Request, Result>;
    } = {},
  ): Promise<JsonRpcResponse<Result> | void> {
    const context = {};
    const firstMiddleware = this.#middleware[0];

    try {
      const result = await firstMiddleware({
        request: message,
        context,
        next: this.#getNext({ context, index: 1, lastNext: next }),
      });

      if (isJsonRpcRequest(message) && result !== undefined) {
        return {
          id: message.id,
          jsonrpc: '2.0' as const,
          result,
        };
      }
      return undefined;
    } catch (error) {
      if (error instanceof Error) {
        if (hasProperty(error, 'code')) {
          throw error;
        } else {
          throw new EthereumRpcError(
            errorCodes.rpc.internal,
            `JsonRpcEngine: Internal error '${error.message}'`,
            { error },
          );
        }
      }
      throw new EthereumRpcError(
        errorCodes.rpc.internal,
        `JsonRpcEngine: Internal non-Error thrown`,
        { error },
      );
    }
  }

  #getNext<Index extends number>({
    context,
    index,
    lastNext,
  }: {
    context: Record<string, unknown>;
    index: Index;
    lastNext?: Next<Request, Result>;
  }): Next<Request, Result> {
    if (index === this.#middleware.length) {
      if (lastNext) {
        // TODO: throw error if result returned for notification
        return lastNext;
      }

      return async (unhandledRequest: Request) => {
        throw new EthereumRpcError(
          errorCodes.rpc.internal,
          `JsonRpcEngine: Nothing ended request:\n${jsonify(unhandledRequest)}`,
          { request: unhandledRequest },
        );
      };
    }

    return async (nextRequest: Request) => {
      // TODO: throw error if result returned for notification
      return await this.#middleware[index]({
        request: nextRequest,
        context,
        next: this.#getNext({ context, index: index + 1 }),
      });
    };
  }
}

/**
 * JSON-stringifies a request object.
 *
 * @param request - The request object to JSON-stringify.
 * @returns The JSON-stringified request object.
 */
function jsonify(request: JsonRpcMessage<ValidParam>): string {
  return JSON.stringify(request, null, 2);
}
