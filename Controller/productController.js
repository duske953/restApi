const products = require("./../model/productsModel");
const Users = require("./../model/userModel");
const appError = require("./../utils/errorHandler");
const createError = require("http-errors");
const catchAsync = require("./../utils/catchAsync");
exports.getData = catchAsync(async (req, res, next) => {
  let product = products.find();
  // product.limit(10);

  const sortParameters = ["price", "rating", "discountPercentage"];
  if (req.query.sort) {
    const querySort = req.query.sort.split(",");
    const check = querySort.every((ele, i) => sortParameters.includes(ele));
    if (check) product.sort(querySort.join(" "));
    else appError(404, "invalid url parameters");
  }

  product = await product;
  res.status(200).json({
    message: "success",
    data: {
      product,
    },
  });
});

exports.getOneProduct = catchAsync(async (req, res, next) => {
  const product = await products.find({
    title: { $regex: `${req.params.name}`, $options: "i" },
  });
  if (product.length === 0) {
    return next(
      createError(
        40,
        `we could not find the product ${req.params.name}, please check again`
      )
    );
  }
  res.status(200).json({
    message: "success",
    data: {
      product,
    },
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  const product = await products.create(req.body);
  // setting the productOwner in the productSchema to the current logged in user's id => important to check the user who created the product
  product.productOwner = req.user._id;
  await product.save({ validateBeforeSave: false });
  // pushing the currently created product document id to the currently logged in user product property in the userSchema
  req.user.products.push(product._id);
  await req.user.save({ validateBeforeSave: false });
  res.status(200).json({
    message: "success",
    data: {
      product,
    },
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  if (req.params.productId.length <= 16)
    appError(404, "invalid url parameters");

  if (!req.user.products.includes(req.params.productId))
    return next(
      createError(
        400,
        "we could not find the product your specified for. You can only delete product you created."
      )
    );

  const index = req.user.products.findIndex(
    (el) => JSON.stringify(el) === `"${req.params.productId}"`
  );

  req.user.products.splice(index, 1);
  await req.user.save({ validateBeforeSave: false });
  const product = await products.findByIdAndRemove(req.params.productId);
  if (!product) appError(400, "we could not find the product.");
  res.status(200).json({
    message: "success",
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  if (!req.user.products.includes(req.params.productId))
    return next(
      createError(
        400,
        "we could not find the product you specified for. You can only update products you created"
      )
    );

  if (req.body.title)
    return next(
      createError(
        400,
        "Product title cannot be changed, Please create a new product."
      )
    );
  const product = await products.findByIdAndUpdate(
    req.params.productId,
    req.body
  );
  res.status(200).json({
    message: "data successfully updated",
  });
});
