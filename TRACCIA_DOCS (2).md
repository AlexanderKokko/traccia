# 🌿 Traccia — Documentazione completa

**Traccia** è un diario sintomi intuitivo e sicuro per pazienti con malattie croniche: permette di monitorare il benessere quotidiano, gestire terapie/referti/appuntamenti e collaborare con il medico. App bilingue (IT/EN), con autenticazione sicura, persistenza dati e UI premium stile Apple/Linear.

Pubblicata su: **https://traccia-daily-flow.base44.app**

---

## 1. Stack tecnico

- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Animazioni:** Framer Motion
- **Grafici:** Recharts
- **Mappe:** react-leaflet · **Drag&Drop:** @hello-pangea/dnd · **PDF/immagini:** jspdf, html2canvas
- **Routing:** react-router-dom · **Data fetching:** @tanstack/react-query
- **Tema:** next-themes (dark mode)
- **Backend:** Base44 (auth, database entità, integrazioni, hosting)
- **SDK:** `@/api/base44Client` (client pre-inizializzato)

---

## 2. Design System

### Palette (light)
- Sfondo `#F9FAFB` · Superficie `#FFFFFF` · Inchiostro `#1A2F2A`
- Brand verde `#4FAF82` (dark `#3B9A6E`, soft `#E8F5EE`)
- Allarmi rosso `#C56B6B` · Ambra `#B8863B`

### Dark mode
Tema verde-nero profondo (token adattivi in `src/index.css` sotto `.dark`). Toggle nell'intestazione (Sun/Moon).

### Font
- **Fraunces** — titoli e numeri chiave (`--font-heading`, `--font-display`)
- **Inter** — UI (`--font-body`)
- **IBM Plex Mono** — dati numerici (`.font-mono-data`)

### Componenti visivi (classi custom in `index.css`)
- `.card-float` / `.card-float-lg` — card glassmorphism (blur, ombre morbide, raggio 20/24px)
- `.card-inner` — contenitore secondario
- `.input-float` — input premium 52px, focus ring verde
- `.btn-primary` / `.btn-ghost` / `.btn-link` — pulsanti
- `.nav-tab` / `.cond-pill` / `.toggle-chip` — pill nav e chip selezionabili
- `.traccia-slider` — range slider con thumb personalizzato
- `.spinner` — loader

---

## 3. Architettura

### Router (`src/App.jsx`)
`AuthProvider → LanguageProvider → QueryClientProvider → Router → AuthenticatedApp → Toaster`
- `AuthenticatedApp`: gestisce loading/auth, reindirizza al login se non autenticato, mostra `UserNotRegisteredError`.
- Tutte le pagine autenticate sono sotto `<Layout />` (Navbar + DisclaimerBanner + `<Outlet />`).
- Route catch-all → `PageNotFound`.

### Rotte
| Path | Pagina |
|------|--------|
| `/` | Home (diario) |
| `/patologie` | Patologies |
| `/referti` | Documents |
| `/andamento` | Trends |
| `/controlli` | Appointments |
| `/terapie` | Therapies |
| `/contenuti` | Contents |
| `/docs` | Docs (documentazione progetto) |
| `/login` `/register` `/forgot-password` `/reset-password` | Auth (boilerplate) |

### Localizzazione (`src/lib/LanguageContext.jsx`)
`LanguageProvider` espone `lang` ('it'|'en') e `toggleLang()`. Tutte le stringhe UI passano per `t(key, lang)` da `src/lib/translations.js`.

---

## 4. Entità (database)

Tutte le entità utente hanno **RLS** (`created_by_id === {{user.id}}` su read/update/delete): i dati sono privati per utente.

### DiaryEntry
Voce di diario giornaliera.
| Campo | Tipo | Note |
|-------|------|------|
| `module` | enum | `base`, `endometriosi`, `ibd`, `emicrania`, `diabete`, `pcos`, `ipertiroidismo`, `ipotiroidismo`, `fibromialgia`, `artrite_reumatoide` |
| `entry_date` | date | **required** |
| `pain` | number 0–10 | null per moduli senza dolore |
| `energy` | number 0–10 | |
| `sleep_hours` | number | |
| `medication_taken` | enum | `yes` `later` `no` |
| `mood` | number 1–5 | |
| `notes` | string | max ~500 |
| `alarm_symptoms` | string[] | sintomi di allarme selezionati |
| `module_data` | object | dati specifici del modulo (dinamico) |

