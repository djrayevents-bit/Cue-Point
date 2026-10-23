const { handleTags } = require("./_lib/equipmentTags");

module.exports = function equipmentTags(req, res) {
  return handleTags(req, res);
};
