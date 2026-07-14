const driverService = require('./drivers.service');

const getAllDrivers = async (req, res) => {
  try {
    const { page, limit, search, organization, fleetOwner, status } = req.query;
    const filters = { search, organization, fleetOwner, status };
    const data = await driverService.getAllDrivers(filters, page, limit);
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
};

const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await driverService.getDriverById(id);
    res.status(200).json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    if (error.message === 'Driver not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch driver details' });
  }
};

const updateDriverStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    // Assuming admin UID is available in req.user from authentication middleware
    const adminUid = req.user ? req.user.uid : 'ADMIN';
    
    const result = await driverService.updateDriverStatus(id, status, remarks, adminUid);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating driver status:', error);
    if (error.message === 'Driver not found' || error.message === 'Invalid status') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update driver status' });
  }
};

const exportDrivers = async (req, res) => {
  try {
    const { organization, status } = req.query;
    const filters = { organization, status };
    const data = await driverService.getDriversExport(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error('Error exporting drivers:', error);
    res.status(500).json({ error: 'Failed to export drivers' });
  }
};

module.exports = {
  getAllDrivers,
  getDriverById,
  updateDriverStatus,
  exportDrivers,
};
