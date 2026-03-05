import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/db';

export interface EmailAttributes {
    id: string; // UUID
    sender: string;
    subject: string;
    body: string;
    summary: string | null;
    ai_reply: string | null;
    edited_reply: string | null;
    status: 'pending' | 'approved' | 'sent';
    created_at?: Date;
    updated_at?: Date;
}

export interface EmailCreationAttributes extends Optional<EmailAttributes, 'id' | 'summary' | 'ai_reply' | 'edited_reply' | 'status'> { }

export class Email extends Model<EmailAttributes, EmailCreationAttributes> implements EmailAttributes {
    public id!: string;
    public sender!: string;
    public subject!: string;
    public body!: string;
    public summary!: string | null;
    public ai_reply!: string | null;
    public edited_reply!: string | null;
    public status!: 'pending' | 'approved' | 'sent';
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

Email.init(
    {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        sender: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        subject: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        summary: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        ai_reply: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        edited_reply: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'sent'),
            defaultValue: 'pending',
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'emails',
        timestamps: true, // Will automatically handle createdAt and updatedAt
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }
);
