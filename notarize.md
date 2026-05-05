What was broken

  1. Missing private key (root cause)

  The .cer file was in the project but a .cer is only the public certificate — it has no private key. Code
   signing requires both. Without the private key, security find-identity returns 0 valid identities and
  codesign refuses to sign anything.

  2. Missing intermediate certificate

  Even after importing the cert + key, macOS showed CSSMERR_TP_NOT_TRUSTED because the Apple Developer ID
  G2 intermediate CA certificate was not in the keychain. Without it, macOS can't verify the full trust
  chain from your cert up to Apple's root CA.

  ---
  What we did to fix it

  ┌───────────────────────────────┬───────────────────────────────────────────────────────────────────┐
  │             Step              │                               What                                │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Generated CSR + private key   │ openssl req — created DevID_private.key on this Mac               │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Created new cert on Apple     │ Uploaded CSR → downloaded fresh .cer                              │
  │ portal                        │                                                                   │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Combined cert + key into .p12 │ openssl pkcs12 -legacy — needed legacy flag for macOS             │
  │                               │ compatibility                                                     │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Imported .p12 into keychain   │ security import — 1 identity imported                             │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Installed G2 intermediate     │ Downloaded from apple.com, imported → trust chain complete        │
  │ cert                          │                                                                   │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Verified                      │ security find-identity -v -p codesigning → 1 valid identity       │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Stored notarize credentials   │ xcrun notarytool store-credentials — credentials in keychain, not │
  │                               │  in files                                                         │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Fixed notarize.js             │ Now uses keychain profile instead of env vars                     │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Fixed package.json            │ Added gatekeeperAssess: false                                     │
  ├───────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ Removed leaked credentials    │ Cleaned openclaw.sh                                               │
  └───────────────────────────────┴───────────────────────────────────────────────────────────────────┘

  Now when you run pnpm build:mac — it signs with the valid identity, submits to Apple for notarization,
  and staples the ticket automatically.









What Notarization Is

  Apple scans your app and gives it a "ticket" — without it, macOS Gatekeeper blocks users from opening
  your app with a warning.

  ---
  Exactly What You Need

  1. Apple Developer Account

  - Paid membership ($99/year)

  2. Developer ID Application Certificate

  - Used to code sign your app before sending to Apple
  - Needs both certificate + private key in your Mac's Keychain

  3. App-Specific Password

  - A password generated from your Apple ID specifically for automated tools
  - NOT your main Apple ID password
  - Generated at appleid.apple.com


  4. Team ID

  - Your 10-character Apple Developer team identifier


  5. notarytool credentials stored in Keychain

  - Stored via xcrun notarytool store-credentials


  ---
  The Full Flow (what happens when you run pnpm build:mac)

  pnpm build:mac
        │
        ▼
  1. Vite builds React → dist/
        │
        ▼
  2. electron-builder packages → OctoClaw.app
        │
        ▼
  3. electron-builder CODE SIGNS the .app
     using "Developer ID Application: Dev Openledger"
     cert from your Keychain
        │
        ▼
  4. afterSign hook fires → scripts/notarize.js runs
        │
        ▼
  5. notarize.js uploads .app to Apple's servers
     using OctoClawNotarize keychain profile
        │
        ▼
  6. Apple scans the app (2-10 mins)
        │
        ▼
  7. Apple approves → sends back a ticket
        │
        ▼
  8. electron-builder STAPLES the ticket to the .app
     (so it works offline too)
        │
        ▼
  9. DMG is created with the signed + notarized .app
        │
        ▼
     dist/OctoClaw-1.0.0-arm64.dmg  ← ready to ship

  ---
  Files Involved

  ┌─────────────────────┬──────────────────────────────────────────────────────────────────────┐
  │        File         │                                 Role                                 │
  ├─────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ package.json        │ hardenedRuntime: true, afterSign, entitlements config                │
  ├─────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ entitlements.plist  │ Tells Apple what your app needs (JIT, memory, library access)        │
  ├─────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ scripts/notarize.js │ Runs after signing — uploads to Apple, waits for approval            │
  ├─────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ macOS Keychain      │ Holds cert + private key + notarytool credentials — nothing in files │
  └─────────────────────┴──────────────────────────────────────────────────────────────────────┘








