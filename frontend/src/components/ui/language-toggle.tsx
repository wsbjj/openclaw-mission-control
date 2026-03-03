"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
    const { locale, setLocale } = useI18n();

    return (
        <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            title={locale === "en" ? "切换到中文" : "Switch to English"}
            aria-label={locale === "en" ? "Switch language to Chinese" : "切换语言为英文"}
        >
            <span className="text-sm leading-none" aria-hidden="true">
                {locale === "en" ? "🌐" : "🌐"}
            </span>
            <span>{locale === "en" ? "中文" : "EN"}</span>
        </button>
    );
}
