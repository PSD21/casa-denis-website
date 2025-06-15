# Casa Denis - Server Backend

## 📋 Descriere

Server backend pentru Casa Denis - un centru after-school dedicat dezvoltării armonioase a copiilor. Acest server oferă API-uri complete pentru gestionarea conținutului website-ului prin intermediul unui dashboard admin.

## 🚀 Instalare și Configurare

### Prerequisite

- Node.js (versiunea 14 sau mai nouă)
- npm (Node Package Manager)
 
### Pași de instalare

1. **Navighează în directorul proiectului:**
   ```bash
   cd casadenis-project
   ```

2. **Instalează dependințele:**
   ```bash
   npm install
   ```

   Sau folosește scriptul de instalare rapidă:
   ```bash
   npm run install-deps
   ```

3. **Pornește serverul:**
   ```bash
   npm start
   ```

   Pentru dezvoltare (cu auto-restart):
   ```bash
   npm run dev
   ```

## 🌐 Accesare

- **Website principal:** http://localhost:3000
- **Dashboard Admin:** http://localhost:3000/admin.html
- **Pagina detaliată:** http://localhost:3000/about-detailed.html
- **Galeria foto:** http://localhost:3000/gallery.html

## 📊 API Endpoints

### Hero Section
- `GET /api/hero` - Obține datele hero
- `POST /api/hero` - Actualizează hero section

### About Section
- `GET /api/about` - Obține datele despre
- `POST /api/about` - Actualizează secțiunea despre (cu suport pentru upload imagini)

### Programs
- `GET /api/programs` - Lista programelor
- `POST /api/programs` - Adaugă/actualizează program
- `DELETE /api/programs/:id` - Șterge program

### Schedule
- `GET /api/schedule` - Programul zilnic
- `POST /api/schedule` - Actualizează programul

### Spaces
- `GET /api/spaces` - Lista spațiilor
- `POST /api/spaces` - Adaugă/actualizează spațiu (cu suport pentru imagini)
- `DELETE /api/spaces/:id` - Șterge spațiu

### Gallery
- `GET /api/gallery` - Lista imaginilor
- `POST /api/gallery` - Upload imagini multiple
- `DELETE /api/gallery/:id` - Șterge imagine

### Testimonials
- `GET /api/testimonials` - Lista testimonialelor
- `POST /api/testimonials` - Adaugă/actualizează testimonial
- `DELETE /api/testimonials/:id` - Șterge testimonial

### Contact
- `GET /api/contact` - Informații de contact
- `POST /api/contact` - Actualizează contactul

### About Detailed
- `GET /api/about-detailed` - Conținut pagina detaliată
- `POST /api/about-detailed` - Actualizează conținutul detaliat

### Messages
- `GET /api/messages` - Lista mesajelor
- `POST /api/messages` - Trimite mesaj nou
- `PUT /api/messages/:id` - Actualizează mesaj
- `DELETE /api/messages/:id` - Șterge mesaj

## 📁 Structura Datelor

Datele sunt stocate în fișiere JSON în directorul `./data/`:

- `hero.json` - Hero section
- `about.json` - Despre secțiune
- `programs.json` - Programe after-school
- `schedule.json` - Programul zilnic
- `spaces.json` - Spațiile disponibile
- `gallery.json` - Galeria foto
- `testimonials.json` - Testimoniale părinți
- `contact.json` - Informații contact
- `about-detailed.json` - Conținut pagina detaliată
- `messages.json` - Mesajele primite

## 🎨 Dashboard Admin

Dashboard-ul admin oferă interfață completă pentru editarea conținutului:

### Secțiuni disponibile:
- **Hero** - Titlu și subtitlu principal
- **About** - Descriere și misiune
- **Programs** - Gestionarea programelor educaționale
- **Schedule** - Programul zilnic
- **Spaces** - Spațiile disponibile pentru închiriere  
- **Gallery** - Galeria foto
- **Testimonials** - Testimoniale părinți
- **Contact** - Informații de contact
- **Messages** - Gestionarea mesajelor primite
- **About Detailed** - Conținut pagina detaliată cu:
  - Hero section
  - Misiune
  - Statistici
  - Valori organizaționale
  - Facilități
  - Echipa
  - Istoric

### Funcționalități:
- ✅ Editare în timp real
- ✅ Upload imagini
- ✅ Gestionare CRUD completă
- ✅ Validare formulare
- ✅ Interfață responsive
- ✅ Sisteme de tab-uri
- ✅ Animații UI moderne

## 🔧 Configurare

### Variabile de mediu
Serverul folosește portul 3000 implicit. Pentru a schimba portul:

```bash
PORT=8080 npm start
```

### Upload imagini
Imaginile sunt stocate în `public/images/` și sunt accesibile direct via URL.

### Backup date
Pentru a face backup la date:
```bash
cp -r data data_backup_$(date +%Y%m%d)
```

## 🛠 Dezvoltare

### Structura proiectului:
```
casadenis-project/
├── server.js          # Server principal
├── package.json       # Dependințe și scripturi
├── README.md          # Documentație
├── data/              # Stocare date JSON
├── public/            # Fișiere statice
│   ├── index.html     # Pagina principală
│   ├── admin.html     # Dashboard admin
│   ├── about-detailed.html
│   ├── gallery.html
│   ├── styles.css
│   └── images/        # Imagini upload
```

### Adăugare funcționalități noi:
1. Adaugă endpoint în `server.js`
2. Creează/actualizează fișierul JSON de date
3. Actualizează dashboard-ul admin
4. Testează funcționalitatea

## 🐛 Troubleshooting

### Probleme comune:

**Serverul nu pornește:**
- Verifică dacă Node.js este instalat: `node --version`
- Verifică dependințele: `npm install`
- Verifică portul 3000 să nu fie ocupat

**Erorile 404 pentru API:**
- Verifică dacă serverul rulează
- Verifică URL-urile API în browser
- Verifică consola pentru erori

**Problemele cu upload imagini:**
- Verifică permisiunile directorului `public/images/`
- Verifică mărimea fișierelor
- Verifică tipurile de fișiere acceptate

## 📞 Suport

Pentru probleme sau întrebări:
- Email: casa.denis2025@gmail.com
- Telefon: +40 740 490 171, +40 740 096 051

## 📄 Licență

MIT License - Vedere `LICENSE` pentru detalii.

---

**Casa Denis** - Un loc unde copiii înfloresc! 🌟 