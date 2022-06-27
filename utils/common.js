/**
 * Reset important properties of the user if resetting password was successful
 * @param {Object} user The current user document in the DB when resetting password was successful
 */
exports.userResetPasswordSuccess = (req, user) => {
  user.password = req.body.password;
  user.passwordSame = undefined;
  user.passwordConfirm = req.body.passwordConfirm;
  user.active = false;
  user.Token = undefined;
  user.TokenExpirationDate = undefined;
};

/**
 * Sending a dynamic response to the client. The user param and the JWT param determines the type of response to be sent
 * @param {Object} res The response object
 * @param {String} msg The message to send to the client
 * @param {Number} statusCode The statusCode of the response
 * @param {String | null} JWT The JWT TOKEN to send to the client
 * @param {Object | null} user The found user in the DB that met certain conditions
 * @returns response
 */
exports.sendingResponse = (res, msg, statusCode, JWT = null, user = null) => {
  if (!JWT) {
    return res.status(statusCode).json({
      message: msg,
    });
  } else if (JWT && !user) {
    return res.status(statusCode).json({
      JWT,
      msg,
    });
  } else if (JWT && user) {
    return res.status(statusCode).json({
      msg,
      JWT,
      data: {
        user,
      },
    });
  }
};
