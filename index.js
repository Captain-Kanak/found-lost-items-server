require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// create app & port
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
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

    // items related APIs
    app.get("/items", async (req, res) => {
      const email = req.query.email;
      let result;

      if (email) {
        result = await itemsCollection
          .find({ contact_info: email })
          .sort({ date: -1 })
          .toArray();
      } else {
        result = await itemsCollection.find().sort({ date: -1 }).toArray();
      }

      res.send(result);
    });

    app.get("/items/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await itemsCollection.findOne(query);
      res.send(result);
    });

    app.post("/items", async (req, res) => {
      const items = req.body;
      items.status = "";
      const result = await itemsCollection.insertOne(items);
      res.send(result);
    });

    app.patch("/items/:id", async (req, res) => {
      const id = req.params.id;
      const updateDoc = {
        $set: req.body,
      };
      const query = { _id: new ObjectId(id) };
      const result = await itemsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // items related APIs
    app.get("/recovered-items", async (req, res) => {
      const result = await recoveredItemsCollection
        .find()
        .sort({ recoveredDate: -1 })
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
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
