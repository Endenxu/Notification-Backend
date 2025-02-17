import express from "express";
import Device from "../models/Device.js";
import { sendNotification } from "../services/oneSignal.js";
const router = express.Router();

// Middleware to validate requests
const validateRequest = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
};

// Sanitize user data
const sanitizeUserData = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    arabicDisplayName: user.arabicDisplayName,
  };
};

// Register or update device
router.post("/devices", validateRequest, async (req, res) => {
  try {
    const { userId, playerId, deviceInfo, language } = req.body;

    if (!userId || !playerId || !deviceInfo) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const sanitizedDeviceInfo = {
      platform: deviceInfo.platform,
      model: deviceInfo.model,
      version: deviceInfo.version,
    };

    const device = await Device.findOneAndUpdate(
      { userId },
      { userId, playerId, deviceInfo: sanitizedDeviceInfo },
      { upsert: true, new: true }
    );

    /* Temporarily removed welcome notification
    // Welcome notification content based on language
    const welcomeMessage = {
      en: {
        title: "Welcome to TAMER APP",
        message: "Thank you for joining us! We're glad to have you here.",
      },
      ar: {
        title: "مرحباً بك في تطبيق تمر",
        message: "شكراً لانضمامك إلينا! نحن سعداء بوجودك هنا.",
      },
    };

    // Use the specified language or default to English
    const messageContent =
      language && welcomeMessage[language]
        ? welcomeMessage[language]
        : welcomeMessage.en;

    setTimeout(async () => {
      try {
        await sendNotification(
          device.playerId,
          messageContent.title,
          messageContent.message,
          {
            type: "welcome",
            userId: device.userId,
            language: language || "en", // Include language in notification data
          }
        );
        console.log(
          `Welcome notification sent to user ${userId} after 5-second delay in ${
            language || "en"
          }`
        );
      } catch (notificationError) {
        console.error("Error sending welcome notification:", notificationError);
      }
    }, 5000);
     */

    res.json({
      success: true,
      device: {
        userId: device.userId,
        playerId: device.playerId,
      },
    });
  } catch (error) {
    console.error("Error registering device:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register device",
    });
  }
});

// Send notification
router.post("/notify", validateRequest, async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    const device = await Device.findOne({ userId });
    if (!device) {
      return res
        .status(404)
        .json({ success: false, error: "Device not found" });
    }
    const result = await sendNotification(device.playerId, title, message);
    res.json({ success: true, result });
  } catch (error) {
    console.error("Error sending notification:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to send notification" });
  }
});

// Send file upload notification
router.post("/notify-file-upload", validateRequest, async (req, res) => {
  try {
    const { receiverId, senderId, fileName, fileId, additionalData, language } =
      req.body;

    // Enhanced input validation
    if (!receiverId || !senderId || !fileName || !fileId || !additionalData) {
      console.error("Missing required fields:", {
        receiverId: !receiverId,
        senderId: !senderId,
        fileName: !fileName,
        fileId: !fileId,
        additionalData: !additionalData,
      });
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        details:
          "All fields (receiverId, senderId, fileName, fileId, additionalData) are required",
      });
    }

    // Find receiver's device
    const receiverDevice = await Device.findOne({ userId: receiverId });
    if (!receiverDevice) {
      console.error("Receiver device not found for userId:", receiverId);
      return res.status(404).json({
        success: false,
        error: "Receiver device not found",
        details: { receiverId },
      });
    }

    if (!receiverDevice.playerId) {
      console.error("No player ID found for device:", receiverDevice);
      return res.status(400).json({
        success: false,
        error: "No OneSignal player ID found for receiver",
        details: { receiverId },
      });
    }

    // Validate and sanitize owner details
    if (
      !additionalData.ownerDetails?.ownerUser ||
      !additionalData.ownerDetails?.authRequiredFromUser
    ) {
      console.error("Missing owner details in additionalData");
      return res.status(400).json({
        success: false,
        error: "Missing owner details in additionalData",
        details: "Both ownerUser and authRequiredFromUser are required",
      });
    }

    // Define notification messages for different languages
    const notificationMessages = {
      en: {
        title: "New Document Authentication Required",
        message: `Document "${fileName}" requires your authorization`,
      },
      ar: {
        title: "مطلوب مصادقة مستند جديد",
        message: `المستند "${fileName}" يتطلب مصادقتك`,
      },
    };

    // Use specified language or default to English
    const messageContent =
      language && notificationMessages[language]
        ? notificationMessages[language]
        : notificationMessages.en;

    // Enhanced notification data
    const notificationData = {
      workflowId: additionalData.workflowId,
      fileId: additionalData.fileId,
      fileName: additionalData.fileName,
      uniqueCode: additionalData.uniqueCode,
      description: additionalData.description,
      uploadDate: additionalData.uploadDate,
      ownerDetails: {
        ownerUser: sanitizeUserData(additionalData.ownerDetails.ownerUser),
        authRequiredFromUser: sanitizeUserData(
          additionalData.ownerDetails.authRequiredFromUser
        ),
      },
      // Authorization flags
      authRequired: true,
      canForward: true,
      canChangeResponsibleByManager: true,
      canReject: true,
      status: additionalData.status ?? 0,
      stepNumber: additionalData.stepNumber ?? 1,
      notes: additionalData.notes ?? "",
      language: language || "en", // Include language in notification data
    };

    console.log(
      "Preparing to send notification with data:",
      JSON.stringify(notificationData, null, 2)
    );

    try {
      const result = await sendNotification(
        receiverDevice.playerId,
        messageContent.title,
        messageContent.message,
        notificationData
      );

      console.log("Notification sent successfully:", result);
      return res.json({
        success: true,
        result,
        details: {
          receiverId,
          playerId: receiverDevice.playerId,
          notificationType: "file_upload",
        },
      });
    } catch (notificationError) {
      console.error("Error sending notification:", notificationError);

      // Check for specific OneSignal errors
      if (notificationError.message.includes("authentication failed")) {
        return res.status(401).json({
          success: false,
          error: "OneSignal authentication failed",
          details: notificationError.message,
        });
      }

      if (notificationError.message.includes("rate limit")) {
        return res.status(429).json({
          success: false,
          error: "OneSignal rate limit exceeded",
          details: notificationError.message,
        });
      }

      if (notificationError.message.includes("Invalid notification payload")) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification payload",
          details: notificationError.message,
        });
      }

      // For other notification errors
      return res.status(500).json({
        success: false,
        error: "Failed to send notification",
        details: notificationError.message,
      });
    }
  } catch (error) {
    console.error("Error in notify-file-upload:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
});

// Delete device
router.delete("/devices/:userId", validateRequest, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const result = await Device.findOneAndDelete({ userId });
    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    res.json({
      success: true,
      message: "Device deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete device",
    });
  }
});

export default router;
