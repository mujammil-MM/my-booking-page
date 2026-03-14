export type CallType = 'INTRO_15' | 'CONSULT_30' | 'STRATEGY_60';

export interface CallTypeInfo {
  id: CallType;
  label: string;
  duration: number;
  description: string;
  price: string;
}

export const CALL_TYPES: CallTypeInfo[] = [
  {
    id: 'INTRO_15',
    label: '15 Min Intro',
    duration: 15,
    description: 'Quick intro call to see if we\'re a good fit',
    price: 'Free',
  },
  {
    id: 'CONSULT_30',
    label: '30 Min Consultation',
    duration: 30,
    description: 'Deep-dive into your project needs and goals',
    price: '$49',
  },
  {
    id: 'STRATEGY_60',
    label: '60 Min Strategy',
    duration: 60,
    description: 'Full strategy session with actionable roadmap',
    price: '$149',
  },
];

export function getCallDuration(callType: CallType): number {
  const info = CALL_TYPES.find(ct => ct.id === callType);
  return info?.duration ?? 30;
}

export interface BookingFormData {
  clientName: string;
  email: string;
  phone: string;
  company: string;
  discussionTopic: string;
  callType: CallType;
  date: string;
  startTime: string;
  timeZone: string;
  qualification: {
    problem: string;
    budgetRange: string;
    timeline: string;
    workedWithAgencyBefore: string;
  };
}

export interface BookingResponse {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  company: string;
  discussionTopic: string;
  callType: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  meetingLink: string;
  status: string;
  rescheduleCount: number;
  createdAt: string;
  qualification?: {
    problem: string;
    budgetRange: string;
    timeline: string;
    workedWithAgencyBefore: string;
  };
}

export interface TimeSlot {
  time: string; // HH:mm
  available: boolean;
}

export interface AnalyticsData {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  cancellationRate: number;
  noShowRate: number;
  popularSlots: { time: string; count: number }[];
  bookingsByType: { type: string; count: number }[];
}
