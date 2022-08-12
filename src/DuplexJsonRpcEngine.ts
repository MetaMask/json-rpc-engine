import {
  isJsonRpcRequest,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@metamask/utils';
import {
  JsonRpcEngine,
  JsonRpcMiddleware,
  JsonRpcNotificationHandler,
} from './JsonRpcEngine';

type HandleArgument =
  | JsonRpcRequest<unknown>
  | JsonRpcNotification<unknown>
  | (JsonRpcRequest<unknown> | JsonRpcNotification<unknown>)[];

interface DuplexJsonRpcEngineArgs {
  receiverNotificationHandler: JsonRpcNotificationHandler<unknown>;
  senderNotificationHandler: JsonRpcNotificationHandler<unknown>;
}

export class DuplexJsonRpcEngine {
  readonly #receiver: JsonRpcEngine;

  readonly #sender: JsonRpcEngine;

  get receiver(): JsonRpcEngine {
    return this.#receiver;
  }

  get sender(): JsonRpcEngine {
    return this.#sender;
  }

  constructor({
    receiverNotificationHandler,
    senderNotificationHandler,
  }: DuplexJsonRpcEngineArgs) {
    this.#receiver = new JsonRpcEngine({
      notificationHandler: receiverNotificationHandler,
    });

    this.#sender = new JsonRpcEngine({
      notificationHandler: senderNotificationHandler,
    });
  }

  /**
   * Add a middleware function to the receiving middleware stack.
   *
   * @param middleware - The middleware function to add.
   */
  addReceiverMiddleware(
    middleware: JsonRpcMiddleware<unknown, unknown>,
  ): void {
    this.#receiver.addMiddleware(middleware as JsonRpcMiddleware<unknown, unknown>);
  }

  /**
   * Add a middleware function to the sending middleware stack.
   *
   * @param middleware - The middleware function to add.
   */
  addSenderMiddleware(middleware: JsonRpcMiddleware<unknown, unknown>): void {
    this.#sender.addMiddleware(middleware as JsonRpcMiddleware<unknown, unknown>);
  }

  /**
   * Returns the receiving pipeline as a middleware function that can be added
   * to other engines.
   *
   * @returns The receiving pipeline as a middleware function.
   */
  receiverAsMiddleware(): JsonRpcMiddleware<unknown, unknown> {
    return this.#receiver.asMiddleware();
  }

  /**
   * Returns the sending pipeline as a middleware function that can be added
   * to other engines.
   *
   * @returns The sending pipeline as a middleware function.
   */
  senderAsMiddleware(): JsonRpcMiddleware<unknown, unknown> {
    return this.#sender.asMiddleware();
  }

  /**
   * Receive a JSON-RPC request, and return a response.
   *
   * @param request - The JSON-RPC request to receive.
   * @returns The JSON-RPC response.
   */
  receive<Params, Result>(
    request: JsonRpcRequest<Params>,
  ): Promise<JsonRpcResponse<Result>>;

  /**
   * Receive a JSON-RPC notification.
   *
   * @param notification - The notification to receive.
   */
  receive<Params>(notification: JsonRpcNotification<Params>): Promise<void>;

  /**
   * Receive an array of JSON-RPC requests and/or notifications, and return an
   * array of responses to any included requests.
   *
   * @param request - The JSON-RPC requests to receive.
   * @returns An array of JSON-RPC responses.
   */
  receive<Params, Result>(
    requests: (JsonRpcRequest<Params> | JsonRpcNotification<Params>)[],
  ): Promise<JsonRpcResponse<Result>[]>;

  async receive(argument: HandleArgument) {
    if (Array.isArray(argument)) {
      return this.#receiver.handle(argument);
    } else if (isJsonRpcRequest(argument)) {
      return this.#receiver.handle(argument);
    }
    return this.#receiver.handle(argument);
  }

  /**
   * Send a JSON-RPC request, and receive a response.
   *
   * @param request - The JSON-RPC request to send.
   * @returns The JSON-RPC response.
   */
  send<Params, Result>(
    request: JsonRpcRequest<Params>,
  ): Promise<JsonRpcResponse<Result>>;

  /**
   * Send a JSON-RPC notification.
   *
   * @param notification - The notification to send.
   */
  send<Params>(notification: JsonRpcNotification<Params>): Promise<void>;

  /**
   * Send an array of JSON-RPC requests and/or notifications, and receive an
   * array of responses to any included requests.
   *
   * @param request - The JSON-RPC requests to send.
   * @returns An array of JSON-RPC responses.
   */
  send<Params, Result>(
    requests: (JsonRpcRequest<Params> | JsonRpcNotification<Params>)[],
  ): Promise<JsonRpcResponse<Result>[]>;

  async send(argument: HandleArgument) {
    if (Array.isArray(argument)) {
      return this.#sender.handle(argument);
    } else if (isJsonRpcRequest(argument)) {
      return this.#sender.handle(argument);
    }
    return this.#sender.handle(argument);
  }
}
