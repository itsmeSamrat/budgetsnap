# BudgetSnap - OCR Transaction Management App

BudgetSnap is a modern web application that uses OCR (Optical Character Recognition) to automatically extract transaction details from receipt images. Built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- 📷 **OCR Receipt Processing**: Upload receipt images and automatically extract transaction details
- 🔐 **Secure Authentication**: Email/password authentication with Supabase Auth
- 💾 **Data Management**: Store and manage transactions with user-scoped access
- 📊 **Dashboard & Analytics**: Visual charts and financial insights
- 💬 **Smart Queries**: Preset financial queries and custom Q&A system
- 📱 **Responsive Design**: Works seamlessly on mobile, tablet, and desktop
- 🗂️ **Transaction Management**: Edit, filter, and export transaction data
- ☁️ **Cloud Storage**: Secure receipt storage with Supabase Storage

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Chart.js
- **Backend**: Supabase (Auth, Postgres, Storage, Edge Functions)
- **OCR**: Google Vision API / OCR.Space
- **Deployment**: Bolt Hosting

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the root directory:

```env
# Frontend Environment Variables
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Supabase Setup

#### Database Setup
1. Create a new Supabase project
2. Run the SQL migration file: `supabase/migrations/create_schema.sql`
3. This will create the required tables, RLS policies, and indexes

#### Storage Setup
1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `receipts`
3. Set the bucket to **Private** (not public)
4. Set up storage policies:

```sql
-- Policy for users to upload their own receipts
CREATE POLICY "Users can upload own receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy for users to view their own receipts
CREATE POLICY "Users can view own receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
```

#### Edge Functions Setup
1. Deploy the edge functions to Supabase:
   - `process_image`
   - `answer_query` 
   - `signed_image_url`

2. Set the following secrets in your Supabase Edge Functions dashboard:

```env
OCR_PROVIDER=google
GOOGLE_VISION_API_KEY=your-google-vision-api-key
GEMINI_API_KEY=your-gemini-api-key
OCRSPACE_API_KEY=your-ocrspace-api-key-optional
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. OCR Provider Setup

#### Google Vision API (Recommended)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Vision API
3. Create credentials (API Key)
4. Set `OCR_PROVIDER=google` and add your `GOOGLE_VISION_API_KEY`

#### Gemini API (Required for Structured Extraction)
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key for Gemini
3. Add your `GEMINI_API_KEY` to the edge function secrets

#### OCR.Space (Alternative)
1. Get a free API key from [OCR.Space](https://ocr.space/ocrapi)
2. Set `OCR_PROVIDER=ocrspace` and add your `OCRSPACE_API_KEY`

### 4. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Deployment

Deploy to Bolt Hosting or your preferred platform:

```bash
# Build for production
npm run build

# The dist folder contains the built application
```

## Usage Guide

### 1. Authentication
- Sign up with email and password
- No email confirmation required by default
- Automatic profile creation on signup

### 2. Upload Receipts
- Navigate to Upload page
- Select or drag-drop receipt images (JPG, PNG, JPEG)
- OCR processing takes 5-8 seconds
- Transaction details are automatically extracted and saved

### 3. Manage Transactions
- View all transactions in the Transactions page
- Edit transaction details inline
- Filter by date, category, or type
- Export data as CSV
- Preview receipt images

### 4. Dashboard Insights
- View monthly income, expenses, and net totals
- Interactive charts showing spending trends
- Recent transaction list
- Quick financial insights with preset queries

### 5. Settings
- Update display name and currency preferences
- Danger zone for data deletion

## OCR Processing Details

The OCR system automatically extracts:

- **Date**: Supports multiple formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
- **Merchant**: Uses Gemini AI to intelligently extract merchant/vendor names
- **Amount**: Looks for "total" lines first, otherwise uses largest currency amount
- **Type**: AI-powered classification as 'in' (income) or 'out' (expense)
- **Category**: AI-categorized into: shopping, rent, utility, grocery, dining, transportation, entertainment, health, income, fees, transfers, education, other
- **Notes**: Extracts relevant notes like "conversion fee", "foreign transaction", etc.

## Security Features

- **Row Level Security (RLS)**: All data is user-scoped
- **Secure File Storage**: Receipts stored in user-specific folders
- **Server-side OCR**: API keys never exposed to client
- **Signed URLs**: Temporary image access for previews
- **JWT Authentication**: Secure API access

## Development Features

- **Demo Data**: Seed demo transactions (dev mode only)
- **Debug OCR**: View raw OCR text output (dev mode only)
- **Hot Reload**: Instant development feedback

## File Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth)
├── lib/               # Utilities and configurations
├── pages/             # Main application pages
└── main.tsx          # Application entry point

supabase/
├── functions/         # Edge Functions
│   ├── process_image/ # OCR processing function
│   ├── structure_with_gemini/ # AI structure extraction
│   ├── answer_query/  # Financial query function
│   ├── signed_image_url/ # Image URL generation
│   └── _shared/       # Shared utilities
└── migrations/        # Database schema
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
1. Check the console for error messages
2. Verify environment variables are set correctly
3. Ensure Supabase services are properly configured
4. Review the OCR provider setup

## License

MIT License - feel free to use this project for learning and development.