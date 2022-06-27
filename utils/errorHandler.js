function appError(statusCode, errMessage) {
  const error = new Error(errMessage);
  error.statusCode = statusCode || 500;
  throw error;
}

module.exports = appError;
