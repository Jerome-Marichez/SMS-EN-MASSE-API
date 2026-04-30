# SmsEnMasse — 2FA Login Example (Node.js / NestJS)

> A minimal example showing how to use the [SmsEnMasse API](https://api-staging.smsenmasse.fr/docs) to build SMS-based two-factor authentication (2FA).

---

> ⚠️ **Security disclaimer / Avertissement de sécurité**
>
> **EN — ** This example is provided for **demonstration purposes only**. The OTP implementation is functional but **not production-ready**: the OTP store is in-memory (resets on restart), there is no rate limiting, no brute-force protection, and no proper session management. Do not use this code as-is in a production environment. Always implement proper security measures when dealing with authentication.
>
> **FR — ** Cet exemple est fourni à **titre de démonstration uniquement**. L'implémentation OTP est fonctionnelle mais **non destinée à la production** : le stockage des OTP est en mémoire (réinitialisé au redémarrage), il n'y a pas de limitation de débit, pas de protection contre le brute-force, et pas de gestion de session sécurisée. N'utilisez pas ce code tel quel dans un environnement de production. Implémentez toujours des mesures de sécurité appropriées pour tout système d'authentification.

---

## English

### Quick start (local)

```bash
# 1 — Install dependencies
npm install

# 2 — Configure environment variables
cp .env.example .env
# Edit .env and fill in your SMSENMASSE_API_KEY (and optionally SMTP settings)

# 3a — Start the full application (backend + frontend served together)
npm run start:dev

# 3b — Preview the frontend HTML only (no API calls, for UI dev)
npm run frontend
```

Open `http://localhost:3000` (full app) or `http://localhost:3001` (frontend only).

> **Note:** `npm run start:dev` starts the NestJS backend which also serves the frontend as static files. You only need **one command** to run the whole application.

### Déploiement sur Railway (gratuit) / Deploy on Railway (free)

[Railway](https://railway.app) is the recommended free hosting platform for this project. It keeps the server always on (no sleep), which is required for the SmsEnMasse webhooks to be received.

**Steps:**

1. Push this project to a GitHub repository (make sure `.env` is in `.gitignore` — it already is)

2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**

3. Select your repository — Railway auto-detects Node.js and uses the `Procfile`

4. In Railway → your service → **Variables**, add all the variables from `.env.example`:
   ```
   SMSENMASSE_API_KEY=your_api_key
   MAIL_FROM=noreply@yourdomain.com
   REPORT_EMAIL=admin@yourdomain.com
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=you@example.com
   SMTP_PASS=your_smtp_password
   ```

5. In Railway → your service → **Settings** → **Networking** → **Generate Domain**  
   You will get a URL like `https://your-app.up.railway.app`

6. Set `WEBHOOK_BASE_URL` to that Railway URL:
   ```
   WEBHOOK_BASE_URL=https://your-app.up.railway.app
   ```

7. Railway automatically redeploys on every `git push`.

---

### SmsEnMasse API — Core integration

This section contains everything specific to the **SmsEnMasse API**. These are the files you need to replicate in your own project.

#### Authentication

All requests use the `X-API-KEY` header with your API key (never expose it in the browser):

```typescript
// src/sms/sms.service.ts
axios.create({
  baseURL: 'https://api.smsenmasse.fr',
  headers: { 'X-API-KEY': process.env.SMSENMASSE_API_KEY },
});
```

Get your API key at: [https://www.smsenmasse.fr/v1/account-settings](https://www.smsenmasse.fr/v1/account-settings)

#### API Endpoints used

| Method | Endpoint           | Description                |
|--------|--------------------|----------------------------|
| POST   | `/api/v1/sms`      | Send an SMS campaign (OTP) |
| GET    | `/api/v1/sms`      | List SMS campaigns         |
| GET    | `/api/v1/sms/{id}` | Get a specific campaign    |
| DELETE | `/api/v1/sms/{id}` | Delete a campaign          |

#### Send an SMS (POST /api/v1/sms)

```typescript
// src/types/sms.types.ts — CreateSmsDto
{
  recipients: "33612345678",          // international format, comma-separated
  message: "Your code is: 123456",    // max 160 chars
  sender: "VerifySMS",                // 3–11 chars, starts with a letter
  name: "OTP Login",                  // optional campaign name
}
```

Response: `{ campagneId: 42 }`

#### TypeScript types

All SmsEnMasse types are defined in `src/types/sms.types.ts`:
- `CreateSmsDto` — body for POST /api/v1/sms
- `Campagnesms` — campaign object returned by GET endpoints
- `CampagnesmsStateEnum` — campaign states (-3 OTP, -2 BAT, -1 Draft, 0 Pending, 1 In progress, 2 Finished, 3 Break)
- `ContactsmsStateEnum` — recipient delivery states
- `WebHookContactSmsState` — webhook payload for delivery status updates
- `SendSmsResponse` — POST response `{ campagneId }`

#### Key files

| File | Role |
|------|------|
| `src/types/sms.types.ts` | All SmsEnMasse API types |
| `src/sms/sms.service.ts` | API client (send, list, get, delete) |
| `src/sms/sms.module.ts` | NestJS module |

---

### Demo application

This section describes the **demonstration** built on top of the SmsEnMasse API. It implements a complete SMS 2FA login flow.

#### What the demo does

1. User enters their phone number on the login page.
2. The backend sends a 6-digit OTP via the **SmsEnMasse API**.
3. The user enters the code received by SMS (valid 5 minutes).
4. The backend verifies the code and confirms authentication.
5. A **delivery report email** is sent to the configured admin address when SmsEnMasse posts a webhook.
6. The dashboard displays the full login history (in-memory, resets on server restart).

#### Flow diagram

```
[Browser]                        [NestJS Backend]            [SmsEnMasse API]
    |                                   |                           |
    |-- POST /api/auth/send-otp ------->|                           |
    |       { phone }                   |-- POST /api/v1/sms ------>|
    |                                   |   X-API-KEY: ***          |
    |                                   |<-- { campagneId } --------|
    |<-- { message: "OTP sent" } -------|                           |
    |                                   |                           |
    |-- POST /api/auth/verify-otp ----->|                           |
    |       { phone, code }             |                           |
    |<-- { token, phone } --------------|                           |
    |                                   |-- Login report email ---->|
```

#### Project structure

```
├── src/
│   ├── types/
│   │   ├── sms.types.ts        # SmsEnMasse API types
│   │   ├── auth.types.ts       # Auth flow types (OtpEntry, AuthToken, LoginEvent…)
│   │   └── mail.types.ts       # Mail report types
│   ├── sms/
│   │   ├── sms.service.ts      # SmsEnMasse API client
│   │   └── sms.module.ts
│   ├── auth/
│   │   ├── auth.controller.ts  # /api/auth/send-otp, /api/auth/verify-otp
│   │   ├── auth.service.ts     # OTP generation, verification, JWT
│   │   └── auth.module.ts
│   ├── mail/
│   │   ├── mail.service.ts     # Login report email (Nodemailer)
│   │   └── mail.module.ts
│   ├── app.module.ts
│   └── main.ts
├── public/                     # Frontend (plain HTML/CSS/JS)
│   ├── index.html              # Login page
│   ├── verify.html             # OTP entry page
│   ├── dashboard.html          # Post-login dashboard + history
│   ├── css/style.css
│   └── js/
│       ├── login.js
│       ├── verify.js
│       └── dashboard.js
├── .env.example
└── README.md
```

#### Environment variables

```env
# SmsEnMasse API key (required)
SMSENMASSE_API_KEY=your_api_key_here

# Email delivery reports — sent via SMTP when a webhook is received
MAIL_FROM=noreply@yourdomain.com
REPORT_EMAIL=admin@yourdomain.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@example.com
SMTP_PASS=your_smtp_password

PORT=3000
```

> Email reporting requires SMTP configuration. If `SMTP_HOST` is not set, `sendmail` is used as fallback (only works on servers where it is available).

---

## Français

### Démarrage rapide (local)

```bash
# 1 — Installer les dépendances
npm install

# 2 — Configurer les variables d'environnement
cp .env.example .env
# Éditer .env et renseigner SMSENMASSE_API_KEY (et optionnellement SMTP)

# 3a — Démarrer l'application complète (backend + frontend servis ensemble)
npm run start:dev

# 3b — Prévisualiser le frontend HTML uniquement (sans API, pour dev UI)
npm run frontend
```

Ouvrir `http://localhost:3000` (app complète) ou `http://localhost:3001` (frontend seul).

> **Note :** `npm run start:dev` démarre le backend NestJS qui sert également le frontend en fichiers statiques. Une **seule commande** suffit pour lancer toute l'application.

### Déploiement sur Railway (gratuit)

[Railway](https://railway.app) est la plateforme d'hébergement gratuit recommandée. Elle garde le serveur toujours actif (pas de mise en veille), ce qui est indispensable pour recevoir les webhooks SmsEnMasse.

**Étapes :**

1. Pousser ce projet sur un dépôt GitHub (`.env` est déjà dans `.gitignore`)

2. Sur [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → sélectionner le dépôt

3. Dans Railway → votre service → **Variables**, ajouter toutes les variables de `.env.example` :
   ```
   SMSENMASSE_API_KEY=votre_clé_api
   MAIL_FROM=noreply@votredomaine.com
   REPORT_EMAIL=admin@votredomaine.com
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=vous@example.com
   SMTP_PASS=votre_mot_de_passe_smtp
   ```

4. Dans Railway → votre service → **Settings** → **Networking** → **Generate Domain**  
   Vous obtenez une URL du type `https://votre-app.up.railway.app`

5. Définir `WEBHOOK_BASE_URL` avec cette URL Railway :
   ```
   WEBHOOK_BASE_URL=https://votre-app.up.railway.app
   ```

6. Railway redéploie automatiquement à chaque `git push`.

---

### API SmsEnMasse — Intégration principale

Cette section contient tout ce qui est spécifique à l'**API SmsEnMasse**. Ce sont les fichiers à reproduire dans votre propre projet.

#### Authentification

Toutes les requêtes utilisent l'en-tête `X-API-KEY` (ne jamais l'exposer dans le navigateur) :

```typescript
// src/sms/sms.service.ts
axios.create({
  baseURL: 'https://api.smsenmasse.fr',
  headers: { 'X-API-KEY': process.env.SMSENMASSE_API_KEY },
});
```

Obtenir votre clé API : [https://www.smsenmasse.fr/v1/account-settings](https://www.smsenmasse.fr/v1/account-settings)

#### Endpoints API utilisés

| Méthode | Endpoint           | Description                |
|---------|--------------------|----------------------------|
| POST    | `/api/v1/sms`      | Envoi d'un SMS (OTP)       |
| GET     | `/api/v1/sms`      | Liste des campagnes        |
| GET     | `/api/v1/sms/{id}` | Détail d'une campagne      |
| DELETE  | `/api/v1/sms/{id}` | Suppression d'une campagne |

#### Envoyer un SMS (POST /api/v1/sms)

```typescript
// src/types/sms.types.ts — CreateSmsDto
{
  recipients: "33612345678",          // format international, séparé par virgules
  message: "Votre code est: 123456",  // 160 caractères max
  sender: "VerifySMS",                // 3-11 chars, commence par une lettre
  name: "OTP Login",                  // nom de campagne (optionnel)
}
```

Réponse : `{ campagneId: 42 }`

#### Types TypeScript

Tous les types SmsEnMasse sont définis dans `src/types/sms.types.ts` :
- `CreateSmsDto` — corps de la requête POST /api/v1/sms
- `Campagnesms` — objet campagne retourné par les GET
- `CampagnesmsStateEnum` — états de campagne (-3 OTP, -2 BAT, -1 Brouillon, 0 En attente, 1 En cours, 2 Terminé, 3 Pause)
- `ContactsmsStateEnum` — états de livraison par destinataire
- `WebHookContactSmsState` — payload webhook pour les mises à jour de statut
- `SendSmsResponse` — réponse POST `{ campagneId }`

#### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/types/sms.types.ts` | Tous les types de l'API SmsEnMasse |
| `src/sms/sms.service.ts` | Client API (envoi, liste, get, suppression) |
| `src/sms/sms.module.ts` | Module NestJS |

---

### Application de démonstration

Cette section décrit la **démonstration** construite au-dessus de l'API SmsEnMasse. Elle implémente un flux de connexion 2FA par SMS complet.

#### Ce que fait la démo

1. L'utilisateur saisit son numéro de téléphone sur la page de connexion.
2. Le backend envoie un OTP à 6 chiffres via l'**API SmsEnMasse**.
3. L'utilisateur saisit le code reçu par SMS (valable 5 minutes).
4. Le backend vérifie le code et confirme l'authentification.
5. Un **email de rapport de livraison** est envoyé à l'adresse administrateur configurée lorsque SmsEnMasse poste un webhook.
6. Le tableau de bord affiche l'historique des connexions (en mémoire, réinitialisé au redémarrage).

#### Schéma du flux

```
[Navigateur]                     [Backend NestJS]            [API SmsEnMasse]
     |                                   |                          |
     |-- POST /api/auth/send-otp ------->|                          |
     |       { phone }                   |-- POST /api/v1/sms ----->|
     |                                   |   X-API-KEY: ***         |
     |                                   |<-- { campagneId } -------|
     |<-- { message: "OTP envoyé" } -----|                          |
     |                                   |                          |
     |-- POST /api/auth/verify-otp ----->|                          |
     |       { phone, code }             |                          |
     |<-- { token, phone } --------------|                          |
     |                                   |-- Email de rapport ----->|
```

#### Variables d'environnement

```env
# Clé API SmsEnMasse (obligatoire)
SMSENMASSE_API_KEY=votre_clé_api

# Rapports email de livraison — envoyés via SMTP lors de la réception d'un webhook
MAIL_FROM=noreply@votredomaine.com
REPORT_EMAIL=admin@votredomaine.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=vous@example.com
SMTP_PASS=votre_mot_de_passe_smtp

PORT=3000
```

> L'envoi d'email nécessite une configuration SMTP. Si `SMTP_HOST` n'est pas renseigné, `sendmail` est utilisé en fallback (uniquement disponible sur les serveurs où il est installé).

---

## Links / Liens

- Documentation API : [https://api-staging.smsenmasse.fr/docs](https://api-staging.smsenmasse.fr/docs)
- Créer un compte : [https://www.smsenmasse.fr](https://www.smsenmasse.fr)
- Clé API : [https://www.smsenmasse.fr/v1/account-settings](https://www.smsenmasse.fr/v1/account-settings)
