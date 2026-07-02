import React from "react";
import { ArrowLeft } from "lucide-react";

export function LegalPage({
  title,
  onBack,
  body,
}: {
  title: string;
  onBack: () => void;
  body: Array<{ h: string; p: string[] }>;
}) {
  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> NASTAVENIA
        </button>
      </div>
      <h1 className="mb-2 font-sans text-2xl tracking-tight text-foreground font-black uppercase">
        {title}
      </h1>
      <p className="mb-6 font-mono text-[10px] tracking-widest text-muted-foreground">
        POSLEDNÁ AKTUALIZÁCIA · JÚN 2026
      </p>

      <div className="space-y-5">
        {body.map((s, i) => (
          <section key={i} className="border border-border bg-card p-5">
            <h2 className="mb-3 font-sans text-base text-foreground font-bold uppercase">{s.h}</h2>
            <div className="space-y-3">
              {s.p.map((line, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Toto je informatívne zhrnutie pravidiel. V prípade nejasností nás kontaktuj cez sekciu{" "}
        <span className="text-foreground">Kontakt</span>.
      </p>
    </div>
  );
}

export const TERMS_BODY: Array<{ h: string; p: string[] }> = [
  {
    h: "1. O službe",
    p: [
      "Reson je aplikácia na zoznamovanie založené na psychologickej rezonancii. Namiesto swipovania ťa páruje cez krátky test a hlasovú konverzáciu.",
      "Používaním aplikácie potvrdzuješ, že máš aspoň 16 rokov a že údaje o sebe poskytuješ pravdivo.",
    ],
  },
  {
    h: "2. Tvoje povinnosti",
    p: [
      "Zaväzuješ sa nepoužívať aplikáciu na obťažovanie, spam, podvody, propagáciu nenávisti či komerčné účely.",
      "Tvoje overenie tváre slúži výhradne na potvrdenie, že si reálny človek. Vydávanie sa za iného je dôvodom na okamžité ukončenie účtu.",
    ],
  },
  {
    h: "3. Obsah a komunikácia",
    p: [
      "Hlasovky aj textové správy sú medzi tebou a tvojím partnerom v rozhovore. Ukončením konverzácie sa obsah natrvalo zmaže z oboch zariadení.",
      "Zakazuje sa zdieľať obsah, ktorý je nezákonný, urážlivý, sexuálne explicitný bez súhlasu druhej strany alebo porušuje práva tretích osôb.",
    ],
  },
  {
    h: "4. Ukončenie účtu",
    p: [
      "Účet môžeš kedykoľvek zrušiť v sekcii Nastavenia. Po zrušení sú tvoje dáta odstránené v zákonných lehotách.",
      "Vyhradzujeme si právo ukončiť účet, ktorý porušuje tieto podmienky, bez nároku na náhradu.",
    ],
  },
  {
    h: "5. Zodpovednosť",
    p: [
      'Aplikácia je poskytovaná „tak, ako je". Snažíme sa o jej spoľahlivosť, ale nezodpovedáme za rozhodnutia, ktoré urobíš na základe interakcií s inými používateľmi.',
      "Za bezpečnosť pri osobných stretnutiach mimo aplikácie nesieš plnú zodpovednosť ty.",
    ],
  },
  {
    h: "6. Zmeny podmienok",
    p: [
      "Tieto podmienky môžeme aktualizovať. O podstatných zmenách ťa upozorníme v aplikácii a budeš mať možnosť ich prijať alebo účet zrušiť.",
    ],
  },
];

export const PRIVACY_BODY: Array<{ h: string; p: string[] }> = [
  {
    h: "1. Kto sme",
    p: [
      "Prevádzkovateľom služby Reson je tím vývojárov so sídlom v Slovenskej republike. V zmysle Nariadenia (EÚ) 2016/679 (GDPR) sme prevádzkovateľom tvojich osobných údajov.",
    ],
  },
  {
    h: "2. Aké údaje spracúvame",
    p: [
      "Identifikačné: telefónne číslo, krstné meno alebo prezývka, vek, mesto, pohlavie, orientácia.",
      "Overovacie: krátky 3-sekundový videoklip tváre slúžiaci na potvrdenie, že si reálny človek.",
      "Behaviorálne: odpovede na 6 testových otázok, hodnotenia rezonancie, história rozhovorov (uložené iba v tvojom zariadení).",
    ],
  },
  {
    h: "3. Účely spracúvania",
    p: [
      "Poskytovanie služby — párovanie, komunikácia, bezpečnosť účtu.",
      "Zlepšovanie kvality (v agregovanej, anonymizovanej forme).",
      "Plnenie zákonných povinností.",
    ],
  },
  {
    h: "4. Doba uchovania",
    p: [
      "Profilové údaje: po dobu existencie účtu.",
      "Overovacie video: maximálne 30 dní, alebo do úspešného overenia.",
      "Konverzácie: ukladajú sa lokálne v tvojom zariadení. Ukončením rozhovoru sú natrvalo zmazané.",
    ],
  },
  {
    h: "5. Tvoje práva (GDPR)",
    p: [
      "Právo na prístup, opravu, výmaz, obmedzenie spracúvania, prenosnosť a námietku.",
      "Právo podať sťažnosť na Úrade na ochranu osobných údajov SR.",
      "Žiadosti adresuj cez sekciu Kontakt — odpovieme do 30 dní.",
    ],
  },
  {
    h: "6. Bezpečnosť",
    p: [
      "Údaje sú šifrované pri prenose (TLS) aj v pokoji. K osobným údajom má prístup len obmedzený okruh autorizovaných osôb.",
    ],
  },
];

export const COOKIES_BODY: Array<{ h: string; p: string[] }> = [
  {
    h: "Aké cookies používame",
    p: [
      "Nevyhnutné: udržiavajú tvoje prihlásenie a preferenciu vzhľadu (tmavý/svetlý režim). Bez nich aplikácia nefunguje.",
      "Funkčné: zapamätajú si jazyk a nastavenia.",
      "Nepoužívame reklamné ani trackingové cookies tretích strán.",
    ],
  },
  {
    h: "Lokálne úložisko",
    p: [
      "Tvoje rozhovory ukladáme do localStorage tvojho zariadenia. Nemáme k nim na našom serveri prístup.",
      "Údaje môžeš kedykoľvek zmazať v Nastaveniach.",
    ],
  },
];

export const CONTACT_BODY: Array<{ h: string; p: string[] }> = [
  {
    h: "Napíš nám",
    p: [
      "Pre otázky, sťažnosti a uplatnenie GDPR práv: hello@reson.app",
      "Odpovedáme v pracovných dňoch zvyčajne do 48 hodín.",
    ],
  },
  {
    h: "Bezpečnostné incidenty",
    p: ["Ak narazíš na bezpečnostnú chybu, prosím nahlás ju na: security@reson.app"],
  },
];
