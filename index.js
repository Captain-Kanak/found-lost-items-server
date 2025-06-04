const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Find Lost Items Server Running Successfully.");
});

app.listen(port, () => {
  console.log("Find Lost Items Server Listening On Port:", port);
});
