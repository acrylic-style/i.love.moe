import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./config";
import { translate } from "./messages";

export async function getI18n() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const resolved = resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );
  return {
    ...resolved,
    t: (key: string, values?: Record<string, string | number>) =>
      translate(resolved.locale, key, values),
  };
}
