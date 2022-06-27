const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const date = require("date-and-time");
const crypto = require("crypto");
const createError = require("http-errors");
const tryToCatch = require("try-to-catch");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);
const Users = require("./../model/userModel");
const factoryAuth = require("./factoryAuth");
const twoFactorAuth = require("./twoFactorAuth");
const catchAsync = require("./../utils/catchAsync");
const commonFiles = require("./../utils/common");

/**
 * Generating a JWT token. IMPORTANT for authorization and authentication
 * @param {String} id The current user's id from the DB
 * @returns JWT token
 */

function generateJWT(id) {
  return jwt.sign({ id }, process.env.PRIVATE_KEY, {
    expiresIn: process.env.EXPIRES_IN,
  });
}

/**
 * Sending a cookie to end user browser
 * @param {*} res The response object
 * @param {*} JWT The JWT to be sent as cookie
 */

function generateCookie(res, JWT) {
  const cookieOpt = {
    expires: new Date(
      Date.now() + process.env.EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  res.cookie("jwt", JWT, cookieOpt);
}

/**
 * Checking if the User's "otpExp" issued when the user's OTP expired or max attempt reached is greater than the present date
 * @param {Object} res The request Object
 * @param {Object} user The current user in the DB
 * @param {String | null} JWT The JWT to send to the user ?optional
 * @returns
 */
function checkOtpExpired(res, user, JWT = null) {
  const now = new Date();
  const minutesRemaining = Math.trunc(
    date.subtract(user.otpExp, now).toMinutes()
  );
  if (user?.otpExp > now) {
    return commonFiles.sendingResponse(
      res,
      `Please wait for ${minutesRemaining} minutes to receive a new otp`,
      200,
      JWT
    );
  }
}

exports.signUp = catchAsync(async (req, res, next) => {
  const user = {
    email: req.body.email,
    name: req.body.name,
    image: req.body.image,
    password: req.body.password,
    phoneNumber: req.body.phoneNumber,
    passwordConfirm: req.body.passwordConfirm,
  };

  const signedUpUser = await Users.create(user);

  const JWT = generateJWT(signedUpUser._id);
  generateCookie(res, JWT);
  commonFiles.sendingResponse(
    res,
    "success, Account created successfully, Please confirm your email address on your dashboard",
    201,
    JWT,
    signedUpUser,
    false
  );
});

/**
 * twoFactorAuth is "required" to sendOtp to user if the OTP from the /resetPassword route was not valid
 *
 * JWT is "required" to generate a custom token
 *
 * Users is "required" to manage the Users collection in the DB
 *
 * commonFiles is "required" to send a dynamic response to the client
 *
 * @summary logging in users
 * @module logging users in to the app
 * @async
 * @requires Users module
 * @requires JWT library
 * @requires twoFactorAuth module
 * @requires commonFiles module
 *
 */

exports.login = catchAsync(async (req, res, next) => {
  const now = new Date();
  if (!req.body.password || !req.body.email)
    return next(createError(401, "please input your email address"));
  //checking if a user exists with the required email
  const user = await Users.findOne({ email: req.body.email }).select(
    "+password +active"
  );

  //checking if user exists with the specified email
  //checking if current date is greater than the date issued when the user deleted his/her account
  //deleting user's account permanently if the current date is greater than the date issued when the user deleted his/her account
  if (user && now > user?.timeToDeleteAccount && user?.deleteAccount) {
    await Users.findByIdAndDelete(user.id);
    return next(createError(401, "Incorrect credentials. Please try again"));
  }
  //checking if user password is correct
  if (!user || !(await user.comparePassword(req.body.password, user.password)))
    return next(createError(401, "incorrect credentials please try again"));
  //checking if the old password is the same as current password when user tried to resetPassword
  if (user && user.passwordSame)
    return next(createError(401, "Please reset your password"));

  //clearing the delete details of the user if he/she logged in after 30days => the date to permanently delete the account
  if (user?.deleteAccount) {
    user.deleteAccount = undefined;
    user.timeToDeleteAccount = undefined;
    await user.save({ validateBeforeSave: false });
  }

  const JWT = generateJWT(user._id);
  //checking if the twoFactorAuthentication was not successful
  if (user?.TWILIOSID || user?.twoFactorAuth === false) {
    const minutesRemaining = Math.trunc(
      date.subtract(user.otpExp, now).toMinutes()
    );
    checkOtpExpired(res, user, JWT);

    const encryptedSid = await twoFactorAuth.sendOTP(user, next);
    if (!encryptedSid) return;
    return commonFiles.sendingResponse(
      res,
      `we noticed that your OTP wasn't valid when you changed your password. For you security, we just sent you an otp please verify and gain access to your account visit /twoFactorAuth/${encryptedSid}`,
      200,
      JWT,
      null
    );
  }
  generateCookie(res, JWT);
  res.status(200).json({
    JWT,
    status: "success",
    data: {
      message: user.active
        ? "you are logged in"
        : "please confirm your email address to access certain functionalities",
    },
  });
});

/**
 * Checking if the user is AUTHORIZED -- if the user is logged in or not
 *
 * JWT - To verify the user token
 *
 * This is a MIDDLEWARE
 *
 * USERS - To get the user with that corresponds to the verified token
 * @module
 * @requires JWT library
 * @requires Users module
 * @async
 */

exports.authorization = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  //checking if the TOKEN is present in the authorization
  if (!token) return next(createError(401, "Please login to gain access"));

  const [error, decoded] = await tryToCatch(async () => {
    //verifying the token
    return await promisify(jwt.verify)(token, process.env.PRIVATE_KEY);
  });

  //getting the user with the corresponding id from the "jwt.verify"
  const user = await Users.findById(decoded?.id).select(
    "+emailVerificationToken +active +password"
  );

  if (!user)
    return next(
      createError(
        401,
        "You are not allowed to perform this action. Ensure you are logged in"
      )
    );

  req.user = user;
  next();
});

