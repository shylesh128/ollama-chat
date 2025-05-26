// errorController.js
// Global error handler middleware

const errorController = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    status,
    message,
  });
};

export default errorController;
