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

By passing a _return handler_ to the `next` function, you can get a peek at the result before it returns.

```js
engine.push(function(req, res, next, end){
  next(function(cb){
    insertIntoCache(res, cb)
  })
})
```

Engines can be nested by converting them to middleware using `JsonRpcEngine.asMiddleware()`:

```js
const engine = new JsonRpcEngine()
const subengine = new JsonRpcEngine()
engine.push(subengine.asMiddleware())
```

### Gotchas

Handle errors via `end(err)`, *NOT* `next(err)`.

```js
/* INCORRECT */
engine.push(function(req, res, next, end){
  next(new Error())
})

/* CORRECT */
engine.push(function(req, res, next, end){
  end(new Error())
})
```

However, `next()` will detect errors on the response object, and cause
`end(res.error)` to be called.

```js
engine.push(function(req, res, next, end){
  res.error = new Error()
  next() /* This will cause end(res.error) to be called. */
})
```
