const date = require("date-and-time");
const createError = require("http-errors");
const tryToCatch = require("try-to-catch");
const Cryptr = require("cryptr");
const cryptr = new Cryptr(process.env.CRYPT_KEY);
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);
const appError = require("./../utils/errorHandler");
const User = require("./../model/userModel");

/**
 * resetting important user details if the OTP was verified successfully
 * @param {Object} user The user document in the DB
 */
async function resetTwilio(user) {
  user.TWILIOSID = undefined;
  user.active = true;
  user.twoFactorAuth = undefined;
  user.otpExp = undefined;
  await user.save({ validateBeforeSave: false });
}

/**
 * Clearing the certain properties of the User's document if there was an error sending the otp
 * @param {Object} user The user document in the DB
 */
async function errorTwilio(user) {
  user.TWILIOSID = undefined;
  user.otpExp = undefined;
  await user.save({ validateBeforeSave: false });
}

/**
 *Sending OTP to current user's phoneNumber
 * @param {Object} user The user that is going to receive the OTP
 * @async
 * @returns {String} Then encrypted TWILIOSID
 */
exports.sendOTP = async (user, next) => {
  let [err, encryptedSidToken] = await tryToCatch(async () => {
    user.twoFactorAuth = false; // setting twoFactor auth on the user to false when OTP is sent
    user.otpExp = undefined;
    return await user.generateTwilioSid();
  });
  if (err) {
    errorTwilio(user);
    return next(
      createError(
        500,
        "something went wrong please Please ensure you have a strong internet connection"
      )
    );
  }

  const [err1, response2] = await tryToCatch(async () => {
    const decryptedSid = cryptr.decrypt(user.TWILIOSID); // decrypting the the TWILIOSID
    const { status } = await client.verify
      .services(decryptedSid)
      .verifications.create({ to: "+2348105364263", channel: "sms" });
    return status;
  });
  if (err1) {
    errorTwilio(user);
    return next(
      createError(
        500,
        "something went wrong please ensure you have a strong internet connection"
      )
    );
  }

  await user.save({ validateBeforeSave: false }); //saving the encrypted TWILIOSID if all went well - NO ERROR OCCURRED when sending the otp
  return encryptedSidToken;
};

/**
 * checking if the otp is correct
 * The user must be logged in to verify the OTP
 * @param {Object} req the request object
 * @returns {null}
 */

exports.verifyOTP = async (req, res, next) => {
  const user = await User.findOne({ TWILIOSID: req.params.sid });
  if (!user)
    return next(createError(400, "You are not allowed to perform the action"));
  //decrypting the TWILIOSID to get the real one
  const decryptedSid = cryptr.decrypt(user.TWILIOSID);
  const now = new Date();
  if (!req.body.OTP) return next(createError(400, "Please input your OTP"));
  const [err, response] = await tryToCatch(async () => {
    const { valid } = await client.verify
      .services(decryptedSid)
      .verificationChecks.create({ to: "+2348105364263", code: req.body.OTP });
    if (!valid)
      return next(createError(400, "Invalid otp. Please check again"));
    res.status(200).json({
      message: "otp verified successfully",
    });
    await resetTwilio(user);
  });

  if (!err) return;
  // The below code is executed only if the MAX attempts reached or the OTP is expired
  if (err.code === 20404 || err.code === 60202) {
    user.otpExp = date.addMinutes(now, 10);
    user.TWILIOSID = undefined;
    user.twoFactorAuth = false;
    await user.save({ validateBeforeSave: false });
    return next(
      createError(
        400,
        "otp has expired or max attempt reached. Please wait 10minutes to get a new one"
      )
    );
  } else {
    return next(
      createError(
        404,
        "something went wrong while trying to process the request. Please try again"
      )
    );
  }
};