/**
 * Checking if the TWOFACTORAUTHENTICATION was successful
 *
 * @module
 * @async
 */

exports.checkTwoFactorAuth = catchAsync(async (req, res, next) => {
  //checking if the twoFactorAuthentication was unsuccessful
  //The current user "twoFactorAuth" property is "false" when it was not successful
  if (req.user?.TWILIOSID || req.user?.twoFactorAuth === false) {
    return next(
      createError(401, "Access denied!! Your OTP hasn't be verified")
    );
  }
  next();
});

/**Checking if the user has an active account
 *
 *
 * @async
 * @module
 */

exports.checkActiveUser = catchAsync(async (req, res, next) => {
  const userActive = await req.user.constructor
    .findById(req.user.id)
    .select("+active -email -products -image -name");

  console.log(userActive);
  //checking if the user account is not active and if the twoFactorAuthentication failed
  // "next" calls the checkTwoFactorAuth
  const checkTwoFactorAuthFalse = await Users.findOne({ twoFactorAuth: false });
  if (!userActive.active && checkTwoFactorAuthFalse) return next();

  //checking if the user account is not active - The user has not confirmed his/her email address
  if (!userActive.active) {
    console.log("not active");
    return next(createError(401, "Please confirm your email address"));
  }
  next();
});

/** Confirming the user email address by sending an encrypted token to the user's email.
 *
 * The user needs to be logged in
 * @async
 * @module
 */
exports.confirmUser = catchAsync(async (req, res, next) => {
  const user = await Users.findById(req.user._id);

  if (!user) return next(createError(404, "We could not find user"));
  const confirmToken = user.createToken();

  //checking if the user is already active
  if (user.active)
    return commonFiles.sendingResponse(
      res,
      "Your email has already been verified",
      200
    );
  //sending the email to the user account
  await factoryAuth.sendEmailToUser(
    req,
    confirmToken,
    "please click the link to verify your email",
    "verifyEmail",
    user
  );
  //saving the encrypted token to the DB if the email was delivered successfully
  await user.save({ validateBeforeSave: false });
  await commonFiles.sendingResponse(
    res,
    "we just sent you an email to confirm your email address",
    200
  );
});

/**
 * Verifying the user's email address
 *
 * @module
 * @async
 *
 *
 */

exports.verifyUser = catchAsync(async (req, res, next) => {
  const now = new Date();
  const user = await factoryAuth.verifyHash(req, next);
  if (!user) return;
  //checking if user is already active
  if (user.active)
    return commonFiles.sendingResponse(
      res,
      "Your email has already been verified",
      200
    );
  user.active = true;
  user.Token = undefined;
  user.TokenExpirationDate = undefined;
  await user.save({ validateBeforeSave: false });

  const JWT = generateJWT(user._id);
  commonFiles.sendingResponse(
    res,
    "Your email has been verified, redirecting you to home page",
    200,
    JWT
  );
});

