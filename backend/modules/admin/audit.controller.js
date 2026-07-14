const auditService = require('./audit.service');
const { handleError } = require('../../utils/responseHandler');
const { parse } = require('json2csv');

const getSystemAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const module = req.query.module;
    const user = req.query.user;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const result = await auditService.getSystemAuditLogs({ page, limit, module, user, startDate, endDate });
    res.json(result);
  } catch (error) {
    handleError(res, 'Error fetching system audit logs', error);
  }
};

const exportSystemAuditLogs = async (req, res) => {
  try {
    // For export, we might fetch a larger limit or all (within reason)
    const module = req.query.module;
    const user = req.query.user;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const result = await auditService.getSystemAuditLogs({ page: 1, limit: 10000, module, user, startDate, endDate });
    
    if (result.data.length === 0) {
      return res.status(404).json({ error: 'No audit logs found for the given criteria.' });
    }

    const fields = [
      'id', 'timestamp', 'module', 'action', 
      'user_name', 'user_email', 'user_role', 'organization_name',
      'ip_address', 'browser', 'old_value', 'new_value'
    ];
    
    const csv = parse(result.data, { fields });
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    handleError(res, 'Error exporting system audit logs', error);
  }
};

module.exports = {
  getSystemAuditLogs,
  exportSystemAuditLogs,
};
