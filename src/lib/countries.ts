import { getName, registerLocale } from "i18n-iso-countries";
import englishCountryNames from "i18n-iso-countries/langs/en.json";
import { getCountries, getCountryCallingCode, isSupportedCountry } from "libphonenumber-js";

registerLocale(englishCountryNames);

export type CountryCode = (typeof countryCodes)[number];

export const countryCodes = getCountries();

export const countryOptions = countryCodes
  .map((code) => ({
    code,
    name: getName(code, "en") ?? code,
    callingCode: `+${getCountryCallingCode(code)}`,
  }))
  .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

export function isCountryCode(value: string): value is CountryCode {
  return isSupportedCountry(value);
}

export function callingCodeForCountry(value: string) {
  return isCountryCode(value) ? `+${getCountryCallingCode(value)}` : "";
}
