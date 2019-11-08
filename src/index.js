'use strict'
const async = require('async')
const SafeEventEmitter = require('safe-event-emitter')
const { serializeError, ethErrors } = require('eth-json-rpc-errors')

class RpcEngine extends SafeEventEmitter {
  constructor () {
    super()
    this._middleware = []
  }

  //
  // Public
  //

  push (middleware) {
    this._middleware.push(middleware)
  }

  handle (req, cb) {
    // batch request support
    if (Array.isArray(req)) {
      this._handleBatch(req, cb)
    } else {
      this._handle(req, cb)
    }
  }

  //
  // Private
  //

  _handleBatch (reqs, cb) {

    let numRemaining = reqs.length // keep track of number of remaining requests
    const batchRes = new Array(reqs.length).fill(null) // responses, in order

    // wrap request sending in a promise that resolves when all requests have
    // been handled
    new Promise(() => {

      for (let i = 0; i < batchRes.length; i++) {

        // fire off all requests in sequence without waiting for resolution
        // in this way, the receiver can handle them as an ordered batch
        this._promiseHandle(reqs[i], i)
          .then(([err, res, index]) => {

            if (!res) { // this is bad

              if (err) {
                throw err
              } else {
                throw ethErrors.rpc.internal('JsonRpcEngine: Request handler returned neither error nor response.')
              }
            } else {

              // add individual response in order to response array
              batchRes[index] = res

              // resolve if all requests handled
              numRemaining--
              if (numRemaining === 0) {
                cb && cb(null, batchRes)
                cb = null // should not be necessary, but nevertheless...
              }
            }
          })
          .catch(_err => {

            // some kind of fatal error
            cb && cb(_err, null)
            cb = null // don't let anyone else call cb
          })
      }
    })
  }

  _promiseHandle (req, index) {
    return new Promise((resolve) => {
      this._handle(req, (err, res) => {
        resolve([err, res, index])
      })
    })
  }

  _handle (_req, cb) {
    // shallow clone request object
    const req = Object.assign({}, _req)
    // create response obj
    const res = {
      id: req.id,
      jsonrpc: req.jsonrpc
    }
    // process all middleware
    this._runMiddleware(req, res, (err) => {
      // take a clear any responseError
      const responseError = res._originalError
      delete res._originalError
      if (responseError) {
        // ensure no result is present on an errored response
        delete res.result
        // return originalError and response
        return cb(responseError, res)
      }
      // return response
      cb(err, res)
    })
  }

  _runMiddleware (req, res, onDone) {
    // flow
    async.waterfall([
      (cb) => this._runMiddlewareDown(req, res, cb),
      checkForCompletion,
      (returnHandlers, cb) => this._runReturnHandlersUp(returnHandlers, cb),
    ], onDone)

    function checkForCompletion({ isComplete, returnHandlers }, cb) {
      // fail if not completed
      if (!('result' in res) && !('error' in res)) {
        const requestBody = JSON.stringify(req, null, 2)
        const message = 'JsonRpcEngine: Response has no error or result for request:\n' + requestBody
        return cb(new Error(message))
      }
      if (!isComplete) {
        const requestBody = JSON.stringify(req, null, 2)
        const message = 'JsonRpcEngine: Nothing ended request:\n' + requestBody
        return cb(new Error(message))
      }
      // continue
      return cb(null, returnHandlers)
    }
  }

  // walks down stack of middleware
  _runMiddlewareDown (req, res, onDone) {
    // for climbing back up the stack
    let allReturnHandlers = []
    // flag for stack return
    let isComplete = false

    // down stack of middleware, call and collect optional allReturnHandlers
    async.mapSeries(this._middleware, eachMiddleware, completeRequest)

    // runs an individual middleware
    function eachMiddleware (middleware, cb) {
      // skip middleware if completed
      if (isComplete) return cb()
      // run individual middleware
      middleware(req, res, next, end)

      function next (returnHandler) {
        if (res.error) {
          end(res.error)
        } else {
          // add return handler
          allReturnHandlers.push(returnHandler)
          cb()
        }
      }

      function end (err) {
        // if errored, set the error but dont pass to callback
        const _err = err || (res && res.error)
        // const _err = err
        if (_err) {
          res.error = serializeError(_err)
          res._originalError = _err
        }
        // mark as completed
        isComplete = true
        cb()
      }
    }

    // returns, indicating whether or not it ended
    function completeRequest (err) {
      // this is an internal catastrophic error, not an error from middleware
      if (err) {
        // prepare error message
        res.error = serializeError(err)
        // remove result if present
        delete res.result
        // return error-first and res with err
        return onDone(err, res)
      }
      const returnHandlers = allReturnHandlers.filter(Boolean).reverse()
      onDone(null, { isComplete, returnHandlers })
    }
  }

  // climbs the stack calling return handlers
  _runReturnHandlersUp (returnHandlers, cb) {
    async.eachSeries(returnHandlers, (handler, next) => handler(next), cb)
  }
}

module.exports = RpcEngine
