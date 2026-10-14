import { useEffect, useState } from 'react';

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
}

export function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    // Generate a basic list of common timezones, or use a fuller list
    const commonTimezones = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Kolkata',
      'Asia/Tokyo',
      'Australia/Sydney'
    ];

    // Automatically get the user's local timezone if not provided
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!commonTimezones.includes(userTimezone)) {
      commonTimezones.push(userTimezone);
    }

    setTimezones(commonTimezones.sort());

    if (!value && userTimezone) {
      onChange(userTimezone);
    }
  }, [value, onChange]);

  return (
    <div>
      <label htmlFor="timezone" className="field-label">Timezone</label>
      <select
        id="timezone"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field cursor-pointer"
      >
        <option value="" disabled>Select Timezone</option>
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz.replace('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}
