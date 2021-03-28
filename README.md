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

Engines can be nested by converting them to middleware using `JsonRpcEngine.asMiddleware()`:

```js
const engine = new JsonRpcEngine();
const subengine = new JsonRpcEngine();
engine.push(subengine.asMiddleware());
```

### Error Handling

Errors should be handled by throwing inside middleware functions.

For backwards compatibility, you can also pass an error to the `end` callback,
or set the error on the response object, and then return or call `end`.

Errors always take precedent over results.
If an error is detected, the response's `result` property will be deleted.

All of the following examples are equivalent.
It does not matter of the middleware function is synchronous or asynchronous.

```js
// Throwing is preferred.
engine.push(function (req, res, end) {
  throw new Error();
});

// For backwards compatibility, you can also do this:
engine.push(function (req, res, end) {
  end(new Error());
});

engine.push(function (req, res, end) {
  res.error = new Error();
  end();
});

engine.push(function (req, res, end) {
  res.error = new Error();
});
```
