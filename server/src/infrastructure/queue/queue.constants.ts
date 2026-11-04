export function notificationQueueName() {
  return process.env.NOTIFICATION_QUEUE_NAME ?? 'leave-notifications';
}
export const LEAVE_DECIDED_JOB = 'leave.decided';
export const NOTIFICATION_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: 1000,
};

export type LeaveDecidedJob = {
  userId: string;
  leaveRequestId: string;
  status: 'APPROVED' | 'REJECTED';
};
