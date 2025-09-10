import mongoose, { Document, Schema } from "mongoose";

export interface IBlockchainActivity extends Document {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: boolean;
  contractAddress: string;
  functionName: string;
  functionArgs: any;
  timestamp: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlockchainActivitySchema = new Schema<IBlockchainActivity>(
  {
    transactionHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      required: true,
      index: true,
    },
    blockHash: {
      type: String,
      required: true,
    },
    from: {
      type: String,
      required: true,
      index: true,
    },
    to: {
      type: String,
      required: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      default: "0",
    },
    gasUsed: {
      type: String,
      required: true,
    },
    gasPrice: {
      type: String,
      required: true,
    },
    status: {
      type: Boolean,
      required: true,
      index: true,
    },
    contractAddress: {
      type: String,
      required: true,
      index: true,
    },
    functionName: {
      type: String,
      required: true,
      index: true,
    },
    functionArgs: {
      type: Schema.Types.Mixed,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
      index: true,
    },
    error: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
BlockchainActivitySchema.index({ contractAddress: 1, functionName: 1 });
BlockchainActivitySchema.index({ from: 1, timestamp: -1 });
BlockchainActivitySchema.index({ to: 1, timestamp: -1 });
BlockchainActivitySchema.index({ status: 1, timestamp: -1 });
BlockchainActivitySchema.index({ blockNumber: -1 });

export const BlockchainActivity = mongoose.model<IBlockchainActivity>(
  "BlockchainActivity",
  BlockchainActivitySchema
);
