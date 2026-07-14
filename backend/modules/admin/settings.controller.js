const settingsService = require('./settings.service');
const { handleError } = require('../../utils/responseHandler');

const getAllSettings = async (req, res) => {
  try {
    const data = await settingsService.getAllSettings();
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching settings', err);
  }
};

const getSettingByKey = async (req, res) => {
  try {
    const data = await settingsService.getSettingByKey(req.params.key);
    if (!data) return res.status(404).json({ error: 'Setting not found' });
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching setting detail', err);
  }
};

const updateSetting = async (req, res) => {
  try {
    const { value, reason } = req.body;
    const adminUid = req.user.uid;
    const isSuperAdmin = !!req.user.isSuperAdmin;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const data = await settingsService.updateSetting(req.params.key, value, adminUid, isSuperAdmin, reason);
    res.json({ success: true, message: 'Setting updated successfully', data });
  } catch (err) {
    if (err.message.includes('Super Admin')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    handleError(res, 'Error updating setting', err);
  }
};

const getSettingsHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50, key } = req.query;
    const data = await settingsService.getSettingsHistory(key, Number(page), Number(limit));
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching settings history', err);
  }
};

module.exports = {
  getAllSettings,
  getSettingByKey,
  updateSetting,
  getSettingsHistory
};
