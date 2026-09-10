export function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }

    if (source === 'query') {
      // req.query is a getter-only property in Express 5 - mutate in place instead of reassigning
      for (const key of Object.keys(req.query)) delete req.query[key];
      Object.assign(req.query, result.data);
    } else {
      req[source] = result.data;
    }
    next();
  };
}
