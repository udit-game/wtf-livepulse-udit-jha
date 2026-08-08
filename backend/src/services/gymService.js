const gymRepository = require("../repositories/gymRepository");

async function getAllGyms() {
  return gymRepository.getAllGyms();
}

module.exports = {
  getAllGyms,
};