import mongoose, { Document, Schema } from "mongoose";

export interface IApiKey extends Document {
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
  lastUsed?: Date;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    permissions: [
      {
        type: String,
        enum: [
          "main:read",
          "main:write",
          "passport:read",
          "passport:write",
          "ownership:read",
          "ownership:write",
          "provenance:read",
          "provenance:write",
          "forwarder:read",
          "forwarder:write",
          "admin:all",
        ],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsed: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
ApiKeySchema.index({ key: 1, isActive: 1 });
ApiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ApiKey = mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
