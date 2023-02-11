import { errorCodes, EthereumRpcError } from 'eth-rpc-errors';
import { hasProperty, Json } from '@metamask/utils';
import { JsonRpcEngine, JsonRpcMessage } from './JsonRpcEngine';
import type { Next, ValidParam } from './JsonRpcEngine';

const jsonrpc = '2.0' as const;

describe('JsonRpcEngine', () => {
  describe('handle', () => {
    describe('notification', () => {
      it('passes the notification through middleware', async () => {
        const middleware = jest.fn();
        const engine = new JsonRpcEngine({ middleware: [middleware] });
        const notification = { jsonrpc, method: 'test_request' };

        await engine.handle(notification);

        expect(middleware).toHaveBeenCalledTimes(1);
        expect(middleware).toHaveBeenCalledWith({
          request: notification,
          context: {},
          next: expect.any(Function),
        });
      });

      it('returns no response', async () => {
        const engine = new JsonRpcEngine({ middleware: [jest.fn()] });
        const notification = { jsonrpc, method: 'test_request' };

        const response = await engine.handle(notification);

        expect(response).toBeUndefined();
      });
    });

    describe('request', () => {
      it('passes the request through middleware', async () => {
        const middleware = jest.fn().mockImplementation(() => null);
        const engine = new JsonRpcEngine({ middleware: [middleware] });
        const request = { id: 1, jsonrpc, method: 'test_request' };

        await engine.handle(request);

        expect(middleware).toHaveBeenCalledTimes(1);
        expect(middleware).toHaveBeenCalledWith({
          request,
          context: {},
          next: expect.any(Function),
        });
      });

      it('returns a response', async () => {
        const engine = new JsonRpcEngine({ middleware: [() => null] });
        const request = { id: 1, jsonrpc, method: 'test_request' };

        const response = await engine.handle(request);

        expect(response).toStrictEqual({
          id: 1,
          jsonrpc,
          result: null,
        });
      });
    });

    it('allows context to be modified on the way down the stack', async () => {
      const engine = new JsonRpcEngine({
        middleware: [
          ({ context, next, request }) => {
            context.answer = 42;
            return next(request);
          },
          ({ context }) => {
            if (
              hasProperty(context, 'answer') &&
              typeof context.answer === 'number'
            ) {
              return context.answer;
            }
            throw new Error('Answer missing from context');
          },
        ],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      const response = await engine.handle(request);

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 42,
      });
    });

    it('allows context to be modified on the way up the stack', async () => {
      const engine = new JsonRpcEngine({
        middleware: [
          async ({ context, next, request }) => {
            const result = await next(request);
            // eslint-disable-next-line jest/no-if
            if (
              hasProperty(context, 'answer') &&
              typeof context.answer === 'number'
            ) {
              return context.answer;
            }
            return result;
          },
          ({ context }) => {
            context.answer = 10;
            return 42;
          },
        ],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      const response = await engine.handle(request);

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 10,
      });
    });

    it('allows the request to be modified on the way down the stack', async () => {
      const addOneParam = ({
        next,
        request,
      }: {
        next: Next<JsonRpcMessage<ValidParam>, Json>;
        request: JsonRpcMessage<ValidParam>;
      }) => {
        if (Array.isArray(request.params)) {
          request.params.push('additional parameter');
        }
        return next(request);
      };
      const countParams = ({
        request,
      }: {
        request: JsonRpcMessage<ValidParam>;
      }) => request.params?.length;
      const engine = new JsonRpcEngine({
        middleware: [addOneParam, countParams],
      });
      const request = { id: 1, jsonrpc, method: 'test_request', params: [] };

      const response = await engine.handle(request);

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 1,
      });
    });

    it('allows the request to be modified on the way up the stack', async () => {
      const throwIfSecret = async ({
        next,
        request,
      }: {
        next: Next<JsonRpcMessage<ValidParam>, Json>;
        request: JsonRpcMessage<ValidParam>;
      }) => {
        const result = await next(request);
        // eslint-disable-next-line jest/no-if
        if (Array.isArray(request.params) && request.params[0] === 'secret') {
          throw new Error('Secret found!');
        }
        return result;
      };

      const processSecret = ({
        request,
      }: {
        request: JsonRpcMessage<ValidParam>;
      }) => {
        if (
          Array.isArray(request.params) &&
          typeof request.params[0] === 'string'
        ) {
          const answer = request.params[0].length;
          request.params.pop(); // hide the secret
          return answer;
        }
        throw new Error('Unrecognized request parameters');
      };
      const engine = new JsonRpcEngine({
        middleware: [throwIfSecret, processSecret],
      });
      const request = {
        id: 1,
        jsonrpc,
        method: 'test_request',
        params: ['secret'],
      };

      const response = await engine.handle(request);

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 6,
      });
    });

    it('allows the response to be modified on the way up the stack', async () => {
      const addOneToResult = async ({
        next,
        request,
      }: {
        next: Next<JsonRpcMessage<ValidParam>, Json>;
        request: JsonRpcMessage<ValidParam>;
      }) => {
        const result = await next(request);
        // eslint-disable-next-line jest/no-if
        if (typeof result === 'number') {
          return result + 1;
        }
        throw new Error('Result expected to be number, but was not');
      };
      const engine = new JsonRpcEngine({
        middleware: [addOneToResult, () => 10],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      const response = await engine.handle(request);

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 11,
      });
    });

    it('sends the request back up the stack if next is not called', async () => {
      const unreachableMiddleware = jest.fn().mockImplementation(() => {
        throw new Error('This should be unreachable');
      });
      const engine = new JsonRpcEngine({
        middleware: [() => null, unreachableMiddleware],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      const response = await engine.handle(request);

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: null,
      });
      expect(unreachableMiddleware).not.toHaveBeenCalled();
    });

    it('calls the "next" handler for an unhandled request', async () => {
      const lastNext = jest.fn().mockImplementation(() => 42);
      const engine = new JsonRpcEngine({
        middleware: [
          ({ next, request }) => {
            // forward all requests
            return next(request);
          },
        ],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      const response = await engine.handle(request, { next: lastNext });

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 42,
      });
      expect(lastNext).toHaveBeenCalledWith(request);
    });

    it('does not call the "next" handler for an handled request', async () => {
      const unreachableNext = jest.fn().mockImplementation(() => {
        throw new Error('This should be unreachable');
      });
      const engine = new JsonRpcEngine({
        middleware: [() => 42],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      const response = await engine.handle(request, { next: unreachableNext });

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 42,
      });
      expect(unreachableNext).not.toHaveBeenCalled();
    });

    it('allows middleware to catch an error from later middleware', async () => {
      const returnZeroOnError = async ({
        next,
        request,
      }: {
        next: Next<JsonRpcMessage<ValidParam>, Json>;
        request: JsonRpcMessage<ValidParam>;
      }) => {
        try {
          return await next(request);
        } catch (_error) {
          return 0;
        }
      };

      const alwaysThrow = () => {
        throw new Error('Test error');
      };
      const engine = new JsonRpcEngine({
        middleware: [returnZeroOnError, alwaysThrow],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      const response = await engine.handle(request);

      expect(response).toStrictEqual({
        id: 1,
        jsonrpc,
        result: 0,
      });
    });

    it('re-throws a JSON-RPC error', async () => {
      const error = new EthereumRpcError(
        errorCodes.rpc.internal,
        'JsonRpcEngine: test error',
      );
      const engine = new JsonRpcEngine({
        middleware: [
          () => {
            throw error;
          },
        ],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      await expect(engine.handle(request)).rejects.toThrow(error);
    });

    it('throws non-standard error as a JSON-RPC internal error', async () => {
      const error = new Error('test');
      const engine = new JsonRpcEngine({
        middleware: [
          () => {
            throw error;
          },
        ],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      await expect(engine.handle(request)).rejects.toThrow(
        `JsonRpcEngine: Internal error 'test'`,
      );
    });

    it('throws non-error as a JSON-RPC internal error', async () => {
      const engine = new JsonRpcEngine({
        middleware: [
          () => {
            throw 42;
          },
        ],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      await expect(engine.handle(request)).rejects.toThrow(
        'JsonRpcEngine: Internal non-Error thrown',
      );
    });

    it('throws when the request is unhandled', async () => {
      const engine = new JsonRpcEngine({
        middleware: [
          ({ next, request }) => {
            return next(request);
          },
        ],
      });
      const request = { id: 1, jsonrpc, method: 'test_request' };

      await expect(engine.handle(request)).rejects.toThrow('test');
    });
  });
});
