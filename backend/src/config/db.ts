import { Sequelize } from 'sequelize';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Priority: DATABASE_URL (Manual) > POSTGRES_URL (Vercel Integration) > POSTGRES_URL_NON_POOLING
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
const dbHost = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : (process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432);
const dbUser = process.env.DB_USER || process.env.POSTGRES_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'password';
const dbName = process.env.DB_NAME || process.env.POSTGRES_DATABASE || 'ai_email_assistant';

// If DATABASE_URL is provided (like in Supabase/Vercel), use it. Otherwise, fallback to local details.
export const sequelize = dbUrl
    ? new Sequelize(dbUrl, {
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    })
    : new Sequelize(dbName, dbUser, dbPassword, {
        host: dbHost,
        port: dbPort,
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
    });

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL database connected successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error; // Let the caller handle it instead of killing the process
    }
};
