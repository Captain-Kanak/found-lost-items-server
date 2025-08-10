require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// firebase admin
const admin = require("firebase-admin");
const decoded = Buffer.from(
  process.env.FIREBASE_SERVICES_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// create app & port
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: ["https://find-lost-items-993d8.web.app", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

// database management
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0d3a79b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // database collections
    const itemsCollection = client.db("found_lost_items").collection("items");
    const recoveredItemsCollection = client
      .db("found_lost_items")
      .collection("recovered_items");

    // Custom Middleware
    const verifyFirebaseToken = async (req, res, next) => {
      const authHeader = req?.headers?.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const token = authHeader.split(" ")[1];

      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      } catch (error) {
        return res.status(401).send({ message: "unauthorized access" });
      }
    };

    // items related APIs
    app.get("/items", async (req, res) => {
      const email = req.query.email;

      try {
        let result;

        if (email) {
          result = await itemsCollection
            .find({ contact_info: email })
            .sort({ date: -1 })
            .toArray();
        } else {
          result = await itemsCollection
            .find({ status: "not-recovered" })
            .sort({ date: -1 })
            .toArray();
        }

        res.send(result);
      } catch (error) {
        console.error("Error fetching items:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/items/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await itemsCollection.findOne(query);
      res.send(result);
    });

    // items save to the database
    app.post("/items", async (req, res) => {
      const item = req.body;
      item.status = "not-recovered";
      const result = await itemsCollection.insertOne(item);
      res.send(result);
    });

    app.patch("/items/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: req.body,
      };
      const result = await itemsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.put("/items/:id", async (req, res) => {
      const id = req.params.id;
      const updatedItem = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedItem,
      };
      const result = await itemsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.delete("/items/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await itemsCollection.deleteOne(query);
      res.send(result);
    });

    // Recovered items related APIs
    app.get("/recovered-items", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      // Filter by recoveryInfo.email
      const query = { "recoveryInfo.email": email };

      const result = await recoveredItemsCollection
        .find(query)
        .sort({ "recoveryInfo.recoveredDate": -1 })
        .toArray();

      res.send(result);
    });

    app.post("/recovered-items", async (req, res) => {
      const items = req.body;
      items.status = "recovered";
      const result = await recoveredItemsCollection.insertOne(items);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// server default response
app.get("/", (req, res) => {
  res.send("Find Lost Items Server Running Successfully.");
});

app.listen(port, () => {
  console.log("Find Lost Items Server Listening On Port:", port);
});
