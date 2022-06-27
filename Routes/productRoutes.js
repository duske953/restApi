const express = require("express");
const Router = express.Router();
const productController = require("./../Controller/productController");
const authController = require("./../Controller/authController");
Router.route("/:name").get(productController.getOneProduct);
Router.route("/")
  .get(productController.getData)
  .post(
    authController.authorization,
    authController.checkActiveUser,
    authController.checkTwoFactorAuth,
    productController.createProduct
  );

Router.use(
  authController.authorization,
  authController.checkActiveUser,
  authController.checkTwoFactorAuth
);
Router.route("/:productId")
  .delete(productController.deleteProduct)
  .patch(productController.updateProduct);

module.exports = Router;
