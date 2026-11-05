"use client";

import { countryOptions } from "@/lib/countries";

export function CountrySelect({
  value,
  onChange,
  phoneCode = false,
  required = false,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  phoneCode?: boolean;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      autoComplete={autoComplete}
    >
      <option value="" disabled>{phoneCode ? "Select calling code" : "Select your country"}</option>
      {countryOptions.map((country) => (
        <option key={country.code} value={country.code}>
          {phoneCode ? `${country.name} (${country.callingCode})` : country.name}
        </option>
      ))}
    </select>
  );
}
