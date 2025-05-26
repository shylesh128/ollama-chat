import "dotenv/config";
import app from "./app.js";
import connectDB from "./utils/db.js";

const port = process.env.PORT || 3000;

// Connect to databases (MongoDB and Elasticsearch)
connectDB()
  .then(() => {
    // Start server after database connections are established
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      console.log(`Swagger docs at http://localhost:${port}/api-docs`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to databases:", err);
    process.exit(1);
  });
