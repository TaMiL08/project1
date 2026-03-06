import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

// dotenv.config() is handled by Vercel in production
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';

// Root route
app.get('/', (req: Request, res: Response) => {
    res.send('AI Personal Email Assistant API is running (Supabase Mode)');
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mode: 'supabase',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
            HAS_GOOGLE_ID: !!process.env.GOOGLE_CLIENT_ID,
            HAS_GOOGLE_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
            HAS_GOOGLE_CALLBACK: !!(process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL),
            HAS_ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
            HAS_SUPABASE_URL: !!process.env.SUPABASE_URL,
            HAS_SUPABASE_KEY: !!process.env.SUPABASE_ANON_KEY,
        }
    });
});


// Start server
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

export default app;
