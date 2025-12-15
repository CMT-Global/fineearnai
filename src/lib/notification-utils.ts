/**
 * Notification Utilities
 * Helper functions for notification system functionality
 */

import { supabaseService } from "@/integrations/supabase";

export type NotificationType = "plan" | "referral" | "wallet" | "task" | "system";
export type NotificationPriority = "low" | "medium" | "high";

export interface NotificationData {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for a user
 */
export const createNotification = async (
  userId: string,
  notification: NotificationData
): Promise<{ success: boolean; error?: string }> => {
  try {
    await supabaseService.notifications.create({
      user_id: userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority || 'medium',
      metadata: notification.metadata || {},
      read: false,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error creating notification:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (
  notificationId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await supabaseService.notifications.markAsRead(notificationId);
    return { success: true };
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await supabaseService.notifications.markAllAsRead(userId);
    return { success: true };
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async (
  userId: string
): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from("notifications" as any)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error("Error getting unread notification count:", error);
    return 0;
  }
};

/**
 * Get user notifications with pagination
 */
export const getUserNotifications = async (
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ notifications: any[]; total: number }> => {
  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("notifications" as any)
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return { notifications: data || [], total: count || 0 };
  } catch (error) {
    console.error("Error getting user notifications:", error);
    return { notifications: [], total: 0 };
  }
};

/**
 * Delete old read notifications (older than X days)
 */
export const deleteOldNotifications = async (
  userId: string,
  daysOld: number = 30
): Promise<{ success: boolean; error?: string }> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await supabase
      .from("notifications" as any)
      .delete()
      .eq("user_id", userId)
      .eq("is_read", true)
      .lt("created_at", cutoffDate.toISOString());

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting old notifications:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Notification event helpers - These create specific notification types
 */

export const notifyPlanUpgraded = async (
  userId: string,
  planName: string,
  amount: number
) => {
  return createNotification(userId, {
    title: "Plan Upgraded Successfully",
    message: `Your account has been upgraded to the ${planName} plan for $${amount.toFixed(2)}.`,
    type: "plan",
    priority: "high",
    metadata: { planName, amount },
  });
};

export const notifyPlanRenewed = async (
  userId: string,
  planName: string,
  nextRenewalDate: string
) => {
  return createNotification(userId, {
    title: "Plan Renewed",
    message: `Your ${planName} plan has been automatically renewed. Next renewal: ${nextRenewalDate}.`,
    type: "plan",
    priority: "medium",
    metadata: { planName, nextRenewalDate },
  });
};

export const notifyPlanExpired = async (userId: string, planName: string) => {
  return createNotification(userId, {
    title: "Plan Expired",
    message: `Your ${planName} plan has expired. You have been downgraded to the Free plan.`,
    type: "plan",
    priority: "high",
    metadata: { planName },
  });
};

export const notifyAutoRenewalFailed = async (
  userId: string,
  planName: string,
  requiredAmount: number,
  currentBalance: number
) => {
  return createNotification(userId, {
    title: "Auto-Renewal Failed",
    message: `Unable to renew your ${planName} plan. Insufficient funds. Required: $${requiredAmount.toFixed(
      2
    )}, Balance: $${currentBalance.toFixed(2)}.`,
    type: "plan",
    priority: "high",
    metadata: { planName, requiredAmount, currentBalance },
  });
};

export const notifyPlanExpiringSoon = async (
  userId: string,
  planName: string,
  daysRemaining: number
) => {
  return createNotification(userId, {
    title: "Plan Expiring Soon",
    message: `Your ${planName} plan will expire in ${daysRemaining} day${
      daysRemaining > 1 ? "s" : ""
    }. Renew now to continue enjoying premium benefits.`,
    type: "plan",
    priority: "high",
    metadata: { planName, daysRemaining },
  });
};

export const notifyNewReferralSignup = async (
  userId: string,
  referredUsername: string
) => {
  return createNotification(userId, {
    title: "New Referral Signup",
    message: `${referredUsername} has joined using your referral link!`,
    type: "referral",
    priority: "medium",
    metadata: { referredUsername },
  });
};

export const notifyReferralTaskCommission = async (
  userId: string,
  amount: number,
  referredUsername: string
) => {
  return createNotification(userId, {
    title: "Referral Commission Earned",
    message: `You earned $${amount.toFixed(
      2
    )} commission from ${referredUsername}'s task completion.`,
    type: "referral",
    priority: "low",
    metadata: { amount, referredUsername, type: "task" },
  });
};

export const notifyReferralDepositCommission = async (
  userId: string,
  amount: number,
  referredUsername: string
) => {
  return createNotification(userId, {
    title: "Referral Deposit Commission",
    message: `You earned $${amount.toFixed(
      2
    )} commission from ${referredUsername}'s deposit.`,
    type: "referral",
    priority: "medium",
    metadata: { amount, referredUsername, type: "deposit" },
  });
};

export const notifySignupBonus = async (userId: string, amount: number) => {
  return createNotification(userId, {
    title: "Signup Bonus Received",
    message: `Welcome bonus of $${amount.toFixed(2)} has been added to your account!`,
    type: "wallet",
    priority: "high",
    metadata: { amount },
  });
};
