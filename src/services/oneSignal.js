import axios from 'axios';

// Sanitize user data helper function
const sanitizeUser = (user) => user ? {
  id: user.id,
  displayName: user.displayName,
  arabicDisplayName: user.arabicDisplayName
} : null;

// Main notification sending function
export const sendNotification = async (playerId, title, message, additionalData = {}) => {
  try {
    // Validate OneSignal configuration
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      throw new Error('OneSignal configuration missing');
    }

    // Validate required inputs
    if (!playerId || !title || !message) {
      throw new Error('Missing required notification parameters');
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
      stepNumber: additionalData.stepNumber || 1
    };

    // Send notification through OneSignal
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        contents: { en: message },
        headings: { en: title },
        data: sanitizedData
      },
      {
        headers: {
          'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('OneSignal notification sent successfully:', {
      playerId,
      title,
      notificationData: sanitizedData
    });

    return response.data;
  } catch (error) {
    console.error('OneSignal API error:', error);
    throw new Error('Failed to send notification through OneSignal');
  }
};