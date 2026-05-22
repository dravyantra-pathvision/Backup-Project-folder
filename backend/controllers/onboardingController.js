// controllers/onboardingController.js
const onboardingService = require('../services/onboardingService');
const { handleError } = require('../utils/responseHandler');

const getOnboarding = async (req, res) => {
  try {
    const data = await onboardingService.getOnboarding(req.user.uid);
    res.json({ completed: data !== null, data });
  } catch (err) {
    handleError(res, 'Error checking onboarding', err);
  }
};

const saveOnboarding = async (req, res) => {
  const { company_name, gstin, contact_number, city, state } = req.body;
  
  if (!company_name) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  try {
    const data = await onboardingService.saveOnboarding(
      req.user.uid, company_name, gstin, contact_number, city, state
    );
    res.json({ message: 'Onboarding completed', data });
  } catch (err) {
    handleError(res, 'Error saving onboarding data', err);
  }
};

module.exports = {
  getOnboarding,
  saveOnboarding
};
