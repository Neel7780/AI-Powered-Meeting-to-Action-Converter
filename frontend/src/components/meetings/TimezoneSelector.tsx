import React, { useEffect, useState } from 'react';

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
    <div className="flex flex-col space-y-1.5">
      <label className="text-sm font-medium text-foreground">Timezone</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
