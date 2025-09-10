import mongoose, { Document, Schema } from "mongoose";

export interface IIPFSData extends Document {
  hash: string;
  size: number;
  path: string;
  metadata: {
    name: string;
    description: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
    external_url?: string;
    animation_url?: string;
  };
  uploadedBy: string;
  uploadedAt: Date;
  isPinned: boolean;
  accessCount: number;
}

const IPFSDataSchema = new Schema<IIPFSData>(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    metadata: {
      name: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
      image: {
        type: String,
      },
      attributes: [
        {
          trait_type: String,
          value: Schema.Types.Mixed,
        },
      ],
      external_url: {
        type: String,
      },
      animation_url: {
        type: String,
      },
    },
    uploadedBy: {
      type: String,
      required: true,
      index: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: true,
      index: true,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
IPFSDataSchema.index({ uploadedBy: 1, uploadedAt: -1 });
IPFSDataSchema.index({ isPinned: 1, uploadedAt: -1 });
IPFSDataSchema.index({
  "metadata.name": "text",
  "metadata.description": "text",
});

export const IPFSData = mongoose.model<IIPFSData>("IPFSData", IPFSDataSchema);
