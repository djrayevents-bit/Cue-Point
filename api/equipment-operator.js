const { handleOperator } = require("./_lib/equipmentTags");

module.exports = function equipmentOperator(req, res) {
  return handleOperator(req, res);
};
