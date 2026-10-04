const ApiError = require("./ApiError");

exports.str = (value, label, { min = 1, max = 1000, required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ApiError(400, `${label} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new ApiError(400, `${label} must be a string`);
  const v = value.trim();
  if (v.length < min || v.length > max) {
    throw new ApiError(400, `${label} must be between ${min} and ${max} characters`);
  }
  return v;
};

exports.oneOf = (value, list, label, { required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ApiError(400, `${label} is required`);
    return undefined;
  }
  if (!list.includes(value)) throw new ApiError(400, `${label} must be one of: ${list.join(", ")}`);
  return value;
};

// Accepts an array or a comma-separated string. Returns unique, trimmed strings.
exports.strArray = (value, label, { maxItems = 20, maxLen = 100, lower = false } = {}) => {
  if (value === undefined || value === null || value === "") return [];
  let arr = value;
  if (typeof value === "string") arr = value.split(",");
  if (!Array.isArray(arr)) throw new ApiError(400, `${label} must be an array or comma-separated string`);
  const out = [];
  for (let item of arr) {
    if (typeof item !== "string") throw new ApiError(400, `${label} must contain only strings`);
    item = item.trim();
    if (lower) item = item.toLowerCase();
    if (!item) continue;
    if (item.length > maxLen) throw new ApiError(400, `${label} items must be at most ${maxLen} characters`);
    if (!out.includes(item)) out.push(item);
  }
  if (out.length > maxItems) throw new ApiError(400, `${label} can have at most ${maxItems} items`);
  return out;
};

exports.escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
