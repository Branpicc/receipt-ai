// lib/twilio.ts
import twilio from 'twilio';

if (!process.env.TWILIO_ACCOUNT_SID) throw new Error('TWILIO_ACCOUNT_SID is not set');
if (!process.env.TWILIO_AUTH_TOKEN) throw new Error('TWILIO_AUTH_TOKEN is not set');
if (!process.env.TWILIO_PHONE_NUMBER) throw new Error('TWILIO_PHONE_NUMBER is not set');

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

// Get greeting based on time of day
export function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Format phone number to E.164
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// Calculate when to send SMS based on client preference
export function getScheduledTime(
  timing: string,
  endOfDayTime: string,
  clientTimezone: string
): Date {
  const now = new Date();

  switch (timing) {
    case 'instant':
      return now;
    case '5min':
      return new Date(now.getTime() + 5 * 60 * 1000);
    case '30min':
      return new Date(now.getTime() + 30 * 60 * 1000);
    case '1hour':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '4hours':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case 'end_of_day': {
      // Parse end of day time (e.g. "19:30")
      const [hours, minutes] = endOfDayTime.split(':').map(Number);
      const scheduled = new Date();
      scheduled.setHours(hours, minutes, 0, 0);
      // If that time has already passed today, schedule for tomorrow
      if (scheduled <= now) {
        scheduled.setDate(scheduled.getDate() + 1);
      }
      return scheduled;
    }
    default:
      return now;
  }
}

// Generate AI-guided purpose suggestions based on vendor
export function getSuggestedPurposes(vendor: string): string[] {
  const v = vendor.toLowerCase();

  if (v.includes('staples') || v.includes('office depot') || v.includes('grand & toy')) {
    return ['Office supplies', 'Business equipment', 'Other'];
  }
  if (v.includes('tim hortons') || v.includes('starbucks') || v.includes('coffee')) {
    return ['Client meeting', 'Team meeting', 'Personal (non-deductible)', 'Other'];
  }
  if (v.includes('restaurant') || v.includes('bar') || v.includes('grill') || v.includes('kitchen')) {
    return ['Client meal', 'Team lunch/dinner', 'Personal (non-deductible)', 'Other'];
  }
  if (v.includes('shell') || v.includes('esso') || v.includes('petro') || v.includes('chevron') || v.includes('gas')) {
    return ['Vehicle fuel', 'Business travel', 'Other'];
  }
  if (v.includes('uber') || v.includes('lyft') || v.includes('taxi')) {
    return ['Client travel', 'Business travel', 'Personal (non-deductible)', 'Other'];
  }
  if (v.includes('home depot') || v.includes('rona') || v.includes('lowes')) {
    return ['Job materials', 'Office maintenance', 'Equipment', 'Other'];
  }
  if (v.includes('amazon') || v.includes('best buy') || v.includes('apple')) {
    return ['Business equipment', 'Office supplies', 'Software/tech', 'Other'];
  }
  if (v.includes('hotel') || v.includes('inn') || v.includes('marriott') || v.includes('hilton')) {
    return ['Business travel accommodation', 'Client meeting', 'Other'];
  }
  if (v.includes('air canada') || v.includes('westjet') || v.includes('porter')) {
    return ['Business travel', 'Client meeting', 'Conference/event', 'Other'];
  }

  // Default suggestions
  return ['Business expense', 'Client-related', 'Operations', 'Other'];
}