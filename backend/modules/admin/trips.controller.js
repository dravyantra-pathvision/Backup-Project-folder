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

const deleteTripPermanent = async (req, res) => {
  try {
    await tripsService.deleteTripPermanent(req.params.id, req.user?.uid);
    res.json({ success: true, message: 'Trip permanently deleted' });
  } catch (err) {
    handleError(res, 'Error permanently deleting trip', err);
  }
};

const deleteTrip = async (req, res) => {
  if (req.query.permanent === 'true' || req.body?.permanent === true) {
    return deleteTripPermanent(req, res);
  }
  try {
    await tripsService.softDeleteTrip(req.params.id, req.user?.uid);
    res.json({ success: true, message: 'Trip moved to Recycle Bin' });
  } catch (err) {
    handleError(res, 'Error moving trip to Recycle Bin', err);
  }
};

const restoreTrip = async (req, res) => {
  try {
    const data = await tripsService.restoreTrip(req.params.id, req.user?.uid);
    res.json({ success: true, message: 'Trip restored successfully', data });
  } catch (err) {
    handleError(res, 'Error restoring trip', err);
  }
};

module.exports = {
  getAllTrips,
  getTripById,
  getTripTimeline,
  exportTrips,
  deleteTrip,
  restoreTrip,
  deleteTripPermanent,
};
