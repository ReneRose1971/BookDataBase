# Buchdatenbank (Book Database)

## Overview

A personal book management application built with Node.js and Express. The application allows users to manage their book collection, including tracking books, authors, reading lists, and tags. It features a German-language interface designed for a single user accessing from one browser window.

The system follows a traditional server-rendered architecture with vanilla JavaScript handling dynamic UI updates on the client side, backed by a PostgreSQL database for persistent storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Runtime**: Node.js with ES Modules (`"type": "module"`)
- **Framework**: Express.js for HTTP routing and static file serving
- **Database**: PostgreSQL via the `pg` library (raw queries, no ORM)
- **Configuration**: Environment variables loaded via `dotenv`

### Frontend Architecture
- **UI Framework**: Pico.css (CDN-loaded) - no other CSS frameworks permitted
- **JavaScript**: Vanilla JavaScript only - no React, Vue, or other frontend frameworks
- **State Management**: Simple centralized state pattern
- **Styling**: CSS split across multiple files in `/public/css/` (base, layout, navigation, dataviews, components)

### View System
- **Pattern**: HTML partials loaded dynamically via fetch
- **Location**: View templates in `/public/views/` with `.view.html` extension
- **Controllers**: JavaScript modules in `/public/controllers/` with mount/unmount lifecycle
- **Dialogs**: Native HTML `<dialog>` elements for modals

### Key Design Decisions

1. **Data-Driven UI Updates**: After any CRUD operation, data is re-fetched from the server and the view is re-rendered. No manual DOM synchronization.

2. **No Inline Styles**: All CSS must go in `/public/css/` files. No `<style>` blocks in HTML.

3. **Single User Model**: No WebSockets, Server-Sent Events, or polling since the app is designed for one user in one browser window.

4. **Semantic HTML**: UI uses semantic elements (main, form, label, input, button, table) following Pico.css conventions.

5. **Controller Pattern**: Each view has a corresponding controller with `mount(rootElement)` and `unmount(rootElement)` functions for lifecycle management.

### Database Schema (Partial)
- `book_lists` table with `book_list_id`, `name`, `is_standard` columns
- Standard lists seeded: "Gelesene Bücher" (Read Books), "Wunschliste" (Wishlist)
- Additional tables for books, authors, and tags (structure inferred from views)

## External Dependencies

### Runtime Dependencies
- **express** (^4.22.1): Web framework for routing and middleware
- **pg** (^8.17.1): PostgreSQL client for database operations
- **dotenv** (^10.0.0): Environment variable management

### External Services
- **PostgreSQL Database**: Primary data store, connection via `DATABASE_URL` environment variable
- **Pico.css CDN** (unpkg.com): CSS framework loaded from CDN

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `PGUSER`: Database user (used for connection validation)
- `PGPASSWORD`: Database password (required, validated on startup)
- `PORT`: Server port (defaults to 5000)