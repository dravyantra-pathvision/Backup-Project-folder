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

const getProfileAndOrg = async (req, res) => {
  const { uid } = req.user;
  try {
    const data = await userService.getProfileAndOrg(uid);
    res.json(data);
  } catch (err) {
    handleError(res, 'Error fetching profile and org', err);
  }
};

const updateProfile = async (req, res) => {
  const { uid } = req.user;
  const {
    full_name, phone, timezone,
    employee_id, department, language_pref,
    email_notif, sms_notif, push_notif,
    speed_limit_override, fuel_theft_limit_override,
  } = req.body;
  try {
    const user = await userService.updateProfile(uid, {
      full_name, phone, timezone,
      employee_id, department, language_pref,
      email_notif, sms_notif, push_notif,
      speed_limit_override, fuel_theft_limit_override,
    });
    res.json({ message: 'Profile updated', user });
  } catch (err) {
    handleError(res, 'Error updating profile', err);
  }
};

const updateOrganization = async (req, res) => {
  const { uid } = req.user;
  const {
    company_name, gstin, pan, contact_number,
    city, state, address, pincode, country,
    fleet_size, industry_type,
  } = req.body;
  try {
    const org = await userService.updateOrganization(uid, {
      company_name, gstin, pan, contact_number,
      city, state, address, pincode,
      country: country || 'India', fleet_size, industry_type,
    });
    res.json({ message: 'Organization updated', org });
  } catch (err) {
    handleError(res, 'Error updating organization', err);
  }
};

const updateLastPromptedAt = async (req, res) => {
  const { uid } = req.user;
  try {
    await userService.updateLastPromptedAt(uid);
    res.json({ message: 'Last prompted time updated' });
  } catch (err) {
    handleError(res, 'Error updating last prompted time', err);
  }
};

module.exports = {
  syncUser,
  getProfileAndOrg,
  updateProfile,
  updateOrganization,
  updateLastPromptedAt,
};
