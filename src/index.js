'use strict'

const SafeEventEmitter = require('safe-event-emitter')
const {
  serializeError, EthereumRpcError, ERROR_CODES,
} = require('eth-json-rpc-errors')

module.exports = class RpcEngine extends SafeEventEmitter {
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

  async _handleBatch (reqs, cb) {

    // The order here is important
    try {
      const batchRes = await Promise.all( // 2. Wait for all requests to finish
        // 1. Begin executing each request in the order received
        reqs.map(this._promiseHandle.bind(this)),
      )
      return cb(null, batchRes) // 3a. Return batch response
    } catch (err) {
      return cb(err) // 3b. Some kind of fatal error; all requests are lost
    }
  }

  _promiseHandle (req) {
    return new Promise((resolve, reject) => {
      this._handle(req, (err, res) => {
        if (res) {
          resolve(res)
        } else {
          reject(err || new EthereumRpcError(
            ERROR_CODES.rpc.internal,
            'JsonRpcEngine: Request handler returned neither error nor response.',
          ))
        }
      })
    })
  }

  _handle (_req, cb) {
    // shallow clone request object
    const req = { ..._req }
    // create response obj
    const res = {
      id: req.id,
      jsonrpc: req.jsonrpc,
    }

    let err = null
    this._runMiddleware(req, res)
      .catch((_err) => {
        err = _err
      })
      .finally(() => {
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
        return cb(err, res)
      })
  }

  async _runMiddleware (req, res) {

    const { isComplete, returnHandlers } = await this._runMiddlewareDown(req, res)

    this._checkForCompletion(req, res, isComplete)

    for (const handler of returnHandlers) {
      await new Promise((resolve, reject) => {
        handler((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  }

  _checkForCompletion (req, res, isComplete) {
    // fail if not completed
    if (!('result' in res) && !('error' in res)) {
      const requestBody = JSON.stringify(req, null, 2)
      const message = `JsonRpcEngine: Response has no error or result for request:\n${requestBody}`
      throw new EthereumRpcError(
        ERROR_CODES.rpc.internal, message, req,
      )
    }
    if (!isComplete) {
      const requestBody = JSON.stringify(req, null, 2)
      const message = `JsonRpcEngine: Nothing ended request:\n${requestBody}`
      throw new EthereumRpcError(
        ERROR_CODES.rpc.internal, message, req,
      )
    }
  }

  // walks down stack of middleware
  async _runMiddlewareDown (req, res) {

    // for climbing back up the stack
    const allReturnHandlers = []
    // flag for stack return
    let isComplete = false

    // down stack of middleware, call and collect optional allReturnHandlers
    for (const middleware of this._middleware) {
      if (!isComplete) {
        await runMiddleware(middleware)
      }
    }

    const returnHandlers = allReturnHandlers.filter(Boolean).reverse()
    return { isComplete, returnHandlers }

    // runs an individual middleware
    function runMiddleware (middleware) {
      return new Promise((resolve) => {

        try {
          // run individual middleware
          middleware(req, res, next, end)
        } catch (err) {
          end(err)
        }

        function next (returnHandler) {
          if (res.error) {
            end(res.error)
          } else {
            // add return handler
            allReturnHandlers.push(returnHandler)
            resolve()
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
          resolve()
        }
      })
    }
  }
}
