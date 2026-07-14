// modules/admin/analytics.controller.js
const analyticsService = require('./analytics.service');
const { handleError } = require('../../utils/responseHandler');
const { parse } = require('json2csv');

const getOverview = async (req, res) => {
  try {
    const data = await analyticsService.getOverview(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching overview analytics', err);
  }
};

const getFuelAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getFuelAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching fuel analytics', err);
  }
};

const getVehicleAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getVehicleAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching vehicle analytics', err);
  }
};

const getDriverAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getDriverAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching driver analytics', err);
  }
};

const getTripAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getTripAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching trip analytics', err);
  }
};

const getDeviceAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getDeviceAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching device analytics', err);
  }
};

const getEnvironmentAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getEnvironmentAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching environment analytics', err);
  }
};

const getAlertAnalytics = async (req, res) => {
  try {
    const data = await analyticsService.getAlertAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching alert analytics', err);
  }
};

const exportAnalytics = async (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const rawData = await analyticsService.exportAnalyticsData(req.query);

    if (rawData.length === 0) {
      return res.status(404).send('No data available to export');
    }

    if (format === 'excel') {
      const headers = Object.keys(rawData[0]);
      let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
      html += '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>DravYantra Analytics</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>';
      html += '<body><h2>DravYantra System Admin - Platform Analytics Summary Report</h2>';
      html += `<p>Generated on: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}</p>`;
      html += '<table border="1">';
      html += '<tr style="background-color:#4F46E5;color:#FFFFFF;font-weight:bold;">' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
      for (const row of rawData) {
        html += '<tr>' + headers.map(h => `<td>${row[h] !== null ? row[h] : 'N/A'}</td>`).join('') + '</tr>';
      }
      html += '</table></body></html>';

      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', 'attachment; filename=platform_analytics_report.xls');
      return res.send(html);
    } 

    if (format === 'pdf' || format === 'html') {
      const headers = Object.keys(rawData[0]);
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>DravYantra Platform Analytics</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0A0D14; color: #F1F5F9; padding: 40px; }
            h1 { color: #6366F1; border-bottom: 2px solid #252D40; padding-bottom: 12px; margin-bottom: 5px; }
            .meta { color: #94A3B8; font-size: 14px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #252D40; }
            th { background-color: #12161F; color: #818CF8; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
            tr:nth-child(even) { background-color: #12161F; }
            tr:hover { background-color: #1E2438; }
            td { font-size: 14px; }
            .btn-print { background-color: #6366F1; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; float: right; }
            @media print {
              .btn-print { display: none; }
              body { background-color: white; color: black; padding: 0; }
              th { background-color: #f1f5f9; color: #1e1b4b; border-bottom: 2px solid #cbd5e1; }
              tr:nth-child(even) { background-color: #f8fafc; }
              td, th { border: 1px solid #cbd5e1; }
            }
          </style>
        </head>
        <body>
          <button class="btn-print" onclick="window.print()">Print PDF</button>
          <h1>DravYantra Platform Analytics Summary</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()} | Role: System Admin</div>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rawData.map(row => `
                <tr>
                  ${headers.map(h => `<td>${row[h] !== null ? row[h] : 'N/A'}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // Default to CSV
    const csvData = parse(rawData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=platform_analytics_report.csv');
    res.send(csvData);
  } catch (err) {
    handleError(res, 'Error exporting analytics', err);
  }
};

module.exports = {
  getOverview,
  getFuelAnalytics,
  getVehicleAnalytics,
  getDriverAnalytics,
  getTripAnalytics,
  getDeviceAnalytics,
  getEnvironmentAnalytics,
  getAlertAnalytics,
  exportAnalytics
};
