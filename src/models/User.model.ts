import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  address: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    address: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["admin", "brand", "manufacturer", "certifier", "operator", "user"],
      default: "user",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
UserSchema.index({ address: 1, role: 1 });
UserSchema.index({ isActive: 1, role: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
