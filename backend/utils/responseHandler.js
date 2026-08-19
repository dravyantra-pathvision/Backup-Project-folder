// utils/responseHandler.js
// DRY utility for error logging and formatting responses

const handleError = (res, message, err, statusCode = 500) => {
  console.error(`${message}:`, err);
  
  const finalStatusCode = (err && err.statusCode) 
    ? err.statusCode 
    : ((err && err.message && err.message.includes('not found')) ? 404 : statusCode);
  const clientMessage = err && err.message ? err.message : 'Internal server error';
  
  res.status(finalStatusCode).json({ error: clientMessage });
};

module.exports = {
  handleError
};
