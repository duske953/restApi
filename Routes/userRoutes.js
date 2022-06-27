const express = require("express");
const Router = express.Router();
const authController = require("./../Controller/authController");
const userController = require("./../Controller/userController");
// Router.route("/getAllUsers").get(userController.getAllUsers);
Router.route("/login").post(authController.login);
Router.route("/signup").post(authController.signUp);

Router.route("/verifyEmail/:token").post(authController.verifyUser);
Router.route("/forgotPassword").post(authController.forgotPassword);
Router.route("/resetPassword/:token").post(authController.resetPassword);

Router.use(authController.authorization);
Router.route("/confirmUser").post(authController.confirmUser);
Router.route("/twoFactorAuth/:sid").post(
  authController.twoFactorAuthentication
);

Router.route("/sendOtp").post(authController.sendOtp);
Router.use(authController.checkActiveUser, authController.checkTwoFactorAuth);
Router.route("/updateMe").patch(userController.updateMe);
Router.route("/deleteMe").patch(userController.deleteMe);
Router.route("/updatePassword").patch(authController.updatePassword);

module.exports = Router;
