import axios from "axios";

export const sendNotification = async (
  playerId,
  title,
  message,
  additionalData = {}
) => {
  try {
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    const appId = process.env.ONESIGNAL_APP_ID;

    // Log config (without exposing the full key)
    console.log("OneSignal Configuration Check:", {
      hasAppId: !!appId,
      hasApiKey: !!apiKey,
      appIdFirstChars: appId ? appId.substring(0, 6) + "..." : "missing",
      apiKeyLength: apiKey ? apiKey.length : 0,
    });

    if (!appId || !apiKey) {
      throw new Error("OneSignal configuration missing");
    }

    if (!playerId || !title || !message) {
      throw new Error("Missing required notification parameters");
    }

    const notificationPayload = {
      app_id: appId,
      include_player_ids: [playerId],
      contents: { en: message },
      headings: { en: title },
      data: {
        ...additionalData,
        authRequired: true,
        canForward: true,
        canChangeResponsibleByManager: true,
        canReject: true,
        status: additionalData.status || 0,
        stepNumber: additionalData.stepNumber || 1,
      },
    };

    console.log("Sending notification to OneSignal:", {
      playerId,
      title,
      appId,
      hasData: !!additionalData,
    });

    const response = await axios({
      method: "post",
      url: "https://api.onesignal.com/notifications", // New API endpoint
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`, // New Bearer token format
      },
      data: notificationPayload,
    });

    if (response.data.errors) {
      throw new Error(
        `OneSignal returned errors: ${JSON.stringify(response.data.errors)}`
      );
    }

    console.log("OneSignal response:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("OneSignal request failed:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      // Check for specific error cases
      if (error.response?.status === 403 || error.response?.status === 401) {
        throw new Error(
          `OneSignal authentication failed (${
            error.response.status
          }): ${JSON.stringify(error.response.data)}`
        );
      }
    }

    throw error;
  }
};
