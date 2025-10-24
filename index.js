import dotenv from "dotenv";
dotenv.config();
import express, { json } from "express";
import cors from "cors";
import connectMongooseDb from "./lib/mongoose.js";
import Item from "./models/item.model.js";
import User from "./models/user.model.js";

import admin from "firebase-admin";
import RecoveredItem from "./models/recoveredItem.model.js";

// firebase admin initialize
let serviceAccount;
let decodedServiceKeyString;

try {
  const rawEnvKey = process.env.FIREBASE_SERVICES_KEY;

  if (!rawEnvKey) {
    throw new Error(
      "FIREBASE_SERVICES_KEY is not defined in environment variables."
    );
  }

  decodedServiceKeyString = Buffer.from(rawEnvKey, "base64").toString("utf8");
  serviceAccount = JSON.parse(decodedServiceKeyString);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error("Firebase Admin Initialization Error:", error.message);
  process.exit(1);
}

const firebaseAuth = admin.auth();

// Secure API Middleware
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    req.decoded = decodedToken;
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
    origin: [
      "https://found-lost-items-client.vercel.app",
      "https://find-lost-items-993d8.web.app",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(json());

// ------------ API ROUTES START -----------

// --------- User Routes ---------

// GET all users or by email query
app.get("/users", async (req, res) => {
  try {
    const email = req.query.email;

    let users;

    if (email) {
      // Fetch user by email
      const user = await User.findOne({ email }).lean();

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      users = user;
    } else {
      // Fetch all users
      users = await User.find().sort({ createdAt: -1 }).lean();
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET user by ID
app.get("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await User.findById(id).lean();
    if (!result) {
      return res.status(404).send({ message: "User not found" });
    }
    res.status(200).send(result); // Changed to send with status
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// POST a new or existing user into database
app.post("/users", async (req, res) => {
  try {
    const userData = req.body;
    const { email } = userData;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = await User.create(userData);
      return res.status(201).json({
        message: "New user created",
        user,
      });
    } else {
      // Update existing user's lastSignIn
      user.lastSignIn = new Date();
      await user.save();

      return res.status(200).json({
        message: "User sign-in updated",
        user,
      });
    }
  } catch (error) {
    console.error("Error adding/updating user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update user by email
app.patch("/users", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.query.email;
    const updateData = req.body;

    if (!email) {
      return res
        .status(400)
        .send({ message: "Email query parameter is required" });
    }

    // Ensure the authenticated user is updating their own profile
    if (email !== req.decoded.email) {
      return res
        .status(403)
        .send({ message: "Forbidden: You can only update your own profile." });
    }

    const result = await User.findOneAndUpdate(
      { email },
      { $set: updateData },
      { new: true }
    );

    if (!result) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send(result);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// DELETE user by ID
app.delete("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await User.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).send({ message: "User not found" });
    }
    res.status(200).send({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// ---------- Items Routes ----------

// GET all items
app.get("/items", async (req, res) => {
  try {
    const result = await Item.find({ status: "not-recovered" }).sort({
      createdAt: -1,
    });

    res.status(200).send(result);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// GET user's own items (requires authentication valid user)
app.get("/myItems/:userId", verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res
        .status(400)
        .send({ message: "userId query parameter is required" });
    }

    const result = await Item.find({ userId }).sort({ createdAt: -1 }).lean();
    res.status(200).send(result);
  } catch (error) {
    console.error("Error fetching user's items:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// GET a single item by ID
app.get("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await Item.findById(id).lean();
    if (!result) {
      return res.status(404).send({ message: "Item not found" });
    }
    res.status(200).send(result);
  } catch (error) {
    console.error("Error fetching single item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// POST a new item (requires authentication logged in user)
app.post("/items", verifyFirebaseToken, async (req, res) => {
  // Added verifyFirebaseToken
  try {
    const itemData = req.body;
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

    const result = await Item.create(itemData);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// PATCH update an item by ID (requires authentication and ownership check)
app.patch("/items/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;

    const itemToUpdate = await Item.findById(id);

    if (!itemToUpdate) {
      return res.status(404).send({ message: "Item not found" });
    }

    const result = await Item.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    res.status(200).send(result);
  } catch (error) {
    console.error("Error patching item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// DELETE an item by ID (requires authentication and ownership check)
app.delete("/items/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const id = req.params.id;

    const itemToDelete = await Item.findById(id);

    if (!itemToDelete) {
      return res.status(404).send({ message: "Item not found" });
    }

    if (itemToDelete.userId.toString() !== req.decoded.uid) {
      return res
        .status(403)
        .send({ message: "Forbidden: You do not own this item" });
    }

    const result = await Item.findByIdAndDelete(id).lean();

    res.status(200).send({
      message: "Item deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// ------------ Recovery Routes -----------

// GET all recovery items
app.get("/recoverItems", async (req, res) => {
  try {
    const result = await RecoveredItem.find().sort({ createdAt: -1 }).lean();
    res.status(200).send(result);
  } catch (error) {
    console.error("Error fetching recovery items:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// POST a new recovery item
app.post("/recoverItems", async (req, res) => {
  try {
    const clientRecoveredData = req.body;
    const { itemId, userId, recoveryInfo } = clientRecoveredData;

    // Validate required fields
    if (!itemId || !userId || !recoveryInfo) {
      return res
        .status(400)
        .send({ message: "Missing required recovery information" });
    }

    // Create a new RecoveredItem
    const createdRecoveredItem = await RecoveredItem.create(
      clientRecoveredData
    );

    await Item.findByIdAndUpdate(
      itemId,
      { status: "recovered" },
      { new: true }
    );

    res.status(201).send(createdRecoveredItem);
  } catch (error) {
    console.error("Error creating recovered item:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// ------------ API ROUTES END -----------

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
