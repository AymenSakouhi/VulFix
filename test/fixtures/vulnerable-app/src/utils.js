const _ = require("lodash");

function deepMerge(target, src) {
  return _.merge(target, src);
}

module.exports = { deepMerge };
