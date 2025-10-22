import dotenv from "dotenv";
dotenv.config();
import express, { json } from "express";
import cors from "cors";
import Item from "./models/item.model.js";
import connectMongooseDb from "./lib/mongoose.js";

// Import the default export and name it 'admin'
import admin from "firebase-admin";

// firebase admin initialize
let serviceAccount;
let decodedServiceKeyString;

try {
  const rawEnvKey = process.env.FIREBASE_SERVICES_KEY;

  try {
    decodedServiceKeyString = Buffer.from(rawEnvKey, "base64").toString("utf8");
  } catch (decodeError) {
    console.error("Decode Error:", decodeError.message);
  }

  try {
    serviceAccount = JSON.parse(decodedServiceKeyString);
  } catch (parseError) {
    console.error("Parse Error:", parseError.message);
  }

  // Use 'admin' directly for initialization
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error("Root Error message:", error.message);
  process.exit(1);
}

// Use 'admin.auth()' after initialization
const firebaseAuth = admin.auth();

// Secure API Middleware
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    console.error("Firebase token verification error:", error);
    return res.status(401).send({ message: "unauthorized access" });
  }
};

// create app & port
const app = express();
const port = process.env.PORT || 3000;

// App Middleware
app.use(
  cors({
    origin: ["https://find-lost-items-993d8.web.app", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(json());

// GET all items (or by email for individual user)
app.get("/items", async (req, res) => {
  try {
    // Query parameter for the owner's email
    const email = req.query.email;

    // Define a variable to hold the result
    let result;

    // If email is provided, find items by provided email or all non-recovered
    if (email) {
      // Find items where contact_info matches the provided email
      result = await Item.find({ contactInfo: email }).sort({ createdAt: -1 });
    } else {
      // Find all non-recovered items by default
      result = await Item.find({ status: "not-recovered" }).sort({
        createdAt: -1,
      });
    }

    // Send the result
    res.send(result, { status: 200 });
  } catch (error) {
    // Log the error
    console.error("Error fetching items:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// GET user's own items (requires authentication valid user)
app.get("/myItems", async (req, res) => {
  const email = req.query.email; // Query parameter for the owner's email

  try {
    // Ensure the requested email matches the authenticated user's email
    // if (email !== req.decoded.email) {
    //   return res.status(403).send({ message: "forbidden access" });
    // }

    // Find items where contact_info matches the provided email
    const result = await Item.find({ contact_info: email })
      .sort({ date: -1 })
      .lean();

    // Send the result
    res.send(result, { status: 200 });
  } catch (error) {
    // Log the error
    console.error("Error fetching user's items:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// GET a single item by ID
app.get("/items/:id", async (req, res) => {
  try {
    // Get the item ID from the request parameters
    const id = req.params.id;

    // Mongoose's findById handles casting string ID to ObjectId automatically
    const result = await Item.findById(id).lean();

    // Check if the item was found
    if (!result) {
      return res.status(404).send({ message: "Item not found" });
    }

    // Send the result
    res.send(result);
  } catch (error) {
    // Log the error
    console.error("Error fetching single item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// POST a new item (requires authentication logged in user)
app.post("/items", async (req, res) => {
  try {
    // Get the item data from the request body
    const itemData = req.body;

    // Destructure required fields
    const {
      postType,
      thumbnail,
      title,
      description,
      category,
      location,
      userId,
    } = itemData;

    // Validate required fields
    if (
      !postType ||
      !thumbnail ||
      !title ||
      !description ||
      !category ||
      !location ||
      !userId
    ) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    // Create a new item
    const result = await Item.create(itemData);

    // Return the created item
    res.status(201).send(result);
  } catch (error) {
    // Handle errors
    console.error("Error creating item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// PATCH update an item by ID (requires authentication and ownership check)
app.patch("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;

    // First, find the item
    const itemToUpdate = await Item.findById(id);

    // Check if the item was found
    if (!itemToUpdate) {
      return res.status(404).send({ message: "Item not found" });
    }

    // Ensure the authenticated user owns the item
    // if (itemToUpdate.contactInfo !== req.decoded.email) {
    //   return res
    //     .status(403)
    //     .send({ message: "Forbidden: You do not own this item" });
    // }

    // Update the item
    const result = await Item.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    // Send the updated item
    res.send(result, { status: 200 });
  } catch (error) {
    // Log the error
    console.error("Error patching item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// app.delete("/items/:id", verifyFirebaseToken, async (req, res) => {};
// DELETE an item by ID (requires authentication and ownership check)
app.delete("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // First, find the item
    const itemToDelete = await Item.findById(id);

    // Check if the item was found
    if (!itemToDelete) {
      return res.status(404).send({ message: "Item not found" });
    }

    // Ensure the authenticated user owns the item
    // if (itemToDelete.contactInfo !== req.decoded.email) {
    //   return res
    //     .status(403)
    //     .send({ message: "Forbidden: You do not own this item" });
    // }

    // Delete the item
    const result = await Item.findByIdAndDelete(id).lean();

    // Send the deleted item
    res.send({
      message: "Item deleted successfully",
      data: result,
      status: 200,
    });
  } catch (error) {
    // Log the error
    console.error("Error deleting item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// ---------- server default response ----------
app.get("/", (req, res) => {
  res.send("Find Lost Items Server Running Successfully.");
});

// Start server only after successful DB connection
const startServer = async () => {
  const dbConnectionStatus = await connectMongooseDb();

  // Check if DB connection was successful
  if (dbConnectionStatus.success) {
    console.log(dbConnectionStatus.message);
    // Start the server by listening on the specified port
    app.listen(port, () => {
      console.log("Find Lost Items Server Listening On Port:", port);
    });
  } else {
    console.error("Failed to connect to MongoDB:", dbConnectionStatus.message);
    process.exit(1);
  }
};

// Start the server
startServer();
