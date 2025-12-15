module.exports = (err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  if (err.name === 'UnauthorizedError' || status === 401) status = 401;
  if (status === 403) status = 403;
  res.status(status).json({
    message: err.message || (status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Internal Server Error'),
    errors: err.errors || undefined,
  });
};
