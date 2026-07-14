const devicesService = require('./devices.service');
const { logAuditEvent } = require('../../utils/auditLogger');

const handleError = (res, message, err) => {
  console.error(message, err);
  res.status(500).json({ error: message, details: err.message });
};

const registerDevice = async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const {
      device_id, serial_number, firmware_version, hardware_version,
      device_type, manufacturer, mac_address, imei, sim_number,
      gps_module, fuel_sensor, accelerometer
    } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const result = await devicesService.registerDevice(req.body, adminUid);
    await logAuditEvent({
      userUid: adminUid,
      module: 'Device',
      action: 'Registered',
      newValue: { device_id: req.body.device_id, ...req.body }
    }, req);
    res.status(201).json({ success: true, message: 'Device registered successfully', data: result });
  } catch (err) {
    if (err.code === '23505') { // Postgres unique violation
      return res.status(400).json({ error: 'Device ID already exists' });
    }
    handleError(res, 'Failed to register device', err);
  }
};

const getAllDevices = async (req, res) => {
  try {
    const { page, limit, search, status, manufacturer, firmware } = req.query;
    const result = await devicesService.getAllDevices({ page, limit, search, status, manufacturer, firmware });
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(res, 'Failed to fetch devices', err);
  }
};

const getDeviceDetail = async (req, res) => {
  try {
    const deviceId = req.params.id;
    const device = await devicesService.getDeviceDetail(deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json({ success: true, data: device });
  } catch (err) {
    handleError(res, 'Failed to fetch device details', err);
  }
};

const updateDevice = async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const deviceId = req.params.id;
    const device = await devicesService.updateDevice(deviceId, req.body, adminUid);
    await logAuditEvent({
      userUid: adminUid,
      module: 'Device',
      action: 'Updated',
      newValue: req.body
    }, req);
    res.json({ success: true, message: 'Device updated successfully', data: device });
  } catch (err) {
    if (err.message === 'Device not found') {
      return res.status(404).json({ error: err.message });
    }
    handleError(res, 'Failed to update device', err);
  }
};

const updateDeviceStatus = async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const deviceId = req.params.id;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const device = await devicesService.updateDeviceStatus(deviceId, status, adminUid);
    await logAuditEvent({
      userUid: adminUid,
      module: 'Device',
      action: `Status: ${status}`,
      newValue: { status }
    }, req);
    res.json({ success: true, message: 'Device status updated successfully', data: device });
  } catch (err) {
    if (err.message === 'Device not found') {
      return res.status(404).json({ error: err.message });
    }
    handleError(res, 'Failed to update device status', err);
  }
};

const deleteDevice = async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const deviceId = req.params.id;
    await devicesService.deleteDevice(deviceId, adminUid);
    await logAuditEvent({
      userUid: adminUid,
      module: 'Device',
      action: 'Deleted',
      newValue: { device_id: deviceId }
    }, req);
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (err) {
    handleError(res, 'Failed to delete device', err);
  }
};

module.exports = {
  registerDevice,
  getAllDevices,
  getDeviceDetail,
  updateDevice,
  updateDeviceStatus,
  deleteDevice
};
