const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");

module.exports =
  (param = "id") =>
  (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[param])) {
      return next(new ApiError(400, `Invalid ${param}`));
    }
    next();
  };
