import mongoose from "mongoose";

const recoveryInfoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    photo: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const recoveredItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recoveryInfo: {
      type: recoveryInfoSchema,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

if (mongoose.models.RecoveredItem) {
  mongoose.deleteModel("RecoveredItem");
}

const RecoveredItem = mongoose.model("RecoveredItem", recoveredItemSchema);

export default RecoveredItem;
