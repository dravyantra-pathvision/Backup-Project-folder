const { readFleetSettings, updateFleetSettings } = require('../services/fleetSettingsStore');
const { handleError } = require('../utils/responseHandler');

const getFleetSettings = async (req, res) => {
  try {
    res.json(readFleetSettings());
  } catch (err) {
    handleError(res, 'Error fetching fleet settings', err);
  }
};

const putFleetSettings = async (req, res) => {
  try {
    const next = {};
    if (typeof req.body.speedThreshold === 'number') {
      next.speedThreshold = req.body.speedThreshold;
    }
    if (typeof req.body.fuelDropThreshold === 'number') {
      next.fuelDropThreshold = req.body.fuelDropThreshold;
    }
    const updated = updateFleetSettings(next);
    if (!updated) {
      return res.status(500).json({ error: 'Unable to save fleet settings' });
    }
    res.json(updated);
  } catch (err) {
    handleError(res, 'Error updating fleet settings', err);
  }
};

module.exports = {
  getFleetSettings,
  putFleetSettings,
};