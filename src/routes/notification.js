import express from 'express';
import Device from '../models/Device.js';
import { sendNotification } from '../services/oneSignal.js';
const router = express.Router();

// Middleware to validate requests
const validateRequest = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// Sanitize user data
const sanitizeUserData = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    arabicDisplayName: user.arabicDisplayName
  };
};

// Register or update device
router.post('/devices', validateRequest, async (req, res) => {
  try {
    const { userId, playerId, deviceInfo } = req.body;
    
    if (!userId || !playerId || !deviceInfo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const sanitizedDeviceInfo = {
      platform: deviceInfo.platform,
      model: deviceInfo.model,
      version: deviceInfo.version
    };

    const device = await Device.findOneAndUpdate(
      { userId },
      { userId, playerId, deviceInfo: sanitizedDeviceInfo },
      { upsert: true, new: true }
    );
    
    res.json({ 
      success: true, 
      device: {
        userId: device.userId,
        playerId: device.playerId
      }
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to register device' 
    });
  }
});

// Send notification
router.post('/notify', validateRequest, async (req, res) => {
  try {
    const { userId, title, message } = req.body;
    
    const device = await Device.findOne({ userId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    const result = await sendNotification(device.playerId, title, message);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, error: 'Failed to send notification' });
  }
});

// Send file upload notification
router.post('/notify-file-upload', validateRequest, async (req, res) => {
  try {
    const { 
      receiverId,
      senderId,
      fileName,
      fileId,
      additionalData
    } = req.body;

    if (!receiverId || !senderId || !fileName || !fileId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const receiverDevice = await Device.findOne({ userId: receiverId });
    if (!receiverDevice) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receiver device not found' 
      });
    }

    // Enhanced notification data with required flags
    const notificationData = {
      workflowId: additionalData.workflowId,
      fileId: additionalData.fileId,
      fileName: additionalData.fileName,
      uniqueCode: additionalData.uniqueCode,
      description: additionalData.description,
      uploadDate: additionalData.uploadDate,
      ownerDetails: {
        ownerUser: sanitizeUserData(additionalData.ownerDetails?.ownerUser),
        authRequiredFromUser: sanitizeUserData(additionalData.ownerDetails?.authRequiredFromUser)
      },
      // Include all required fields for NotificationDetails screen
      id: additionalData.workflowId,
      fileUniqueCode: additionalData.uniqueCode,
      fileDescription: additionalData.description,
      startDate: additionalData.uploadDate,
      responsibleName: additionalData.ownerDetails?.authRequiredFromUser?.displayName || '',
      responsibleArabicName: additionalData.ownerDetails?.authRequiredFromUser?.arabicDisplayName || '',
      fileOwnerName: additionalData.ownerDetails?.ownerUser?.displayName || '',
      fileOwnerArabicName: additionalData.ownerDetails?.ownerUser?.arabicDisplayName || '',
      notes: '',
      status: 0,
      stepNumber: 1,
      // Authorization flags
      authRequired: true,
      canForward: true,
      canChangeResponsibleByManager: true,
      canReject: true
    };

    const title = 'New Document Authentication Required';
    const message = `Document "${fileName}" requires your authorization`;

    console.log('Sending notification with data:', JSON.stringify(notificationData, null, 2));

    const result = await sendNotification(
      receiverDevice.playerId,
      title,
      message,
      notificationData
    );

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending file upload notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notification' 
    });
  }
});

// Delete device
router.delete('/devices/:userId', validateRequest, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const result = await Device.findOneAndDelete({ userId });
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({ 
      success: true, 
      message: 'Device deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete device' 
    });
  }
});

export default router;