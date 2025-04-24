# AI-Powered Image Management Tool

An innovative image management application that uses Google's Gemini 1.5 Vision model to analyze images and make them searchable by content.

## Features

- Upload single or multiple images for AI analysis
- Gemini 1.5 Vision integration for detailed image metadata extraction
- Local storage of all images and metadata for privacy
- Advanced search capabilities based on image content
- Unique and innovative user interface design

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Material UI
- **Backend**: Node.js, Express
- **Database**: SQLite (local storage)
- **AI**: Google Gemini 1.5 Vision API

## Project Structure

```
image-vision-app/
├── frontend/         # React frontend
│   ├── public/       # Static assets
│   └── src/          # React source code
│       ├── api/      # API integration
│       ├── components/ # Reusable components
│       └── pages/    # Application pages
└── backend/          # Node.js/Express backend
    ├── uploads/      # Uploaded images storage
    └── server.js     # Main server file
```

## Setup Instructions

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with your Gemini API key:
   ```
   PORT=3001
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

4. Start the development server:
   ```
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## API Endpoints

- `POST /api/upload` - Upload a single image for analysis
- `POST /api/upload/bulk` - Upload multiple images for analysis
- `GET /api/search?query=text` - Search images by content
- `GET /api/images` - Get all images
- `GET /api/images/:id` - Get image by ID

## Image Analysis Metadata

Gemini 1.5 Vision analyzes each image for:

- Medium (Photography, Painting, Digital Art, etc.)
- People (Number, age estimate, gender)
- Actions (Running, dancing, sitting, etc.)
- Clothes (Formal, casual, sportswear, etc.)
- Environment (Indoor, outdoor, city, nature, etc.)
- Colors (Top 2 dominant colors)
- Style (Abstract, realistic, vintage, modern, etc.)
- Mood (Happy, dramatic, nostalgic, etc.)
- Scene (Description of the scene - no more than 40/50 words)

## License

This project is licensed under the ISC License.