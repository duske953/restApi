function handlerErrorDev(err, res) {
  res.status(err.statusCode).json({
    message: err.message,
    stack: err.stack,
    error: err,
  });
}

function throwErrors(err, statusCode) {
  const error = new Error(err);
  error.statusCode = statusCode;
  return error;
}

function handleValidationError(err) {
  const errValueProperty = Object.keys(err.errors)[0];
  const value = err.errors[errValueProperty].value;
  return throwErrors(`invalid data, The input ${value} is not valid`, 400);
}

function handleCastError(err) {
  return throwErrors("We could not process the data", 500);
}

function handleOtpExpired(err) {
  return throwErrors(
    "OTP has expired please wait 10minutes before you can require a new one",
    400
  );
}

function handleOtpMaxAttempt(err) {
  return throwErrors(
    "You've entered the wrong password too many times. Please wait 10minutes before requiring a new one",
    400
  );
}

function handleDuplicate(err) {
  return throwErrors(
    "You already have a product similar in your account Please create a new one or update the current product. Please note that the title of the product can't be modified",
    400
  );
}

function handleTokenExpired() {
  return throwErrors(
    "You've been logged out of your account please login again",
    401
  );
}

function handleErrorProd(err, res) {
  res.status(err.statusCode).json({
    status: "fail",
    message: err.message,
  });
}

function handleError(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    handlerErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    if (err.name === "ValidationError") error = handleValidationError(error);
    if (err.name === "TokenExpiredError") error = handleTokenExpired(error);
    if (err.code === 11000) error = handleDuplicate(error);
    if (err.code === 20404) error = handleOtpExpired(error);
    if (err.code === 60202) error = handleOtpMaxAttempt(error);
    if (err.name === CastError) error = handleCastError(error);
    handleErrorProd(error, res);
  }
}

module.exports = handleError;
