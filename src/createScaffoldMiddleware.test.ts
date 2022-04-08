import { JsonRpcEngine, createScaffoldMiddleware, JsonRpcMiddleware } from '.';

describe('createScaffoldMiddleware', function () {
  it('basic middleware test', async () => {
    const engine = new JsonRpcEngine();

    const scaffold: Record<
      string,
      string | JsonRpcMiddleware<unknown, unknown>
    > = {
      method1: 'foo',
      method2: (_req, res, _next, end) => {
        res.result = 42;
        end();
      },
      method3: (_req, res, _next, end) => {
        res.error = new Error('method3');
        end();
      },
    };

    engine.push(createScaffoldMiddleware(scaffold));
    engine.push((_req, res, _next, end) => {
      res.result = 'passthrough';
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0' as const };

    const response1 = await engine.handle({ ...payload, method: 'method1' });
    const response2 = await engine.handle({ ...payload, method: 'method2' });
    const response3 = await engine.handle({ ...payload, method: 'method3' });
    const response4 = await engine.handle({ ...payload, method: 'unknown' });

    expect((response1 as any).result).toStrictEqual('foo');
    expect((response2 as any).result).toStrictEqual(42);
    expect((response3 as any).error.message).toStrictEqual('method3');

    expect((response4 as any).result).toStrictEqual('passthrough');
  });
});
