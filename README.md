# Council Finder

A Next.js application for finding city council meetings in North Texas. Features a PostgreSQL database for caching meeting data to avoid excessive scraping.

## Features

- Search by zip code to find local city council meetings
- Browse all covered cities at once
- Cached meeting data with automatic refresh
- Beautiful, responsive UI
- Real-time meeting details with agenda links

## Covered Cities

- Frisco
- Prosper
- Denton
- Plano
- Aubrey
- Celina
- Allen
- Murphy

## Tech Stack

- **Frontend**: Next.js 16, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Hosting**: Railway (database and app)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

1. Clone the repository:
```bash
git clone git@github.com:jonathanbodnar/citycouncil.git
cd citycouncil
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

4. Run database migrations:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
npm run dev
```

## Railway Deployment

1. Create a new project on Railway
2. Add a PostgreSQL database
3. Connect your GitHub repository
4. Set the `DATABASE_URL` environment variable
5. Deploy!

Railway will automatically:
- Detect Next.js and set up build commands
- Run migrations with the Prisma postinstall hook

## API Endpoints

### GET /api/meetings

Fetch meetings by zip code or all cities.

Query params:
- `zip` - Filter by zip code
- `cities` - Comma-separated city slugs
- `all=true` - Fetch all meetings

### GET /api/cities

List all covered cities with cache status.

Query params:
- `zip` - Get cities for a specific zip code

### GET/DELETE /api/cache

View or refresh cache status.

Query params:
- `city` - Refresh specific city cache (DELETE only)

## Caching Strategy

- Meeting data is cached for 1 hour
- Each city's cache is independent
- Cache can be manually refreshed via API
- Mock data is returned as fallback when scraping fails

## License

MIT
