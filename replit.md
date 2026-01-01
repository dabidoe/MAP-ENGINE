# CFCME (Colonial Forces Campaign Map Engine)

## Overview

CFCME is a real-time multiplayer Virtual Tabletop (VTT) application designed for historical wargaming, specifically themed around Revolutionary War era battles. The application renders an interactive map using Leaflet.js with a stylized "parchment" visual filter, allowing multiple users to view and move character tokens simultaneously through WebSocket synchronization.

The core concept is a "war room" experience where players (referred to as "Generals") can collaboratively manage unit positions on a satellite imagery map with a colonial-era aesthetic overlay.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Single-page application** served from the `PUBLIC/` directory
- **Leaflet.js** for interactive map rendering with ESRI World Imagery tiles
- **Custom CSS filters** applied to map tiles to create a sepia-toned "parchment" appearance
- **Flexbox layout** with a fixed sidebar (300px) for unit listings and a flexible map viewport
- **Socket.io client** for real-time token position updates

### Backend Architecture
- **Express.js** server running on port 5000
- **Socket.io** for WebSocket-based real-time communication
- **Static file serving** from the `PUBLIC/` directory
- **REST endpoint** (`/session`) for loading initial game state from JSON

### Data Storage
- **File-based JSON storage** (`session.json`) for session/character data
- **In-memory token storage** on the client using JavaScript `Map` for tracking marker references
- No database currently implemented - designed for easy MongoDB integration later

### Real-time Synchronization Pattern
- When a user drags a token, a `token_move` event is emitted to the server
- Server broadcasts `update_token` to all other connected clients
- This creates a simple but effective multiplayer experience without complex state management

### Design Decisions
- **Why Leaflet over other mapping libraries**: Lightweight, well-documented, and excellent plugin ecosystem for custom markers
- **Why Socket.io**: Handles WebSocket fallbacks automatically, simplifies room-based broadcasting
- **Why file-based JSON**: Quick prototyping without database setup overhead; easily portable to MongoDB by matching document structure

## External Dependencies

### NPM Packages
- **express (^5.2.1)**: Web server framework for serving static files and API endpoints
- **socket.io (^4.8.3)**: Real-time bidirectional event-based communication
- **@types/node (^22.13.11)**: TypeScript definitions (suggests potential TypeScript migration)

### CDN Resources
- **Leaflet CSS/JS (1.9.4)**: Map rendering library loaded from unpkg.com
- **ESRI World Imagery**: Satellite tile layer from ArcGIS Online (no API key required for basic usage)
- **Google Fonts (Cinzel)**: Colonial-era styled serif font (referenced but not loaded in current code)

### Asset Hosting
- Character token images hosted on `statsheet-cdn.b-cdn.net` (BunnyCDN)
- External image URLs stored in session.json for character icons