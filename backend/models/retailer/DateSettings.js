// models/DateSettings.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DateSettingsSchema = new Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fiscalYear: {
        type: Schema.Types.ObjectId,
        ref: 'FiscalYear',
        required: true
    },
    // Settings for different entry types
    entryTypes: {
        payment: {
            useLastVoucherDate: {
                type: Boolean,
                default: false
            },
            lastVoucherDate: Date,
            lastVoucherNepaliDate: String
        },
        receipt: {
            useLastVoucherDate: {
                type: Boolean,
                default: false
            },
            lastVoucherDate: Date,
            lastVoucherNepaliDate: String
        },
        sales: {
            useLastVoucherDate: {
                type: Boolean,
                default: false
            },
            lastVoucherDate: Date,
            lastVoucherNepaliDate: String
        },
        purchase: {
            useLastVoucherDate: {
                type: Boolean,
                default: false
            },
            lastVoucherDate: Date,
            lastVoucherNepaliDate: String
        },
        journal: {
            useLastVoucherDate: {
                type: Boolean,
                default: false
            },
            lastVoucherDate: Date,
            lastVoucherNepaliDate: String
        },
        salesReturn: {
            useLastVoucherDate: {
                type: Boolean,
                default: false
            },
            lastVoucherDate: Date,
            lastVoucherNepaliDate: String
        },
        purchaseReturn: {
            useLastVoucherDate: {
                type: Boolean,
                default: false
            },
            lastVoucherDate: Date,
            lastVoucherNepaliDate: String
        }
    }
}, {
    timestamps: true
});

// Ensure one DateSettings document per company, user, and fiscal year
DateSettingsSchema.index({ company: 1, userId: 1, fiscalYear: 1 }, { unique: true });

module.exports = mongoose.model('DateSettings', DateSettingsSchema);