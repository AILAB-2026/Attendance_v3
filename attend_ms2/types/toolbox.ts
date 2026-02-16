export type ToolboxMeeting = {
  id: string;
  title: string;
  description: string;
  meetingDate: string; // YYYY-MM-DD
  isPast?: boolean;
  presenterId: string;
  presenterName?: string;
  location?: string;
  safetyTopics: string[];
  attachments: string[];
  isMandatory: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ToolboxMeetingAttendee = {
  id: string;
  meetingId: string;
  userId: string;
  userName?: string;
  attended: boolean;
  acknowledgedAt?: number;
  signatureUri?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type ToolboxMeetingWithAttendance = ToolboxMeeting & {
  attendee?: ToolboxMeetingAttendee;
  totalAttendees: number;
  attendedCount: number;
};