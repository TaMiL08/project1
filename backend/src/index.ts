import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

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
    res.send('AI Personal Email Assistant API is running');
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Start server with DB init
import { initDB } from './initDb';

// For local testing
if (process.env.NODE_ENV !== 'production') {
    initDB().then(() => {
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    }).catch((error) => {
        console.error('Failed to initialize database and server', error);
    });
} else {
    // For Vercel Serverless
    // Vercel handles the port listening dynamically, we just export the app
    // Note: In serverless, it's safer to initDB per-request or use a connection pool,
    // but we can attempt to initialize it once globally here.
    initDB().catch(console.error);
}

export default app;
