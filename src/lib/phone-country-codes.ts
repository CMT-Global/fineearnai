/** Country code (ISO 3166-1) -> dial code (without +). Sparse; add as needed. */
export const PHONE_DIAL_CODES: Record<string, string> = {
  US: '1', GB: '44', CA: '1', AU: '61', IN: '91', DE: '49', FR: '33', IT: '39', ES: '34',
  NL: '31', BE: '32', BR: '55', MX: '52', JP: '81', KR: '82', CN: '86', NG: '234', ZA: '27',
  PL: '48', TR: '90', RU: '7', UA: '380', PK: '92', BD: '880', PH: '63', VN: '84', TH: '66',
  ID: '62', MY: '60', SG: '65', SA: '966', AE: '971', EG: '20', KE: '254', GH: '233',
  AR: '54', CO: '57', CL: '56', PE: '51', IE: '353', NZ: '64', PT: '351', GR: '30',
  RO: '40', CZ: '420', HU: '36', SE: '46', CH: '41', AT: '43', IL: '972', NO: '47', DK: '45',
};

export interface PhoneCountryOption {
  code: string;
  dial: string;
  label: string;
}

export function getPhoneCountryOptions(countries: { code: string; name: string }[]): PhoneCountryOption[] {
  return countries
    .filter((c) => PHONE_DIAL_CODES[c.code])
    .map((c) => ({
      code: c.code,
      dial: PHONE_DIAL_CODES[c.code],
      label: `${c.name} (+${PHONE_DIAL_CODES[c.code]})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
