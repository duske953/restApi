const mongoose = require("mongoose");
const Users = require("./userModel");
const appError = require("./../utils/errorHandler");
const catchAsync = require("./../utils/catchAsync");

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "your product must have a name"],
  },

  rating: Number,
  discountPercentage: Number,
  price: {
    type: Number,
    required: [
      true,
      "please include how much you are willing to sell the product",
    ],
  },

  description: {
    type: String,
    required: [true, "please include a brief description of your product"],
  },

  brand: String,
  stock: {
    type: Number,
    required: [true, "please show how many items you are willing to sell"],
  },

  category: String,

  productOwner: {
    type: mongoose.Schema.ObjectId,
    ref: "Users",
  },

  thumbnail: {
    type: String,
    required: [true, "The product must have an image"],
  },

  images: Array,
});

// productSchema.pre("save",function(next){

//   next()
// })

// productSchema.indexes({ productOwner: 1, title: 1 }, { unique: true });

productSchema.pre("save", async function (next) {
  // getting the current user from the db
  const user = await Users.findById(this.productOwner).populate("products");

  if (!user) return;

  //checking if the current product title already exists id the product property in the userSchema
  const foundElem = user.products.some((el) => el.title === this.title);
  if (foundElem) {
    // removing the current document if it already exists in the product property present in the userSchema
    await this.constructor.findByIdAndRemove(this._id);
    next(
      appError(
        400,
        `You already have the product, ${this.title} in your account. Please create a new one or update the current product. Please note that the title of the product can't be modified`
      )
    );
  }
  next();
});

const products = mongoose.model("products", productSchema);

module.exports = products;
