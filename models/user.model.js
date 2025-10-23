import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    photo: {
      type: String,
      default: "",
      trim: true,
    },
    lastSignIn: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

if (mongoose.models.User) {
  mongoose.deleteModel("User");
}

const User = mongoose.model("User", userSchema);

export default User;
