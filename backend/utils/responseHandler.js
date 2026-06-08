// utils/responseHandler.js
// DRY utility for error logging and formatting responses

const handleError = (res, message, err, statusCode = 500) => {
  console.error(`${message}:`, err);
  res.status(statusCode).json({ error: 'Internal server error' });
};

module.exports = {
  handleError
};
