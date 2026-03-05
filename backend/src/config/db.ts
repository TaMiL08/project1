import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'password';
const dbName = process.env.DB_NAME || 'ai_email_assistant';

const dbUrl = process.env.DATABASE_URL;

// If DATABASE_URL is provided (like in Supabase/Vercel), use it. Otherwise, fallback to local details.
export const sequelize = dbUrl
    ? new Sequelize(dbUrl, {
        dialect: 'postgres',
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
