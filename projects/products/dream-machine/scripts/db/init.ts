import { getDb } from "@/lib/db-core";

// Ensure schema exists and print DB path by touching it.
const db = getDb();
db.prepare("SELECT 1").get();

console.log("Dream Machine DB initialized.");
