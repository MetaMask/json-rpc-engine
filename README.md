# json-rpc-engine

A tool for processing JSON-RPC requests and responses.

## Usage

```js
const { JsonRpcEngine } = require('json-rpc-engine');

const engine = new JsonRpcEngine();
```

Build a stack of JSON-RPC processors by pushing middleware to the engine.

```js
engine.push(function (req, res, end) {
  res.result = 42;
  end();
});
```

Requests are handled asynchronously, stepping down the stack until complete.

```js
const request = { id: 1, jsonrpc: '2.0', method: 'hello' };

engine.handle(request, (err, response) => {
  // Do something with response.result, or handle response.error
});

// There is also a Promise signature
const response = await engine.handle(request);
```

Middleware have direct access to the request and response objects.
They can let processing continue down the stack by returning, or complete the request with `end()`.

```js
engine.push(function (req, res, end) {
  if (req.skipCache) return;
  res.result = getResultFromCache(req);
  return end();
});
```

`end()` **must** be called once during middleware processing, or an internal error will be returned.

Middleware functions can be `async`:

```js
engine.push(async function (req, res, end) {
  if (req.method !== targetMethod) return;
  res.result = await processTargetMethodRequest(req);
  return end();
});
```

By returning a _return handler function_, middleware can interact with the response before it is returned to the requester.

```js
engine.push((req, res, end) => {
  return () => {
    await insertIntoCache(res);
  }
})
```

Return handlers can be synchronous or asynchronous.
They take no callbacks, and should only interact with the request and/or the response.

Middleware functions **must** return a falsy value or a function.
If anything else is returned, the request will end with an error.

If a middleware calls `end()`, its return value will be ignored.
The `end()` callback **must not** be passed a value.

Engines can be nested by converting them to middleware using `JsonRpcEngine.asMiddleware()`:

```js
const engine = new JsonRpcEngine();
const subengine = new JsonRpcEngine();
engine.push(subengine.asMiddleware());
```

### Error Handling

Errors must be handled by throwing them inside middleware functions.
A thrown error will immediately end middleware processing,
and return a response object with an `error` but no `result`.

Errors assigned directly to `response.error` will be overwritten.
Non-`Error` values thrown inside middleware will be added under the `data` property of a new `Error`,
which will be used as the response `error`.

The `error` property of a response object returned by this package will always
be a valid [JSON-RPC error](https://www.jsonrpc.org/specification#error_object), if present.
These error values are plain objects, without `stack` properties.
