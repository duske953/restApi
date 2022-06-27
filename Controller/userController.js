const Users = require("./../model/userModel");
const products = require("./../model/productsModel");
const catchAsync = require("./../utils/catchAsync");
const appError = require("./../utils/errorHandler");
const createError = require("http-errors");
const tryToCatch = require("try-to-catch");
const date = require("date-and-time");
// exports.getAllUsers = async (req, res, next) => {
//   const user = await Users.find().populate("products");
//   res.status(200).json({
//     message: "success",
//     data: {
//       user,
//     },
//   });
// };

function filterObj(obj, ...allowed) {
  const newObj = {};
  Object.keys(obj).forEach((ele) => {
    if (allowed.includes(ele)) newObj[ele] = obj[ele];
  });
  return newObj;
}

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm)
    return next(createError(404, "This route is not for password updates"));

  const filteredBody = filterObj(req.body, "name", "email", "phoneNumber");
  const updatedUser = await Users.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  const now = new Date();
  if (!req.body.password || !req.body.passwordConfirm)
    return next(createError(400, "please fill in your password details"));

  if (
    !(await req.user.comparePassword(req.body.password, req.user.password)) ||
    !(await req.user.comparePassword(
      req.body.passwordConfirm,
      req.user.password
    ))
  )
    return next(
      createError(
        400,
        "incorrect password.Please check again or reset your password if you forgot"
      )
    );
  const user = await Users.findByIdAndUpdate(req.user.id, {
    deleteAccount: true,
    timeToDeleteAccount: date.addMonths(now, 30),
  });
  res.status(200).json({
    status:
      "success, Your account has been deactivated for 30days. You can comeback anytime and login to gain full access to your account. After 30days your account will be permanently deactivated",
    data: null,
  });
});
