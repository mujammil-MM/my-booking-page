export const MAJOR_TIMEZONES = [
  { label: 'Automatic (Detected)', value: 'AUTO' },
  { label: 'Asia/Kolkata (GMT+5:30)', value: 'Asia/Kolkata' },
  { label: 'Europe/London (GMT+0)', value: 'Europe/London' },
  { label: 'America/New_York (GMT-5)', value: 'America/New_York' },
  { label: 'America/Los_Angeles (GMT-8)', value: 'America/Los_Angeles' },
];

export function getGMTLabel(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(new Date());
    const offset = parts.find(p => p.type === 'timeZoneName')?.value || '';
    return offset;
  } catch {
    return '';
  }
}

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export function getAllTimezones(): TimezoneOption[] {
  let allTzs: string[] = [];
  try {
    if (typeof Intl === 'object' && 'supportedValuesOf' in Intl) {
      const i = Intl as unknown as { supportedValuesOf: (key: string) => string[] };
      if (typeof i.supportedValuesOf === 'function') {
        allTzs = i.supportedValuesOf('timeZone');
      } else {
        throw new Error('Not supported');
      }
    } else {
      throw new Error('Not supported');
    }
  } catch {
    // Basic fallback list of major zones
    allTzs = [
      'Africa/Cairo', 'Africa/Tunis', 'Asia/Dubai', 'Asia/Kolkata', 
      'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/Berlin', 
      'Europe/London', 'Europe/Paris', 'America/Chicago', 'America/Denver', 
      'America/Los_Angeles', 'America/New_York', 'Pacific/Auckland'
    ];
  }
  
  return allTzs.map(tz => {
    const offset = getGMTLabel(tz);
    return {
      value: tz,
      label: `${tz} (${offset})`,
      offset
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}
