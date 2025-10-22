import mongoose from "mongoose";

// Define Contact Info Schema
const contactInfoSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

// Define Item Schema
const itemSchema = new mongoose.Schema(
  {
    postType: {
      type: String,
      enum: ["Lost", "Found"],
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    contactInfo: {
      type: contactInfoSchema,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    lostOrFounddate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["not-recovered", "recovered"],
      default: "not-recovered",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create Item Model
const Item = mongoose.model("Item", itemSchema);

// Export the Item Model
export default Item;
