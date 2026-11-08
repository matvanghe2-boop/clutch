/** Le code à deux lettres des pays qu'écrit Liquipedia dans les effectifs (« France » → « FR »). */
const CODES: Record<string, string> = {
  france: "FR", belgium: "BE", switzerland: "CH", luxembourg: "LU", monaco: "MC", canada: "CA", "united states": "US",
  "united kingdom": "GB", england: "GB", scotland: "GB", wales: "GB", ireland: "IE", germany: "DE", austria: "AT",
  netherlands: "NL", denmark: "DK", sweden: "SE", norway: "NO", finland: "FI", iceland: "IS", estonia: "EE",
  latvia: "LV", lithuania: "LT", poland: "PL", "czech republic": "CZ", czechia: "CZ", slovakia: "SK", hungary: "HU",
  romania: "RO", bulgaria: "BG", serbia: "RS", croatia: "HR", slovenia: "SI", "bosnia and herzegovina": "BA",
  montenegro: "ME", "north macedonia": "MK", albania: "AL", kosovo: "XK", greece: "GR", turkey: "TR", turkiye: "TR",
  cyprus: "CY", israel: "IL", russia: "RU", ukraine: "UA", belarus: "BY", kazakhstan: "KZ", uzbekistan: "UZ",
  mongolia: "MN", georgia: "GE", armenia: "AM", azerbaijan: "AZ", spain: "ES", portugal: "PT", italy: "IT",
  malta: "MT", morocco: "MA", algeria: "DZ", tunisia: "TN", egypt: "EG", "south africa": "ZA", brazil: "BR",
  argentina: "AR", chile: "CL", uruguay: "UY", peru: "PE", colombia: "CO", mexico: "MX", "saudi arabia": "SA",
  "united arab emirates": "AE", qatar: "QA", kuwait: "KW", jordan: "JO", lebanon: "LB", china: "CN", taiwan: "TW",
  "hong kong": "HK", japan: "JP", "south korea": "KR", korea: "KR", vietnam: "VN", thailand: "TH", malaysia: "MY",
  singapore: "SG", indonesia: "ID", philippines: "PH", india: "IN", australia: "AU", "new zealand": "NZ",
};

export const countryCode = (name?: string) => (name ? CODES[name.trim().toLowerCase()] : undefined);
