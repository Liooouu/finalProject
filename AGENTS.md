# TrackED - Agent Instructions

## Quick Start

```bash
# Terminal 1 - Backend (requires MongoDB running on 127.0.0.1:27017)
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Project Structure

- `backend/` - Express.js + Mongoose API (port 5000)
  - `server.js` - Entry point, connects DB then starts server
  - `routes/` - auth, admin, events, account, protected
  - `models/` - User schema (password hashed pre-save)
  - `middleware/` - authMiddleware.js (protect, authorize)
  - `config/db.js` - MongoDB connection
  - `seedAdmin.js` - Creates default admin account

- `frontend/` - React 19 + Vite + Tailwind CSS v4 (port 5173)
  - `src/App.jsx` - Route definitions
  - `src/api/axios.js` - API client (base: http://localhost:5000/api)
  - `src/utils/auth.js` - JWT decode, role check, logout
  - `src/components/ProtectedRoute.jsx` - Role-based route guards

## Commands

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | backend/ | Start server with nodemon |
| `npm run start` | backend/ | Start server without watch |
| `npm run dev` | frontend/ | Start Vite dev server |
| `npm run lint` | frontend/ | Run ESLint |
| `npm run build` | frontend/ | Production build |
| `node seedAdmin.js` | backend/ | Create admin@tracked.com / admin123 |

## Tailwind CSS

Uses Tailwind v4 with `@tailwindcss/vite` plugin. No `tailwind.config.js` - styles are in `src/index.css` with `@import "tailwindcss"`.

## Auth Flow

1. Login POST to `/api/auth/login` returns `{ token, role }`
2. Token stored in `localStorage.token`
3. Axios interceptor adds `Authorization: Bearer <token>` to all requests
4. ProtectedRoute checks JWT role before rendering

## Role System

- **student** - Can register, view events, mark attendance
- **organizer** - Created by admin, manages events and attendees
- **admin** - Seeding only, creates organizers

Registration is **student-only**. Organizers must be created by admins.

## API Endpoints

| Route | Auth | Roles |
|-------|------|-------|
| POST /api/auth/register | None | student only |
| POST /api/auth/login | None | all |
| /api/admin/* | Bearer | admin |
| /api/events/* | Bearer | varies |
| /api/account/* | Bearer | all |

## Setup Requirements

- MongoDB must be running at `127.0.0.1:27017`
- Backend `.env` contains `MONGO_URI`, `PORT=5000`, `JWT_SECRET`, `JWT_EXPIRES_IN`
- Run `node backend/seedAdmin.js` once to create the first admin account
