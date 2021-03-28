import { getUniqueId } from './getUniqueId';
import { JsonRpcMiddleware } from './JsonRpcEngine';

export function createIdRemapMiddleware(): JsonRpcMiddleware<unknown, unknown> {
  return (req, res, _end) => {
    const originalId = req.id;
    const newId = getUniqueId();
    req.id = newId;
    res.id = newId;
    return () => {
      req.id = originalId;
      res.id = originalId;
    };
  };
}
