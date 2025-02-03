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
      // Ensure these required flags are present
      authRequired: true,
      canForward: true,
      canChangeResponsibleByManager: true,
      canReject: true,
      status: additionalData.status || 0,
      stepNumber: additionalData.stepNumber || 1,
    };

    // Log the notification payload for debugging
    console.log("Preparing to send notification with payload:", {
      playerId,
      title,
      message,
      sanitizedData,
    });

    // Send notification through OneSignal with correct REST API key format
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
          // The REST API key should be sent as-is, without Base64 encoding
          Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json",
        },
        validateStatus: (status) => {
          // Consider only 5xx status codes as errors
          return status < 500;
        },
      }
    );

    // Check for specific error responses from OneSignal
    if (response.status === 400) {
      throw new Error(
        `OneSignal validation error: ${JSON.stringify(response.data)}`
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "OneSignal authentication failed - check your REST API key"
      );
    }

    if (response.status !== 200) {
      throw new Error(
        `OneSignal returned status ${response.status}: ${JSON.stringify(
          response.data
        )}`
      );
    }

    console.log("OneSignal notification sent successfully:", {
      playerId,
      title,
      response: response.data,
    });

    return response.data;
  } catch (error) {
    // Enhanced error logging
    if (axios.isAxiosError(error)) {
      console.error("OneSignal API error details:", {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });

      // Throw specific error messages based on the response
      if (error.response) {
        switch (error.response.status) {
          case 400:
            throw new Error(
              `Invalid notification payload: ${JSON.stringify(
                error.response.data
              )}`
            );
          case 401:
          case 403:
            throw new Error(
              "OneSignal authentication failed - check your REST API key"
            );
          case 429:
            throw new Error("OneSignal rate limit exceeded");
          default:
            throw new Error(`OneSignal API error: ${error.response.status}`);
        }
      }
    }

    console.error("OneSignal API error:", error);
    throw new Error(
      `Failed to send notification through OneSignal: ${error.message}`
    );
  }
};
