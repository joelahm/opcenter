# Fritzie Dashboard — OpCenter

Campaign Intelligence Dashboard built with Next.js 14, MySQL, and Docker.

## Quick Start (Mac)

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Copy this folder to your machine
Place the entire `fritzie-dashboard` folder at:
```
/Users/joelaposaga/fritzie-dashboard
```

### 2. Open Terminal and navigate to the folder
```bash
cd /Users/joelaposaga/fritzie-dashboard
```

### 3. Make the start script executable and run it
```bash
chmod +x start.sh
./start.sh
```

### 4. Open your browser
```
http://localhost:3000
```

That's it! The dashboard will be live with sample data. ✅

---

## Manual Commands

| Command | What it does |
|---|---|
| `docker compose up -d` | Start everything in background |
| `docker compose down` | Stop everything |
| `docker compose up --build -d` | Rebuild and start |
| `docker compose logs -f app` | See app logs live |
| `docker compose logs -f db` | See database logs |

---

## Project Structure

```
fritzie-dashboard/
├── app/
│   ├── api/
│   │   ├── reviews/route.ts      ← Reviews API (GET + POST)
│   │   ├── locations/route.ts    ← Locations API
│   │   └── campaigns/route.ts    ← Campaigns API
│   ├── dashboard/page.tsx        ← Main GBP Reviews dashboard
│   ├── campaigns/page.tsx        ← Campaigns page
│   ├── locations/page.tsx        ← Locations page
│   ├── tasks/page.tsx            ← Tasks (placeholder)
│   ├── contacts/page.tsx         ← GHL Contacts (placeholder)
│   └── layout.tsx                ← Root layout with sidebar
├── components/
│   └── dashboard/
│       ├── Sidebar.tsx
│       ├── Topbar.tsx
│       ├── MetricCard.tsx
│       ├── ReviewFeed.tsx
│       ├── ReviewsChart.tsx
│       ├── RatingBreakdown.tsx
│       ├── AlertPanel.tsx
│       ├── TopLocations.tsx
│       └── StatusBar.tsx
├── lib/
│   └── db.ts                     ← MySQL connection pool
├── init.sql                      ← Database schema + seed data
├── docker-compose.yml            ← Docker setup
├── Dockerfile                    ← App container
└── start.sh                      ← One-command startup script
```

---

## Adding Real Reviews via API

Your Google Apps Script will POST to this endpoint:

```
POST http://localhost:3000/api/reviews
Content-Type: application/json

{
  "location_gbp_id": "gbp_001",
  "reviewer": "John Doe",
  "stars": 5,
  "review_text": "Amazing experience!",
  "replied": false,
  "campaign": "Summer Promo",
  "review_date": "2024-06-16T10:00:00Z"
}
```

---

## Database Access

Connect directly to MySQL if needed:

```
Host:     localhost
Port:     3306
User:     fritzie
Password: fritzie123
Database: fritzie_dashboard
```
