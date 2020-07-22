'use strict'

module.exports = function asMiddleware (engine) {
  return async function engineAsMiddleware (req, res, next, end) {
    const { isComplete, returnHandlers } = await engine._runMiddlewareDown(req, res)

    let err = null

    if (isComplete) {
      return runReturnHandlers()
        .catch((handlerError) => {
          err = handlerError
        })
        .finally(() => {
          end(err)
        })
    }

    return next(async (cb) => {
      await runReturnHandlers()
      cb()
    })

    async function runReturnHandlers () {
      for (const handler of returnHandlers) {
        await new Promise((resolve) => handler(resolve))
      }
    }
  }
}