/**
 * Implementing if the user forgot his/her password
 *
 * @module
 * @async
 * @requires factoryAuth To send the Email to the user that forgot his/her password
 * @requires Users to find a user with in the DB that forgot his/her password
 */

exports.forgotPassword = catchAsync(async (req, res, next) => {
  if (!req.body.email)
    return next(createError(400, "Please input your email address"));

  const user = await Users.findOne({ email: req.body.email });

  if (!user) return next(createError(403, "User not found"));
  const passwordResetToken = user.createToken();

  const response = await factoryAuth.sendEmailToUser(
    req,
    passwordResetToken,
    "please click the link to reset your password",
    "resetPassword",
    next
  );

  if (!response) return;

  await user.save({ validateBeforeSave: false }); //saving the user's latest information to the DB if the email was send successfully
  commonFiles.sendingResponse(
    res,
    "Please check your email for the latest link sent to reset your password",
    200
  );
});

/**Resetting the password with a link sent from the /forgotPassword route
 * otpExp - This is issued to the user document when the OTP has expired or max attempt reached.
 * @module
 * @async
 */

exports.resetPassword = catchAsync(async (req, res, next) => {
  const now = new Date();
  if (!req.body.password || !req.body.passwordConfirm)
    return next(createError(400, "input your password"));

  const user = await factoryAuth.verifyHash(req, next);
  if (!user) return;
  // checking if the user's current password is same as the new password when resetting password
  if (await user.comparePassword(req.body.password, user.password)) {
    user.active = false;
    user.passwordSame = true;
    await user.save({ validateBeforeSave: false });
    return next(
      createError(
        400,
        "previous password can't be the same as the new password"
      )
    );
  }

  commonFiles.userResetPasswordSuccess(req, user);
  await user.save();
  const JWT = generateJWT(user._id);
  checkOtpExpired(res, user, JWT);

  // sending an OTP to the user if the password was changed successfully.
  const encryptedSidToken = await twoFactorAuth.sendOTP(user, next);
  if (!encryptedSidToken) return;

  generateCookie(res, JWT);
  res.status(200).json({
    JWT,
    message: `To verify your identity, we just sent you a OTP please visit the route /twoFactorAuth/${encryptedSidToken}`,
  });
});
/**Verifying the USER'S otp
 * @module
 * @async
 */
exports.twoFactorAuthentication = catchAsync(async (req, res, next) => {
  await twoFactorAuth.verifyOTP(req, res, next);
});

/**
 * Sending OTP to the currently logged in user
 * @module
 * @async
 */

exports.sendOtp = catchAsync(async (req, res, next) => {
  //checking if a user exists with the twoFactorAuth property
  const twoFactorAuthExists = await Users.findOne({
    twoFactorAuth: { $in: [false, true] },
  });

  if (!twoFactorAuthExists)
    return next(createError(401, "You are not allowed to perform this action"));
  const now = new Date();
  //checking if twoFactorAuth present in the user document. "True" meaning the twoFactorAuthentication was successful
  if (req.user.twoFactorAuth)
    return next(createError(404, "You otp has already been verified"));
  checkOtpExpired(res, req.user);

  const encryptedSid = await twoFactorAuth.sendOTP(req.user, next);
  if (!encryptedSid) return;
  return commonFiles.sendingResponse(
    res,
    `we just sent you an otp please visit /twoFactorAuth/${encryptedSid}`,
    200
  );
});

/**
 * Updating the currently logged in user password
 * @module
 * @async
 */

exports.updatePassword = catchAsync(async (req, res, next) => {
  const allowedFields = ["passwordCurrent", "password", "passwordConfirm"];
  const bodyKeys = Object.keys(req.body);
  //Checking if there's a strange field
  const errField = allowedFields.some((ele, i) => ele !== bodyKeys[i]);
  if (errField) return next(createError(400, "something went wrong"));

  const user = await Users.findById(req.user.id).select("+password");
  const correct = await user.comparePassword(
    req.body.passwordCurrent,
    user.password
  );
  if (!correct) return next(createError(401, "invalid password. Try again"));
  //checking if old password is same as the the new updated password
  const checkSamePassword = await user.comparePassword(
    req.body.password,
    user.password
  );
  if (checkSamePassword)
    return next(
      createError(400, "Old password can't be the same as the new password")
    );

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  const JWT = generateJWT(user.id);
  generateCookie(res, jwt);
  commonFiles.sendingResponse(res, "Password Changed", 200, JWT, user);
});
