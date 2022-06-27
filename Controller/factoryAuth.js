const Users = require("./../model/userModel");
const appError = require("./../utils/errorHandler");
const sendMail = require("./../utils/sendMail");
const crypto = require("crypto");
const url = require("url");
const createError = require("http-errors");
const tryToCatch = require("try-to-catch");
const { TokenInstance } = require("twilio/lib/rest/api/v2010/account/token");

/**
 * Resetting the TOKEN and  TOKENEXPIRATION data of the user
 * @param {Object} user The currently authenticated user document from the DB
 */
function resetUserCredentials(user) {
  user.Token = undefined;
  user.TokenExpirationDate = undefined;
}

/**
 * clearing The encrypted token and the tokenExpirationData of the current user from the DB
 * @param {Object} user The currently authenticated user document from the DB
 */
exports.resetCredentials = (user) => {
  user.Token = undefined;
  user.TokenExpirationDate = undefined;
};

async function sendingEmailVerification(req, token, msg, route) {
  const resetUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/${route}/${token}`;
  const [err, response] = await tryToCatch(async () => {
    return await sendMail(
      "kennyduske@gmail.com",
      "Email-verification",
      `${msg}. ${resetUrl} valid for 10min`
    );
  });
  if (err) throw err;
  return response;
}

/**
 * Checking if the there's a user in the DB where the decrypted token equals the encrypted toke stored on the database
 *
 * Authentication is not required (e.g, checking if the user is logged in or not)
 *
 * @param {Object} req
 * @returns {Object} The user document if it's found on the DB
 */
exports.verifyHash = async (req, next) => {
  const urlParam = url.parse(req.url, true);
  let urlRoute = urlParam.pathname.split("/")[1];
  let relativeRoute;
  const now = new Date();
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  //checking if there's a user in the DB where the encrypted token equals to the decrypted token
  const user = await Users.findOne({ Token: hashedToken }).select("+password");
  if (!user) {
    if (urlRoute === "resetPassword") relativeRoute = "forgotPassword";
    else if (urlRoute === "verifyEmail") relativeRoute = "confirmPassword";
    return next(
      createError(
        400,
        `Token is invalid. Ensure on parameters are correct or visit /${relativeRoute} to ${urlRoute} again `
      )
    );
  }
  //checking if the current time is greater thant the time the token was issued
  if (now > user.TokenExpirationDate) {
    resetUserCredentials(user);
    await user.save({ validateBeforeSave: false });
    appError(400, "The link has already expired");
  }
  // resetUserCredentials(user);
  return user;
};

/**
 *
 * @param {Object} req
 * @param {String} token an decrypted token sent to the user's email
 * @param {String} msg a message to the user about what the email is all about
 * @param {String} route the specific route it targets
 *
 */
exports.sendEmailToUser = async (req, token, msg, route, next) => {
  const [err, response] = await tryToCatch(async () => {
    return await sendingEmailVerification(req, token, msg, route);
  });

  if (err) {
    return next(createError(502, "something went wrong"));
  }
  return response;
};
