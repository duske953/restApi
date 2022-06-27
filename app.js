require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const productRouter = require("./Routes/productRoutes");
const userRouter = require("./Routes/userRoutes");
const errorController = require("./Controller/errorController");

app.use(helmet());

app.use(express.json({ limit: "10kb" }));

app.use(mongoSanitize());

app.use(xss());

app.use(hpp());

const limiter = rateLimit({
  max: 200,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from ths IP",
});
app.use("/api", limiter);

mongoose
  .connect("mongodb://localhost/Ecommerce")
  .then(() => console.log("database connected"))
  .catch(() => "something went wrong with the connection");

app.use("/api/v1/products", productRouter);
app.use("/api/v1/users", userRouter);

app.use(errorController);

app.listen(3000, () => {
  console.log("server started");
});
