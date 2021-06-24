# json-rpc-engine

A tool for processing JSON-RPC requests and responses.

## Usage

```js
const { JsonRpcEngine } = require('json-rpc-engine')

let engine = new JsonRpcEngine()
```

Build a stack of JSON-RPC processors by pushing middleware to the engine.

```js
engine.push(function(req, res, next, end){
  res.result = 42
  end()
})
```

Requests are handled asynchronously, stepping down the stack until complete.

```js
let request = { id: 1, jsonrpc: '2.0', method: 'hello' }

engine.handle(request, function(err, response){
  // Do something with response.result, or handle response.error
})

// There is also a Promise signature
const response = await engine.handle(request)
```

Middleware have direct access to the request and response objects.
They can let processing continue down the stack with `next()`, or complete the request with `end()`.

```js
engine.push(function(req, res, next, end){
  if (req.skipCache) return next()
  res.result = getResultFromCache(req)
  return end()
})
```

Middleware functions can be `async`:

```js
engine.push(async function(req, res, next, end){
  if (req.method !== targetMethod) return next()
  res.result = await processTargetMethodRequest(req)
  return end()
})
```

By passing a _return handler_ to the `next` function, you can get a peek at the response before it is returned to the requester.

```js
engine.push((req, res, next, end) => {
  next(async () => {
    await insertIntoCache(res)
  })
})
```

Return handlers can be synchronous or asynchronous.
They take no callbacks, and should only interact with the request and/or the response.

Engines can be nested by converting them to middleware using `JsonRpcEngine.asMiddleware()`:

```js
const engine = new JsonRpcEngine()
const subengine = new JsonRpcEngine()
engine.push(subengine.asMiddleware())
```

### Error Handling

Errors should be handled by throwing inside middleware functions.

For backwards compatibility, you can also pass an error to the `end` callback,
or set the error on the response object, and then call `end` or `next`.
However, errors must **not** be passed to the `next` callback.

Errors always take precedent over results.
If an error is detected, the response's `result` property will be deleted.

All of the following examples are equivalent.
It does not matter of the middleware function is synchronous or asynchronous.

```js
// Throwing is preferred.
engine.push(function(req, res, next, end){
  throw new Error()
})

// For backwards compatibility, you can also do this:
engine.push(function(req, res, next, end){
  end(new Error())
})

engine.push(function(req, res, next, end){
  res.error = new Error()
  end()
})

engine.push(function(req, res, next, end){
  res.error = new Error()
  next()
})

// INCORRECT. Do not do this:
engine.push(function(req, res, next, end){
  next(new Error())
})
```