### Pathology
Condizione cronica nel profilo utente.
| Campo | Tipo |
|-------|------|
| `condition` | enum (9 condizioni + `altro`) — **required** |
| `custom_name` | string (per `altro`) |
| `diagnosis_date` | date |
| `diagnosis_year` | number (supporto "solo anno", 1940→oggi) |

### MedicalDocument
Referto caricato (foto o PDF).
| Campo | Tipo |
|-------|------|
| `doc_type` | enum `analisi_sangue` `risonanza` `tac` `ecografia` `visita` `altro` — **required** |
| `doc_date` | date — **required** |
| `description` | string |
| `linked_condition` | string |
| `file_url` | string (UploadPublicFile) |
| `file_type` | enum `image` `pdf` |
| `file_name` | string |

### Appointment
Visita specialistica.
| Campo | Tipo |
|-------|------|
| `specialist` | enum `ginecologo` `gastroenterologo` `neurologo` `diabetologo` `medico_base` — **required** |
| `appointment_date` | date — **required** |

### Therapy
Terapia farmacologica.
| Campo | Tipo |
|-------|------|
| `name` | string — **required** |
| `dosage` | string |
| `time` | string (orario) |
| `frequency` | enum `ogni_giorno` `settimanale` `al_bisogno` — **required** |

### User (built-in)
Solo lettura: `id`, `created_date`, `full_name`, `email`. Editabile: `role`. Campo personalizzato `display_name` (gestito via `base44.auth.updateMe`).

---

## 5. Pagine

### Home (`src/pages/Home.jsx`)
Dashboard del diario. Carica l'utente (`base44.auth.me`); se `display_name` assente mostra **OnboardingTour**. Contiene:
- `GreetingCard` — saluto localizzato + data + **ZenGardenMini** (giardino compatto con streak)
- `ConditionSelector` — scelta del modulo attivo
- `DiaryForm` — form diario del giorno

### Patologies (`src/pages/Patologies.jsx`)
Lista/aggiunta/rimozione condizioni. Form con selezione condizione, data diagnosi (o "solo anno"), nome custom per "altro". Card con emoji, colore, dati monitorati. Toast di conferma.

### Documents (`src/pages/Documents.jsx`)
Upload referti con due flussi distinti: **Scatta foto** (camera) e **Carica PDF**. Lista con filtri per tipo/condizione, anteprima, link esterno, eliminazione. Toast.

### Trends (`src/pages/Trends.jsx`)
Dashboard analitica:
- Selettore periodo (7g/14g/30g/90g)
- Card metriche (dolore, energia, sonno, umore) con delta vs periodo precedente
- **WeeklyAISummary** — sintesi AI settimanale
- Grafici Recharts (dolore, energia, sonno, umore + metriche modulo-specifiche)
- `ContinuityRibbon` — nastro SVG curvo con tooltip interattivi
- Note del periodo, raccomandazioni lifestyle (helpful/avoid) per condizione
- Generazione **report stampabile** (window.print)

### Appointments (`src/pages/Appointments.jsx`)
Gestione visite: form, prossimi/passati, archivio referti, checklist preparazione, alert trend dolore.

### Therapies (`src/pages/Therapies.jsx`)
Lista terapie con alert farmaci dovuti (finestra 5 min), form aggiunta, eliminazione. (Streak conferma farmaci: da implementare.)

### Contents (`src/pages/Contents.jsx`)
Card educative per condizione con link diretti a **ISSalute** (`src/lib/issUrls.js`). Filtri per condizione.

### Docs (`src/pages/Docs.jsx`)
Pagina di documentazione: anteprima del file `TRACCIA_DOCS.md` con pulsanti **Condividi su WhatsApp** (Web Share API con file, fallback download + wa.me) e **Scarica .md**.

