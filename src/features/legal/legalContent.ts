/**
 * --- LEGAL CONTENT ---
 * Draft Privacy Policy & Terms of Service for Planuj Směny, in EN + CS. This is
 * reasonable boilerplate tailored to what the app actually does (shift tracking,
 * Supabase storage, FCM push) — review with a lawyer before relying on it.
 */

export type LegalDoc = 'privacy' | 'terms';
export type LegalLang = 'en' | 'cs';

export interface LegalSection {
    h: string;
    p: string;
}
export interface LegalContent {
    title: string;
    updated: string;
    intro: string;
    sections: LegalSection[];
}

const SUPPORT_EMAIL = 'anuarkairulla@gmail.com';
const UPDATED_EN = 'Last updated: 2 July 2026';
const UPDATED_CS = 'Naposledy aktualizováno: 2. července 2026';

export const LEGAL: Record<LegalDoc, Record<LegalLang, LegalContent>> = {
    privacy: {
        en: {
            title: 'Privacy Policy',
            updated: UPDATED_EN,
            intro: 'This Privacy Policy explains what information Planuj Směny collects, why, and how it is handled.',
            sections: [
                { h: 'Data we collect', p: 'Account details (first/last name, email, username), your organization and role, your shift records (clock-in/out times and the locations you select), and — only if you enable notifications — your device push token.' },
                { h: 'How we use it', p: 'To operate the shift-tracking service: recording your shifts, showing timesheets to you and your managers, and delivering the notifications you opted into.' },
                { h: 'Who can see it', p: 'People in your organization with a sufficient role (managers, admins) can view your shifts and profile. We do not sell your data or share it with third parties for advertising.' },
                { h: 'Storage & processing', p: 'Data is stored in a PostgreSQL database hosted on Supabase infrastructure. Push notifications are delivered through Firebase Cloud Messaging (Google).' },
                { h: 'Processors & international transfers', p: 'We use Supabase as our hosting provider (a data processor), together with its sub-processors such as AWS, Google and Cloudflare. Some processing may take place outside the EU; such transfers are covered by GDPR Standard Contractual Clauses.' },
                { h: 'Retention', p: 'Your data is kept while your account is active. Contact support to have your account and associated data deleted.' },
                { h: 'Your rights', p: 'You can view and correct your data (name changes via a request, username in your profile) and request deletion. For any of these, contact us.' },
                { h: 'Notifications', p: 'You control notification categories in Settings. Turning them off stops future pushes; signing out removes the device token from that device.' },
                { h: 'Contact', p: `Questions about privacy? Email ${SUPPORT_EMAIL}.` },
            ],
        },
        cs: {
            title: 'Zásady ochrany osobních údajů',
            updated: UPDATED_CS,
            intro: 'Tyto zásady vysvětlují, jaké údaje aplikace Planuj Směny shromažďuje, proč a jak s nimi nakládá.',
            sections: [
                { h: 'Jaké údaje shromažďujeme', p: 'Údaje účtu (jméno a příjmení, e-mail, uživatelské jméno), vaši organizaci a roli, záznamy o směnách (časy začátku/konce a vybraná místa) a — pouze pokud zapnete oznámení — token vašeho zařízení pro push.' },
                { h: 'K čemu je používáme', p: 'K provozu služby evidence směn: zaznamenávání směn, zobrazování výkazů vám a vašim vedoucím a doručování oznámení, která jste si zapnuli.' },
                { h: 'Kdo je vidí', p: 'Osoby ve vaší organizaci s dostatečnou rolí (vedoucí, správci) vidí vaše směny a profil. Vaše údaje neprodáváme ani nesdílíme s třetími stranami pro reklamu.' },
                { h: 'Ukládání a zpracování', p: 'Údaje jsou uloženy v databázi PostgreSQL na infrastruktuře Supabase. Push oznámení doručuje Firebase Cloud Messaging (Google).' },
                { h: 'Zpracovatelé a mezinárodní přenosy', p: 'Jako poskytovatele hostingu (zpracovatele) používáme Supabase spolu s jeho subzpracovateli, např. AWS, Google a Cloudflare. Část zpracování může probíhat mimo EU; takové přenosy jsou pokryty standardními smluvními doložkami (SCC) dle GDPR.' },
                { h: 'Doba uchování', p: 'Údaje uchováváme po dobu aktivního účtu. Pro smazání účtu a souvisejících údajů kontaktujte podporu.' },
                { h: 'Vaše práva', p: 'Můžete zobrazit a opravit své údaje (změna jména přes žádost, uživatelské jméno v profilu) a požádat o smazání. V těchto věcech nás kontaktujte.' },
                { h: 'Oznámení', p: 'Kategorie oznámení ovládáte v Nastavení. Jejich vypnutí zastaví další push; odhlášení odstraní token z daného zařízení.' },
                { h: 'Kontakt', p: `Dotazy k soukromí? Napište na ${SUPPORT_EMAIL}.` },
            ],
        },
    },
    terms: {
        en: {
            title: 'Terms of Service',
            updated: UPDATED_EN,
            intro: 'These Terms govern your use of Planuj Směny. By using the app you agree to them.',
            sections: [
                { h: 'The service', p: 'Planuj Směny is a workforce shift-management tool for tracking shifts, locations and timesheets, provided on an "as is" basis.' },
                { h: 'Accounts', p: 'You are responsible for keeping your login credentials secure and for the accuracy of the information you provide. Do not share your account.' },
                { h: 'Acceptable use', p: 'Do not misuse the service, attempt unauthorized access, disrupt its operation, or use it to break any applicable law or your employer’s policies.' },
                { h: 'Your data responsibilities', p: 'If you create an organization and invite members, you act as the data controller for their personal data (names, shifts, locations). You are responsible for having a lawful basis to process it, for informing your team how it is used, and for handling their data-subject requests. You must not use the app to process personal data unlawfully.' },
                { h: 'Timesheet accuracy', p: 'Records reflect the clock-in/out data entered in the app. For payroll or legal purposes, verify records with your employer; we are not a party to your employment.' },
                { h: 'Availability', p: 'We aim for reliable service but do not guarantee uninterrupted or error-free availability, and may change or suspend features.' },
                { h: 'Liability', p: 'To the maximum extent permitted by law, the app is provided without warranties and we are not liable for indirect or consequential damages arising from its use.' },
                { h: 'Changes', p: 'We may update the app and these Terms. Continued use after changes means you accept the updated Terms.' },
                { h: 'Governing law', p: 'These Terms are governed by the laws of the Czech Republic.' },
                { h: 'Contact', p: `Questions about these Terms? Email ${SUPPORT_EMAIL}.` },
            ],
        },
        cs: {
            title: 'Podmínky použití',
            updated: UPDATED_CS,
            intro: 'Tyto podmínky upravují používání aplikace Planuj Směny. Používáním aplikace s nimi souhlasíte.',
            sections: [
                { h: 'Služba', p: 'Planuj Směny je nástroj pro správu směn — evidenci směn, míst a výkazů — poskytovaný „tak, jak je“.' },
                { h: 'Účty', p: 'Odpovídáte za bezpečnost svých přihlašovacích údajů a za správnost zadaných informací. Účet nesdílejte.' },
                { h: 'Přijatelné použití', p: 'Nezneužívejte službu, nepokoušejte se o neoprávněný přístup, nenarušujte její provoz a nepoužívejte ji v rozporu se zákony či pravidly zaměstnavatele.' },
                { h: 'Vaše odpovědnost za údaje', p: 'Pokud vytvoříte organizaci a pozvete členy, vystupujete jako správce jejich osobních údajů (jména, směny, místa). Odpovídáte za právní základ jejich zpracování, za informování svého týmu o způsobu použití a za vyřízení žádostí subjektů údajů. Aplikaci nesmíte používat ke zpracování osobních údajů v rozporu se zákonem.' },
                { h: 'Přesnost výkazů', p: 'Záznamy odrážejí data o začátku/konci směny zadaná v aplikaci. Pro mzdové či právní účely si je ověřte u zaměstnavatele; nejsme stranou vašeho pracovního poměru.' },
                { h: 'Dostupnost', p: 'Usilujeme o spolehlivý provoz, ale nezaručujeme nepřerušovanou či bezchybnou dostupnost a můžeme funkce měnit či pozastavit.' },
                { h: 'Odpovědnost', p: 'V maximálním rozsahu povoleném zákonem je aplikace poskytována bez záruk a neneseme odpovědnost za nepřímé či následné škody vzniklé jejím používáním.' },
                { h: 'Změny', p: 'Aplikaci i tyto podmínky můžeme aktualizovat. Pokračujícím používáním po změnách vyjadřujete souhlas s aktualizovaným zněním.' },
                { h: 'Rozhodné právo', p: 'Tyto podmínky se řídí právem České republiky.' },
                { h: 'Kontakt', p: `Dotazy k podmínkám? Napište na ${SUPPORT_EMAIL}.` },
            ],
        },
    },
};
