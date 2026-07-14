const tripsService = require('./trips.service');
const { handleError } = require('../../utils/responseHandler');

const getAllTrips = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, from_date, to_date } = req.query;
    const data = await tripsService.getAllTrips({ 
      page: Number(page), 
      limit: Number(limit),
      search,
      status,
      from_date,
      to_date
    });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching trips', err);
  }
};

const getTripById = async (req, res) => {
  try {
    const trip = await tripsService.getTripById(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }
    res.json({ success: true, trip });
  } catch (err) {
    handleError(res, 'Error fetching trip details', err);
  }
};

const getTripTimeline = async (req, res) => {
  try {
    const timeline = await tripsService.getTripTimeline(req.params.id);
    res.json({ success: true, timeline });
  } catch (err) {
    handleError(res, 'Error fetching trip timeline', err);
  }
};

const exportTrips = async (req, res) => {
  try {
    const { search, status, from_date, to_date } = req.query;
    const csvData = await tripsService.exportTrips({ search, status, from_date, to_date });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=trips_export.csv');
    res.send(csvData);
  } catch (err) {
    handleError(res, 'Error exporting trips', err);
  }
};

module.exports = {
  getAllTrips,
  getTripById,
  getTripTimeline,
  exportTrips
};