---

## 6. Componenti

### Diary
- **`OnboardingTour`** (`src/components/diary/OnboardingTour.jsx`) — onboarding guidato a 3 step: Nome (→ `updateMe`) → Condizioni (→ `bulkCreate Pathology`) → Tema (light/dark). Pallini di progresso, animazioni, tasto Indietro.
- **`OnboardingModal`** — modale legacy solo-nome (non più usato in Home).
- **`GreetingCard`** — saluto + data + `ZenGardenMini` (variant `greeting`).
- **`ConditionSelector`** — griglia pill condizioni.
- **`DiaryForm`** — form diario: slider dolore/energia, sonno, farmaci, mood (card emoji), `ModuleFields` dinamici, note, allarmi. Salvataggio con toast.
- **`ModuleFields`** — render dinamico campi per modulo (slider, select, number, text, chips, checkbox).
- **`ZenGarden`** — giardino grande SVG procedurale (piante che crescono per tier di streak, fiori, burst di foglie). *Rimosso dalla Home, sostituito da ZenGardenMini.*
- **`ZenGardenMini`** (`src/components/diary/ZenGardenMini.jsx`) — giardino compatto, due varianti: `header` (pill 36px) e `greeting` (92px + numero streak). Calcola streak dalle `DiaryEntry`.

### Trends
- **`WeeklyAISummary`** (`src/components/trends/WeeklyAISummary.jsx`) — legge le ultime 7 `DiaryEntry`, costruisce un payload JSON e chiama `base44.integrations.Core.InvokeLLM` con prompt empatico non-diagnostico + `response_json_schema` (`{headline, summary}`). Mostra titolo + corpo + disclaimer, con pulsante rigenera e stato loading/errore.
- **`ContinuityRibbon`** — SVG nastro di continuità (catmull-rom spline) con tooltip e legenda.

### Generici
- **`Navbar`** — header sticky: logo 🌿 Traccia, nome utente, logout, toggle tema (Sun/Moon), toggle lingua, nav tabs scrollabili (inclusa "Guida" → `/docs`).
- **`Layout`** — Navbar + DisclaimerBanner + `<Outlet />`.
- **`DisclaimerBanner`** — banner disclaimer non-diagnostico.
- **`RefBadge`** — badge range di riferimento (sempre range pubblici, mai interpretazioni).
- **`HeroIllustration`** — illustrazione sole/colline (sostituita da ZenGardenMini nel saluto).
- **`ScrollToTop`**, **`ProtectedRoute`**, **`UserNotRegisteredError`**, **`AuthLayout`**, **`GoogleIcon`** — infrastruttura auth/router.
- **shadcn/ui** — `src/components/ui/*` (button, input, toast, dialog, select, ecc.)

---

## 7. Lib (`src/lib/`)

- **`conditions.js`** — hub centrale delle 9 condizioni croniche: definizioni bilingue (emoji, colore, descrizione/definizione, sintomi di allarme, campi dinamici, badge dolore, livelli umore, opzioni farmaci, contenuti educativi, raccomandazioni lifestyle). Helper: `getCondition(key, lang)`, `getConditionList(lang)`, `getPainBadges(lang)`, `getMedicationOptions(lang)`, `getBadgeStyle(level)`, `MOOD_LEVELS`, `NO_PAIN_MODULES`.
- **`translations.js`** — dizionario UI IT/EN + `t(key, lang)`.
- **`dateUtils.js`** — `formatItalianDate`, `formatItalianDateShort`, `formatDateInput`, `todayISO`, `subtractDays`, `getGreeting(lang)`, helper periodo (`getPeriodDays`/label).
- **`issUrls.js`** — mappa condizioni/card → link ISSalute.
- **`AuthContext.jsx`** — `AuthProvider`, `useAuth` (isLoadingAuth, authError, navigateToLogin).
- **`LanguageContext.jsx`** — `LanguageProvider`, `useLanguage`.
- **`query-client.js`**, **`utils.js`** (`cn`), **`authReturnTo.js`**, **`app-params.js`**, **`PageNotFound.jsx`**.

