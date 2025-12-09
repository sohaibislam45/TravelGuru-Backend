/**
 * Simple MongoDB Connection Test Script
 * Run this to test your MongoDB connection independently
 * 
 * Usage: node test-connection.js
 */

const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI || 
  "mongodb+srv://sohaib:test123@cluster0.4lapvpm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

console.log("\n" + "=".repeat(60));
console.log("MongoDB Connection Test");
console.log("=".repeat(60));
console.log("URI:", uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@"));
console.log("=".repeat(60) + "\n");

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: false,
  },
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
});

async function testConnection() {
  try {
    console.log("Attempting to connect...");
    await client.connect();
    console.log("✅ Connection successful!");
    
    const db = client.db("vehicles-db");
    const collections = await db.listCollections().toArray();
    console.log("✅ Database 'vehicles-db' accessible");
    console.log("✅ Collections found:", collections.map(c => c.name).join(", ") || "None");
    
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Ping successful - MongoDB is responding");
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED - Connection is working!");
    console.log("=".repeat(60));
    console.log("\nIf your server still can't connect, the issue might be:");
    console.log("1. Server code needs to be restarted");
    console.log("2. Different connection settings in server/index.js");
    console.log("3. Check server logs for other errors\n");
    
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ CONNECTION FAILED");
    console.error("=".repeat(60));
    console.error("Error:", error.name);
    console.error("Message:", error.message);
    console.error("\n" + "=".repeat(60));
    
    if (error.message.includes("authentication") || error.code === 18) {
      console.error("\n🔍 ISSUE: Authentication Failed");
      console.error("   → Check username/password in connection string");
      console.error("   → Verify user exists in MongoDB Atlas → Database Access");
    } else if (error.message.includes("SSL") || error.message.includes("TLS") || error.message.includes("alert")) {
      console.error("\n🔍 ISSUE: SSL/TLS Error (Most Common: IP Not Whitelisted)");
      console.error("\n   📋 STEP-BY-STEP FIX:");
      console.error("   1. Go to: https://cloud.mongodb.com/");
      console.error("   2. Click 'Network Access' in left sidebar");
      console.error("   3. Click 'Add IP Address' button");
      console.error("   4. Click 'Allow Access from Anywhere' (0.0.0.0/0)");
      console.error("      OR add your current IP address");
      console.error("   5. Click 'Confirm'");
      console.error("   6. Wait 1-2 minutes");
      console.error("   7. Run this test again: node test-connection.js");
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
      console.error("\n🔍 ISSUE: DNS/Network Error");
      console.error("   → Check your internet connection");
      console.error("   → Verify cluster URL is correct");
    } else if (error.message.includes("timeout")) {
      console.error("\n🔍 ISSUE: Connection Timeout");
      console.error("   → Check if MongoDB cluster is running (not paused)");
      console.error("   → Check firewall settings");
    }
    
    console.error("\n" + "=".repeat(60) + "\n");
    process.exit(1);
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

testConnection();

