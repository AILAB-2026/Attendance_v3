import dotenv from "dotenv";
dotenv.config();

console.log("=== Starting Backend in Debug Mode ===");
console.log("Environment variables:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_USER:", process.env.DB_USER);
console.log("SERVER_PORT:", process.env.SERVER_PORT);

try {
  // Import and start the app
  console.log("\nImporting app.js...");
  import("./src/app.js").then(() => {
    console.log("✅ App started successfully");
  }).catch(error => {
    console.error("❌ Error starting app:", error.message);
    console.error("Stack:", error.stack);
  });
} catch (error) {
  console.error("❌ Error importing app:", error.message);
  console.error("Stack:", error.stack);
}
