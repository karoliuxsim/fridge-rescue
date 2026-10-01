export function authErrorMessage(error: { code?: string; status?: number }) {
  if (error.status === 429) return "Per daug bandymų. Palaukite ir bandykite dar kartą.";
  switch (error.code) {
    case "invalid_credentials": return "Neteisingas el. paštas arba slaptažodis.";
    case "email_not_confirmed": return "Pirmiausia patvirtinkite el. paštą, paspaudę laiške esančią nuorodą.";
    case "user_already_exists":
    case "email_exists": return "Paskyra su šiuo el. paštu jau egzistuoja. Pabandykite prisijungti.";
    case "weak_password": return "Slaptažodis per silpnas. Naudokite ilgesnį slaptažodį su raidėmis, skaičiais ir simboliais.";
    case "email_address_invalid": return "Įveskite galiojantį el. pašto adresą.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "Per daug bandymų. Palaukite ir bandykite dar kartą.";
    case "signup_disabled": return "Registracija šiuo metu išjungta.";
    case "email_address_not_authorized": return "Supabase šiuo metu neleidžia siųsti laiško šiuo adresu. Patikrinkite el. pašto siuntimo nustatymus.";
    default: return "Autentifikacijos paslauga nepasiekiama arba užklausa nepavyko. Bandykite dar kartą.";
  }
}

export function validateCredentials(email: string, password: string, register: boolean) {
  if (!email || !password) return "Įveskite el. paštą ir slaptažodį.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Įveskite galiojantį el. pašto adresą.";
  if (register && password.length < 8) return "Slaptažodį turi sudaryti bent 8 simboliai.";
  if (password.length > 128) return "Slaptažodis negali viršyti 128 simbolių.";
  return null;
}
