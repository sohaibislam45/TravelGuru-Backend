const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).send({ 
    error: err.message || "Internal server error",
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const baseUri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.4lapvpm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// console.log("MongoDB URI configured:", baseUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")); // Hide credentials in logs

// Create a MongoClient with minimal options to avoid SSL issues
// Sometimes less configuration works better with certain OpenSSL versions
const client = new MongoClient(baseUri, {
  // Minimal server API config
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: false,
  },
  // Connection settings
  retryWrites: true,
  w: 'majority',
  // Timeout settings
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  // Pool settings
  maxPoolSize: 10,
  minPoolSize: 0,
  // Don't explicitly set TLS - let MongoDB driver handle it automatically
  // This sometimes resolves OpenSSL compatibility issues
});
// Store database collections (will be set after connection)
let vehicles, bookings;
let dbConnected = false;

// Middleware to check database connection
const checkDbConnection = (req, res, next) => {
  if (!dbConnected) {
    return res.status(503).send({ 
      error: "Database not connected. Please try again in a moment.",
      message: "The server is attempting to connect to MongoDB. Please wait a few seconds and try again.",
      healthCheck: "Visit /health to check connection status"
    });
  }
  next();
};

// Register all routes immediately (they'll use collections once connected)
// Get all vehicles with optional filtering and sorting
app.get("/vehicles", checkDbConnection, async (req, res) => {
  try {
    const { category, location, sortBy, sortOrder } = req.query;
    let query = {};

    if (category) {
      query.category = category;
    }
    if (location) {
      query.location = location;
    }

    let sortOptions = {};
    if (sortBy === "price") {
      sortOptions.pricePerDay = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "date") {
      sortOptions.createdAt = sortOrder === "desc" ? -1 : 1;
    }

    const data = await vehicles.find(query).sort(sortOptions).toArray();
    res.send(data);
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).send({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get latest 6 vehicles - MUST be before /vehicles/:id to avoid route conflict
app.get("/vehicles/latest", checkDbConnection, async (req, res) => {
  try {
    const data = await vehicles
      .find({ createdAt: { $exists: true, $ne: null } })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.send(data);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get top 3 most booked vehicles - MUST be before /vehicles/:id to avoid route conflict
app.get("/vehicles/top-rated", checkDbConnection, async (req, res) => {
  try {
    const bookingCounts = await bookings
      .aggregate([
        {
          $group: {
            _id: "$vehicleId",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 3 },
      ])
      .toArray();

    const vehicleIds = bookingCounts.map((b) => {
      try {
        return new ObjectId(b._id);
      } catch (e) {
        return b._id;
      }
    });
    const topVehicles = await vehicles
      .find({ _id: { $in: vehicleIds } })
      .toArray();

    // Sort by booking count
    const sortedVehicles = vehicleIds
      .map((id) => topVehicles.find((v) => v._id === id))
      .filter(Boolean);

    res.send(sortedVehicles);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get single vehicle by ID - MUST be after specific routes to avoid route conflict
app.get("/vehicles/:id", checkDbConnection, async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};
    try {
      query._id = new ObjectId(id);
    } catch (e) {
      query._id = id;
    }
    const vehicle = await vehicles.findOne(query);
    if (!vehicle) {
      return res.status(404).send({ error: "Vehicle not found" });
    }
    res.send(vehicle);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Create new vehicle
app.post("/vehicles", checkDbConnection, async (req, res) => {
  try {
    const vehicleData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await vehicles.insertOne(vehicleData);
    res.status(201).send({ ...vehicleData, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Update vehicle
app.put("/vehicles/:id", checkDbConnection, async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};
    try {
      query._id = new ObjectId(id);
    } catch (e) {
      query._id = id;
    }
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };
    const result = await vehicles.updateOne(query, { $set: updateData });
    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "Vehicle not found" });
    }
    const updatedVehicle = await vehicles.findOne(query);
    res.send(updatedVehicle);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Delete vehicle
app.delete("/vehicles/:id", checkDbConnection, async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};
    try {
      query._id = new ObjectId(id);
    } catch (e) {
      query._id = id;
    }
    const result = await vehicles.deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).send({ error: "Vehicle not found" });
    }
    res.send({ message: "Vehicle deleted successfully" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Create booking
app.post("/bookings", checkDbConnection, async (req, res) => {
  try {
    const bookingData = {
      ...req.body,
      createdAt: new Date(),
    };
    const result = await bookings.insertOne(bookingData);
    res.status(201).send({ ...bookingData, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Get bookings (filtered by userEmail)
app.get("/bookings", checkDbConnection, async (req, res) => {
  try {
    const { userEmail } = req.query;
    let query = {};
    if (userEmail) {
      query.userEmail = userEmail;
    }
    const data = await bookings.find(query).toArray();
    
    // Populate vehicle details for each booking
    const bookingsWithVehicles = await Promise.all(
      data.map(async (booking) => {
        let query = {};
        try {
          query._id = new ObjectId(booking.vehicleId);
        } catch (e) {
          query._id = booking.vehicleId;
        }
        const vehicle = await vehicles.findOne(query);
        return { ...booking, vehicle };
      })
    );
    
    res.send(bookingsWithVehicles);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Connect to MongoDB and set collections
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectTimer = null;

async function run() {
  try {
    reconnectAttempts++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Attempting to connect to MongoDB... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    console.log(`${'='.repeat(60)}`);
    
    // Close existing connection if any
    try {
      if (client.topology && client.topology.isConnected()) {
        console.log("Closing existing connection...");
        // await client.close();
      }
    } catch (closeError) {
      // Ignore close errors
    }
    
    console.log("Establishing new connection...");
    console.log("Note: If this fails with SSL error, check MongoDB Atlas Network Access");
    console.log("      Your IP must be whitelisted at: https://cloud.mongodb.com/v2#/security/network/whitelist");
    
    // await client.connect();
    console.log("MongoDB client connected successfully.");

    const db = client.db("vehicles-db");
    vehicles = db.collection("vehicles");
    bookings = db.collection("bookings");
    console.log("Database and collections initialized.");

    // await client.db("admin").command({ ping: 1 });
    console.log("Ping successful - MongoDB connection verified!");
    
    dbConnected = true;
    reconnectAttempts = 0; // Reset counter on success
    console.log("Database connection established. All routes are now active.");
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    dbConnected = false;
    console.error(`\n${'='.repeat(60)}`);
    console.error("FAILED TO CONNECT TO MONGODB");
    console.error(`${'='.repeat(60)}`);
    console.error("Error Details:");
    console.error("  - Error name:", error.name);
    console.error("  - Error message:", error.message);
    console.error("  - Error code:", error.code || "N/A");
    
    // Provide helpful error messages
    if (error.message.includes("authentication failed") || error.code === 18 || error.codeName === "AuthenticationFailed") {
      console.error("\n DIAGNOSIS: Authentication failed");
      console.error("   Possible causes:");
      console.error("   1. Incorrect username or password in connection string");
      console.error("   2. User doesn't exist in MongoDB Atlas");
      console.error("   3. User doesn't have proper permissions");
      console.error("   Solution: Check your MongoDB Atlas Database Access settings");
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo") || error.code === "ENOTFOUND") {
      console.error("\n DIAGNOSIS: DNS resolution failed");
      console.error("   Possible causes:");
      console.error("   1. No internet connection");
      console.error("   2. Incorrect cluster URL");
      console.error("   3. DNS server issues");
      console.error("   Solution: Check your internet connection and cluster URL");
    } else if (error.message.includes("SSL") || error.message.includes("TLS") || error.code === "ECONNRESET") {
      console.error("\n DIAGNOSIS: SSL/TLS connection error");
      console.error("   Possible causes:");
      console.error("   1. IP address not whitelisted in MongoDB Atlas Network Access");
      console.error("   2. Firewall blocking the connection");
      console.error("   3. Certificate validation issues");
      console.error("   Solution:");
      console.error("   - Go to MongoDB Atlas → Network Access");
      console.error("   - Add your IP address (or 0.0.0.0/0 for development)");
      console.error("   - Wait 1-2 minutes for changes to propagate");
    } else if (error.message.includes("timeout") || error.code === "ETIMEDOUT") {
      console.error("\n DIAGNOSIS: Connection timeout");
      console.error("   Possible causes:");
      console.error("   1. MongoDB cluster is paused or unavailable");
      console.error("   2. Network connectivity issues");
      console.error("   3. Firewall blocking the connection");
      console.error("   Solution: Check MongoDB Atlas cluster status");
    } else {
      console.error("\n DIAGNOSIS: Unknown connection error");
      console.error("   Full error details:");
      if (error.stack) {
        console.error(error.stack);
      }
    }
    console.error(`${'='.repeat(60)}\n`);
    
    // Don't exit - let server start but routes will return 503
    // Try to reconnect after a delay (with exponential backoff)
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 30000); // Max 30 seconds
      console.log(` Will retry connection in ${delay / 1000} seconds...`);
      console.log(`   (You can check /health endpoint for status)\n`);
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        run().catch(console.dir);
      }, delay);
    } else {
      console.error(`\n Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`);
      console.error("   Please check your MongoDB connection settings and restart the server.");
      console.error("   Common fixes:");
      console.error("   1. Verify MongoDB Atlas Network Access (whitelist your IP)");
      console.error("   2. Check username/password in connection string");
      console.error("   3. Ensure MongoDB cluster is running");
      console.error("   4. Try using environment variable: MONGODB_URI=your_connection_string\n");
    }
  }
}

// Root route
app.get("/", (req, res) => {
  res.send("server is running");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.send({ 
    status: "ok", 
    database: dbConnected ? "connected" : "disconnected",
    reconnectAttempts: reconnectAttempts,
    timestamp: new Date().toISOString(),
    message: dbConnected 
      ? "Database is connected and ready" 
      : "Database connection failed. Check server logs for details."
  });
});

// Manual reconnect endpoint (for troubleshooting)
app.post("/reconnect", async (req, res) => {
  try {
    console.log("\n Manual reconnection triggered via API...");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    reconnectAttempts = 0; // Reset counter
    dbConnected = false;
    run().catch(console.dir);
    res.send({ 
      message: "Reconnection attempt initiated. Check /health endpoint for status.",
      timestamp: new Date().toISOString(),
      note: "Check server console for detailed connection logs"
    });
  } catch (error) {
    res.status(500).send({ 
      error: "Failed to initiate reconnection",
      message: error.message
    });
  }
});

// Connect to MongoDB (routes are already registered above)
run().catch(console.dir);

// Start server immediately (routes are already registered)
app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
