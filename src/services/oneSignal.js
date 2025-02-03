import axios from "axios";

// Sanitize user data helper function
const sanitizeUser = (user) =>
  user
    ? {
        id: user.id,
        displayName: user.displayName,
        arabicDisplayName: user.arabicDisplayName,
      }
    : null;

// Main notification sending function
export const sendNotification = async (
  playerId,
  title,
  message,
  additionalData = {}
) => {
  try {
    // Validate OneSignal configuration
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      throw new Error("OneSignal configuration missing");
    }

    // Validate required inputs
    if (!playerId || !title || !message) {
      throw new Error("Missing required notification parameters");
    }

    // Prepare notification data
    const sanitizedData = {
      ...additionalData,
      authRequired: true,
      canForward: true,
      canChangeResponsibleByManager: true,
      canReject: true,
      status: additionalData.status || 0,
      stepNumber: additionalData.stepNumber || 1,
    };

    // Log the request details (excluding sensitive info)
    console.log("OneSignal request details:", {
      playerId,
      appId: process.env.ONESIGNAL_APP_ID,
      title,
      message,
    });

    // Send notification through OneSignal
    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        contents: { en: message },
        headings: { en: title },
        data: sanitizedData,
      },
      {
        headers: {
          // REST API key is sent without 'Basic' prefix or base64 encoding
          Authorization: process.env.ONESIGNAL_REST_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("OneSignal API response:", response.data);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("OneSignal API error details:", {
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: {
            ...error.config?.headers,
            Authorization: "[REDACTED]", // Don't log the actual key
          },
        },
      });

      if (error.response?.status === 401) {
        console.error("Authentication failed. Please verify your REST API key");
        throw new Error(
          "OneSignal authentication failed - check your REST API key"
        );
      }
    }

    console.error("OneSignal API error:", error.message);
    throw error;
  }
};
