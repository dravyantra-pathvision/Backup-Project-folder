// utils/responseHandler.js
// DRY utility for error logging and formatting responses

const handleError = (res, message, err, statusCode = 500) => {
  console.error(`${message}:`, err);
  
  // Use a 400 Bad Request status code for validation errors like "Device not found"
  const finalStatusCode = err && err.message && err.message.includes('not found') ? 400 : statusCode;
  const clientMessage = err && err.message ? err.message : 'Internal server error';
  
  res.status(finalStatusCode).json({ error: clientMessage });
};

module.exports = {
  handleError
};
