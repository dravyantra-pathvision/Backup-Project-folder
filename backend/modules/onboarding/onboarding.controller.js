const onboardingService = require('./onboarding.service');

exports.getStatus = async (req, res) => {
  try {
    const org = await onboardingService.getStatus(req.user.uid);
    res.json({ success: true, data: org });
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch status' });
  }
};

exports.updateStep = async (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId, 10);
    const org = await onboardingService.updateStep(req.user.uid, req.body, stepId);
    res.json({ success: true, data: org });
  } catch (error) {
    console.error('Error updating onboarding step:', error);
    res.status(500).json({ success: false, message: 'Failed to update step' });
  }
};

exports.submitForApproval = async (req, res) => {
  try {
    const org = await onboardingService.submitForApproval(req.user.uid);
    res.json({ success: true, data: org });
  } catch (error) {
    console.error('Error submitting onboarding:', error);
    res.status(500).json({ success: false, message: 'Failed to submit' });
  }
};
