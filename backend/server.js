import "dotenv/config";
import mongoose from "mongoose";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import fs from "fs";
import app from "./app.js";
import { startDeadlineCron } from "./cron/deadlines.js";
import { ensurePermanentAdmin, migrateUserProfiles } from "./utils/userUtils.js";

const {
  MONGODB_URI,
  PORT = 5000,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_SERVICE_ACCOUNT_JSON,
  FIREBASE_SERVICE_ACCOUNT_BASE64,
} = process.env;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required in .env");
}

let serviceAccount;
if (FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
} else if (FIREBASE_SERVICE_ACCOUNT_BASE64) {
  const decoded = Buffer.from(FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
  serviceAccount = JSON.parse(decoded);
} else if (FIREBASE_SERVICE_ACCOUNT_PATH) {
  const serviceAccountJson = fs.readFileSync(
    new URL(FIREBASE_SERVICE_ACCOUNT_PATH, import.meta.url),
    "utf8"
  );
  serviceAccount = JSON.parse(serviceAccountJson);
} else {
  throw new Error("Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in environment.");
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

try {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
} catch (error) {
  console.error("Unable to connect to MongoDB. The backend cannot start without its database.");

  if (error instanceof mongoose.Error.MongooseServerSelectionError) {
    console.error(
      "Check that your Atlas cluster is active, this computer's current public IP is in Atlas > Security > Network Access, and outbound TCP port 27017 is allowed."
    );
    console.error("If you are on a restricted network, retry from another network or ask its administrator to allow MongoDB Atlas traffic.");
  }

  const causeCode = error?.cause?.code || error?.reason?.servers?.values?.().next?.().value?.error?.code;
  if (causeCode) console.error(`Connection error code: ${causeCode}`);
  console.error(error?.message || "Unknown MongoDB connection error.");
  process.exit(1);
}
await migrateUserProfiles();
await ensurePermanentAdmin();

startDeadlineCron();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