### Condizioni supportate (9)
Endometriosi · IBD (Chron/Colite) · Emicrania · Diabete · PCOS · Ipertiroidismo · Ipotiroidismo · Fibromialgia · Artrite Reumatoide. Ogni condizione ha modulo-specific data fields, allarmi e contenuti dedicati. Fibromialgia e Artrite Reumatoide sono "no-pain modules" (`NO_PAIN_MODULES`).

---

## 8. Integrazioni (Core) usate

Tramite `base44.integrations.Core.*`:

| Endpoint | Uso |
|----------|-----|
| **`InvokeLLM`** | Sintesi AI settimanale (`WeeklyAISummary`). Prompt empatico non-diagnostico, `response_json_schema` `{headline, summary}`. |
| `UploadPublicFile` | Upload referti (Documents). |
| `SendEmail` | Email a utenti registrati (inviti/notifiche). *Nota: email a non-utenti richiede piano a pagamento + dominio custom.* |
| `GenerateImage` / `GenerateVideo` / `GenerateSpeech` / `TranscribeAudio` / `ExtractDataFromUploadedFile` / `UploadPrivateFile` / `CreateFileSignedUrl` | Disponibili, non ancora usate in feature attive. |

### SDK entità (esempi)
```js
base44.entities.DiaryEntry.create({...})
base44.entities.DiaryEntry.list('-entry_date', 400)
base44.entities.DiaryEntry.filter({...}, '-created_date', 10)
base44.entities.Pathology.bulkCreate([{condition:'emicrania'}])
base44.entities.Pathology.delete(id)
base44.auth.me() / base44.auth.updateMe({display_name}) / base44.auth.logout('/')
base44.users.inviteUser(email, role)
```

---

## 9. Flussi chiave

### Onboarding (nuovo utente)
1. **Nome** → `updateMe({display_name})` con capitalizzazione automatica (ogni parola maiuscola).
2. **Condizioni** → selezione multipla → `Pathology.bulkCreate`.
3. **Tema** → `setTheme('light'|'dark')`.

### Diario giornaliero
Selezione modulo → compilazione (slider, mood, campi modulo, allarmi) → `DiaryEntry.create` → toast + aggiornamento streak giardino.

### Streak / Gamification
`computeStreak(entries)` conta giorni consecutivi di registrazione (tollera giorno corrente mancante). Tier: 0 (seme) → 1 → 2 → 3 (fiori). Lo streak alimenta `ZenGarden` e `ZenGardenMini`.

### Sintesi AI settimanale
`WeeklyAISummary` → payload 7 giorni → `InvokeLLM` (modello automatico, niente web search) → `{headline, summary}` + disclaimer "non è una diagnosi né un parere clinico".

---

## 10. Autenticazione

Pagine boilerplate (`Login`, `Register`, `ForgotPassword`, `ResetPassword`, `OAuthConsent`):
- Email/password, Google OAuth, OTP (register → verifyOtp → setToken → redirect), reset password.
- `ProtectedRoute` protegge le rotte autenticate.
- Hard redirect post-login tramite `returnTo` (fallback `/`).

---

## 11. To-do / Funzionalità da completare

- **Promemoria terapia con conferma visiva** — rendere funzionale "Segna come preso" con animazione + streak farmaci (richiede entità `MedicationLog`).
- **Notifiche push** dei promemoria farmaci (richiede service worker / build mobile).
- **Condivisione report** con il medico (email/WhatsApp) e **condivisione giardino** come immagine/SVG.
- **Obiettivi** nel tour di onboarding (eventuale persistenza).

---

## 12. Note

- Conformità **GDPR** e sicurezza del dato sanitario (crittografia + auth persistente).
- I badge clinici mostrano sempre range di riferimento pubblici, mai interpretazioni automatizzate.
- Il nome utente salvato ha sempre la lettera maiuscola per ogni parola.
- Tono di voce: calmo, rassicurante, accogliente — mai diagnostico.