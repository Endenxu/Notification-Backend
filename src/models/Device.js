import mongoose from 'mongoose';

const DeviceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  playerId: {
    type: String,
    required: true
  },
  deviceInfo: {
    platform: String,
    model: String,
    version: String
  },
  tags: {
    type: Map,
    of: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model('Device', DeviceSchema);