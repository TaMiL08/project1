import { connectDB, sequelize } from './config/db';
import { Email } from './models/Email';

export const initDB = async () => {
    await connectDB();

    // Sync all defined models to the DB.
    // In production, you might want to use migrations instead of sync()
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');
};
