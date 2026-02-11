
import dotenv from "dotenv";
import path from "path";

// Load .env file from project root (one directory up from src)
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (result.error) {
    console.error("Error loading .env file in initEnv:", result.error);
} else {
    console.log("Environment variables loaded in initEnv");
}
