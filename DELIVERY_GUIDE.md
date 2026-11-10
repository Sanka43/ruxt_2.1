# 🚀 RuXt 2.1 - Client Delivery & Distribution Guide

මෙම මාර්ගෝපදේශය මගින් **RuXt AI Studio 2.1** කිසිදු තාක්ෂණික දැනුමක් නැති ඕනෑම සාමාන්‍ය Client කෙනෙකුට (Zero-Configuration) deliver කරන්නේ කෙසේද යන්න පියවරෙන් පියවර පැහැදිලි කරයි.

---

## 🎯 1. Client ට App එක ලබා දෙන්නේ කෙසේද? (Delivery Formats)

ඔබට Client ට app එක ලබා දීමට ක්‍රම 2ක් භාවිතා කළ හැක:

### ක්‍රමය A: One-Click Installer (`RuXt-Setup-2.1.0.exe`)
* **විස්තරය:** සාමාන්‍ය Windows software (Chrome, VS Code) වගේ Next -> Install -> Finish වෙන සම්මත installer එකක්.
* **ලක්ෂණ:** 
  - Desktop shortcut එකක් සහ Start Menu icon එකක් auto හැදේ.
  - Windows Control Panel හරහා Uninstall කරගත හැක.
  - Client ට Node.js හෝ කිසිදු extra software එකක් install කිරීමට අවශ්‍ය නැත.

### ක්‍රමය B: Portable Executable (`RuXt-Portable-2.1.0.exe`)
* **විස්තරය:** Install කිරීමක් පවා අවශ්‍ය නැති තනි `.exe` file එකක්.
* **ලක්ෂණ:** USB pen drive එකකින් හෝ ඕනෑම folder එකක තබාගෙන කෙලින්ම double-click කර run කළ හැක.

---

## 🛠️ 2. Installer එක Build කරගන්නේ කෙසේද? (Developer Steps)

Project root folder එකේ (`c:\xampp\htdocs\ruxt_2.1`) terminal එකෙන් පහත command එක run කරන්න:

```bash
npm run dist
```

* මෙම command එක run වූ පසු `release/` folder එක තුළ:
  - `RuXt AI Studio Setup 2.1.0.exe` (Full NSIS Installer)
  - `RuXt AI Studio 2.1.0.exe` (Portable version)
  ලෙස files දෙකම ස්වයංක්‍රීයව නිර්මාණය වේ.

---

## 👤 3. End-User / Client අත්දැකීම (Zero-Configuration Experience)

Client කෙනෙක් app එක භාවිතා කරන ආකාරය:

1. **Open & Run:** Client විසින් `.exe` එක double-click කර open කරයි.
2. **Auto Database:** Local SQLite database එක client ගේ පරිගණකයේ ආරක්ෂිතව auto initialize වේ.
3. **Background Engine:** Local RuXt engine එක silent background process එකක් ලෙස port 1234 reserve කරගෙන run වේ. (කිසිදු කළු terminal window එකක් pop-up නොවේ).
4. **First-time Setup:**
   - Client හට Settings ටැබ් එකෙන් Google Gemini API Key හෝ OpenAI API Key එකක් ඇතුළත් කර Save කළ හැක.
   - Key එකක් නැතත් Local Agent frameworks සහ tools සාමාන්‍ය පරිදි ක්‍රියාත්මක වේ.
5. **App Close:** Client විසින් Window එක close කළ විට background node engine එකද safe විදියට auto terminate වේ.

---

## 📂 4. Project Structure Overview

```
ruxt_2.1/
├── electron/
│   ├── main.cjs         # Background engine auto-spawner & Desktop window lifecycle
│   └── preload.cjs      # Safe context bridge for security
├── server/
│   ├── index.js         # Express Engine running locally on port 1234
│   ├── db.js            # SQLite database manager (AppData persistence)
│   └── routes/          # Modular API endpoints (agents, chat, tasks, settings)
├── src/
│   ├── App.jsx          # React Studio UI (Dashboard, Agents, Chat, Tasks, Settings)
│   ├── main.jsx         # React DOM root
│   └── index.css        # Tailwind Dark-mode Theme & Scrollbars
├── agents/              # Installed agent packages (Elena Voss, Noah Reed, Numbers, etc.)
├── public/              # Branding logos, icons, and avatars
└── release/             # Built Windows .exe deliverables
```

---

## 🍎 6. Mac & Linux Release Guide

### Deliverable Formats:
* **macOS:** `.dmg` (Disk Image Installer) සහ `.zip` (Intel x64 & Apple Silicon arm64).
* **Linux:** `.AppImage` (Zero-install portable format) සහ `.deb` (Debian/Ubuntu package).

### Release කිරීමේ හොඳම ක්‍රමය (Automated GitHub Actions):
Windows OS එකක සිට Mac binaries build කළ නොහැකි බැවින්, project එක GitHub repository එකකට push කර tag එකක් දමන්න:
```bash
git add .
git commit -m "feat: add cross-platform mac and linux support"
git tag v2.1.0
git push origin main --tags
```
GitHub Actions මගින් ස්වයංක්‍රීයව `release.yml` run වී GitHub Releases පිටුව තුළ Windows `.exe`, Mac `.dmg`, Linux `.AppImage` files සියල්ල build කර දෙනු ඇත.

### Local Machine වලින් Build කරන්නේ නම්:
* **macOS මත:** `npm run dist:mac`
* **Linux / WSL2 මත:** `npm run dist:linux`

* **Web UI Dev Server:** `npm run dev`
* **Test Local Server:** `npm run server`
* **Desktop App Dev Mode (Hot Reload):** `npm run electron:dev`
* **Build Frontend:** `npm run build`
* **Unpacked App Test:** `npm run package`
* **Generate Client Installers (.exe):** `npm run dist`
