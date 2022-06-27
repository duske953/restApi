const axios = require("axios");
const products = require("./../model/productsModel");
const mongoose = require("mongoose");
(async function () {
  try {
    await mongoose.connect("mongodb://localhost:27017/Ecommerce");
    console.log("connected successfully");
  } catch (err) {
    console.log("something went wrong");
  }
})();

async function importData() {
  try {
    const data = await axios.get("https://dummyjson.com/products?limit=100");
    await products.create(data.data.products);
    console.log("data loaded successfully");
  } catch (err) {
    console.log(err.message);
  }
}

async function deleteData() {
  try {
    await products.deleteMany();
    console.log("data deleted");
  } catch (err) {
    console.log(err.message);
  }
}

importData();

// deleteData();