1. Generate CSR + Private Key (one time, on this Mac)

  openssl req -new -newkey rsa:2048 -nodes \
    -keyout ~/Desktop/DevID_private.key \
    -out ~/Desktop/CertificateSigningRequest.certSigningRequest \
    -subj "/emailAddress=dev@openledger.xyz/CN=Dev Openledger/C=IN"

  2. After downloading .cer from Apple portal — combine into .p12

  # Convert .cer to .pem
  openssl x509 -inform DER -in ~/Desktop/developerID_application.cer -out
  ~/Desktop/developerID_application.pem

  # Combine cert + private key into .p12
  openssl pkcs12 -legacy -export \
    -inkey ~/Desktop/DevID_private.key \
    -in ~/Desktop/developerID_application.pem \
    -out ~/Desktop/DevID_combined.p12 \
    -name "Developer ID Application: Dev Openledger (HF6J2QT435)" \
    -passout pass:yourpassword

  3. Import .p12 into Keychain

  security import ~/Desktop/DevID_combined.p12 \
    -P "yourpassword" \
    -k ~/Library/Keychains/login.keychain-db \
    -T /usr/bin/codesign

  security set-key-partition-list \
    -S apple-tool:,apple: \
    ~/Library/Keychains/login.keychain-db

  4. Install Apple G2 Intermediate Certificate

  curl -s -o ~/Desktop/DeveloperIDG2CA.cer \
    "https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer"

  security import ~/Desktop/DeveloperIDG2CA.cer \
    -k ~/Library/Keychains/login.keychain-db

  5. Verify Certificate is Ready

  security find-identity -v -p codesigning
  # Must show: 1 valid identities found
  # "Developer ID Application: Dev Openledger (HF6J2QT435)"

  6. Store Notarization Credentials in Keychain

  xcrun notarytool store-credentials "OctoClawNotarize" \
    --apple-id "dev@openledger.xyz" \
    --team-id "HF6J2QT435" \
    --password "xxxx-xxxx-xxxx-xxxx"

  7. Build + Sign + Notarize

  pnpm build:mac

  8. Verify After Build

  # Check app is signed
  codesign -dv --verbose=4 dist/mac-arm64/OctoClaw.app

  # Check app is notarized
  spctl --assess --verbose dist/mac-arm64/OctoClaw.app
  # Should say: source=Notarized Developer ID

  # Check DMG is notarized
  spctl --assess --verbose dist/OctoClaw-1.0.0-arm64.dmg

  9. Debug If Something Goes Wrong

  # See full notarization log
  xcrun notarytool history --keychain-profile "OctoClawNotarize"
  xcrun notarytool log <submission-id> --keychain-profile "OctoClawNotarize"

  # Enable verbose build logging
  DEBUG=electron-notarize* pnpm build:mac

  ---
  Reference Sites

  ┌─────────────────┬──────────────────────────────────────────────────────────────────────────────────┐
  │     Purpose     │                                       URL                                        │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Create/manage   │ https://developer.apple.com/account/resources/certificates                       │
  │ certificates    │                                                                                  │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Generate        │                                                                                  │
  │ app-specific    │ https://appleid.apple.com → App-Specific Passwords                               │
  │ password        │                                                                                  │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Find your Team  │ https://developer.apple.com/account → Membership Details                         │
  │ ID              │                                                                                  │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Apple CA        │                                                                                  │
  │ certificates    │ https://www.apple.com/certificateauthority                                       │
  │ download        │                                                                                  │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ @electron/notar │ https://github.com/electron/notarize                                             │
  │ ize docs        │                                                                                  │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ electron-builde │                                                                                  │
  │ r code signing  │ https://www.electron.build/code-signing                                          │
  │ docs            │                                                                                  │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Apple           │ https://developer.apple.com/documentation/security/notarizing-macos-software-bef │
  │ notarization    │ ore-distribution                                                                 │
  │ docs            │                                                                                  │
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
  │ Apple           │ https://developer.apple.com/documentation/notaryapi                              │
  │ notarytool docs │                                                                                  │
  └─────────────────┴──────────────────────────────────────────────────────────────────────────────────┘

  ---
  Key Things to Never Forget

  - Private key stays on this Mac — never share DevID_private.key
  - App-specific password goes in Keychain only — never in files or git
  - If you move to a new Mac — export .p12 from Keychain Access → import on new Mac
  - If cert expires (2031) — repeat steps 1-5 only