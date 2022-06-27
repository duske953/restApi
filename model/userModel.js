const mongoose = require("mongoose");
const date = require("date-and-time");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);
const Cryptr = require("cryptr");
const cryptr = new Cryptr(process.env.CRYPT_KEY);
const validator = require("validator");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "please input your email address"],
    unique: [true, "email address already exists"],
    validate: [validator.isEmail, "Please provide a valid email"],
  },

  name: {
    type: String,
    required: [true, "please input your name"],
  },

  phoneNumber: {
    type: String,
    required: [true, "Please input your phone number"],
    validate: [validator.isMobilePhone, "Please enter a valid phone number"],
  },

  image: {
    type: String,
    default: "img.jpg",
  },

  active: {
    type: Boolean,
    default: false,
    select: false,
  },

  otpExp: Date,
  twoFactorAuth: Boolean,
  deleteAccount: Boolean,
  timeToDeleteAccount: Date,

  password: {
    type: String,
    required: [true, "please choose a password"],
    select: false,
    minlength: 8,
  },
  passwordSame: Boolean,
  Token: String,
  TWILIOSID: String,
  TokenExpirationDate: Date,
  products: [
    {
      type: mongoose.Schema.ObjectId,
      ref: "products",
    },
  ],

  passwordConfirm: {
    type: String,
    required: [true, "please confirm your password"],
    validate: {
      validator(v) {
        return this.password === v;
      },
    },
  },
});

/**
 *
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  this.passwordConfirm = undefined;
  next();
});

userSchema.methods.createToken = function () {
  const RandomToken = crypto.randomBytes(32).toString("hex");
  this.Token = crypto.createHash("sha256").update(RandomToken).digest("hex");
  const now = new Date();
  this.TokenExpirationDate = date.addMinutes(now, 10);
  return RandomToken;
};

userSchema.methods.clearUserDetails = async function () {
  if (!this._id) return;
  await this.constructor.findByIdAndRemove(this._id);
};

userSchema.methods.comparePassword = async function (password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
};

userSchema.methods.generateTwilioSid = async function () {
  try {
    const { sid } = await client.verify.services.create({
      friendlyName: process.env.FRIENDLY_NAME,
      codeLength: 6,
      lookupEnabled: true,
      doNotShareWarningEnabled: true,
    });
    const encryptedSid = cryptr.encrypt(sid);
    this.TWILIOSID = encryptedSid;

    return encryptedSid;
  } catch (err) {
    throw err;
  }
};

const Users = mongoose.model("Users", userSchema);

module.exports = Users;
