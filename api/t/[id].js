const { handleTap } = require("../_lib/equipmentTags");

module.exports = function equipmentTagTap(req, res) {
  return handleTap(req, res);
};
