# 🚀 SCHNELLSTART - Nettgeflüster App

## ⚡ In 5 Minuten starten:

### 1. Terminal öffnen
- Mac: Spotlight (CMD+Space) → "Terminal" eingeben

### 2. Zum Ordner navigieren
```bash
cd ~/Downloads/nettgefluester-app
```

### 3. Setup ausführen
```bash
./setup.sh
```
*Dauert 3-5 Minuten (installiert alles automatisch)*

### 4. App starten
```bash
./start.sh
```

### 5. Browser öffnen
- Öffne `frontend/index.html` in deinem Browser
- Oder gehe zu: http://localhost:8000

---

## ✅ Das war's!

Die App läuft jetzt lokal auf deinem Mac.

---

## 📱 Für Philipp & Nadine online bereitstellen:

Lies: `DEPLOYMENT.md`

Kurz:
1. Render.com Account erstellen (kostenlos)
2. Backend hochladen
3. Vercel.com für Frontend (kostenlos)
4. URL teilen

**Kosten: €0/Monat**

---

## 📚 Weitere Dokumentation:

- **README.md** - Vollständige technische Dokumentation
- **BENUTZERHANDBUCH.md** - Guide für Philipp & Nadine
- **DEPLOYMENT.md** - Online-Hosting Guide

---

## 🆘 Probleme?

### "Permission denied"
```bash
chmod +x setup.sh start.sh
```

### "Python nicht gefunden"
- Installiere Python: https://www.python.org/downloads/

### "Module not found"
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

---

**Viel Erfolg! 🎙️🐦**
