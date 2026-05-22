// controllers/userController.js
const userService = require('../services/userService');
const { handleError } = require('../utils/responseHandler');

const syncUser = async (req, res) => {
  const { uid, email } = req.user;
  const { full_name, role = 'fleet_owner' } = req.body;

  try {
    const user = await userService.syncUser(uid, email, full_name, role);
    res.json({ message: 'User synced', user });
  } catch (err) {
    handleError(res, 'Error syncing user', err);
  }
};

module.exports = {
  syncUser
};
