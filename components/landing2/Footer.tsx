"use client";

import { Phone, Mail, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

export function LandingFooter() {
  const t = useTranslations("landing");

  const footerLinks = [
    {
      title: t("footer.services.title"),
      items: [t("footer.services.booking"), t("footer.services.emk"), t("footer.services.laboratory"), t("footer.services.consultations")],
    },
    {
      title: t("footer.contacts.title"),
      items: [t("footer.contacts.phone"), t("footer.contacts.email"), t("footer.contacts.address")],
    },
    {
      title: t("footer.support.title"),
      items: [t("footer.support.helpCenter"), t("footer.support.faq"), t("footer.support.feedback"), t("footer.support.privacy")],
    },
  ];
  return (
    <footer id="footer" className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="mb-4 flex items-center gap-2 text-lg font-bold text-cyan-700">
              <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
                <rect x="26" y="10" width="12" height="44" rx="3" fill="#0E7490" />
                <rect x="10" y="26" width="44" height="12" rx="3" fill="#0E7490" />
              </svg>
              MedPlatform
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              {t("footer.about")}
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900">{group.title}</h4>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item}>
                    <span className="text-sm text-gray-500 transition-colors hover:text-cyan-700 cursor-pointer">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-6 md:flex-row">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {t("footer.contacts.phone")}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {t("footer.contacts.email")}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {t("footer.contacts.address")}
            </span>
          </div>
          <span className="text-xs text-gray-400">{t("footer.copyright")}</span>
        </div>
      </div>
    </footer>
  );
}
