// routes/dateSettings.js
const express = require('express');
const router = express.Router();
const DateSettings = require('../models/DateSettings');
const Payment = require('../models/Payment');
const Receipt = require('../models/Receipt');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Journal = require('../models/Journal');
const SalesReturn = require('../models/SalesReturn');
const PurchaseReturn = require('../models/PurchaseReturn');

// Get date settings for a specific entry type
router.get('/:entryType', async (req, res) => {
    try {
        const { entryType } = req.params;
        const companyId = req.session.currentCompany;
        const userId = req.user._id;
        const fiscalYearId = req.session.currentFiscalYear.id;

        // Validate entry type
        const validEntryTypes = ['payment', 'receipt', 'sales', 'purchase', 'journal', 'salesReturn', 'purchaseReturn'];
        if (!validEntryTypes.includes(entryType)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_ENTRY_TYPE',
                message: 'Invalid entry type'
            });
        }

        // Get or create date settings
        let dateSettings = await DateSettings.findOne({
            company: companyId,
            userId: userId,
            fiscalYear: fiscalYearId
        });

        if (!dateSettings) {
            dateSettings = new DateSettings({
                company: companyId,
                userId: userId,
                fiscalYear: fiscalYearId,
                entryTypes: {
                    payment: { useLastVoucherDate: false },
                    receipt: { useLastVoucherDate: false },
                    sales: { useLastVoucherDate: false },
                    purchase: { useLastVoucherDate: false },
                    journal: { useLastVoucherDate: false },
                    salesReturn: { useLastVoucherDate: false },
                    purchaseReturn: { useLastVoucherDate: false }
                }
            });
            await dateSettings.save();
        }

        // Get the last voucher date for this entry type
        let lastVoucher = null;
        let lastVoucherDate = null;
        let lastVoucherNepaliDate = null;

        switch (entryType) {
            case 'payment':
                lastVoucher = await Payment.findOne({ company: companyId })
                    .sort({ date: -1 })
                    .select('date nepaliDate');
                break;
            case 'receipt':
                lastVoucher = await Receipt.findOne({ company: companyId })
                    .sort({ date: -1 })
                    .select('date nepaliDate');
                break;
            case 'sales':
                lastVoucher = await Sales.findOne({ company: companyId })
                    .sort({ date: -1 })
                    .select('date nepaliDate');
                break;
            case 'purchase':
                lastVoucher = await Purchase.findOne({ company: companyId })
                    .sort({ date: -1 })
                    .select('date nepaliDate');
                break;
            case 'journal':
                lastVoucher = await Journal.findOne({ company: companyId })
                    .sort({ date: -1 })
                    .select('date nepaliDate');
                break;
            case 'salesReturn':
                lastVoucher = await SalesReturn.findOne({ company: companyId })
                    .sort({ date: -1 })
                    .select('date nepaliDate');
                break;
            case 'purchaseReturn':
                lastVoucher = await PurchaseReturn.findOne({ company: companyId })
                    .sort({ date: -1 })
                    .select('date nepaliDate');
                break;
        }

        if (lastVoucher) {
            lastVoucherDate = lastVoucher.date;
            lastVoucherNepaliDate = lastVoucher.nepaliDate;
        }

        res.json({
            success: true,
            data: {
                useLastVoucherDate: dateSettings.entryTypes[entryType].useLastVoucherDate,
                lastVoucherDate: lastVoucherDate,
                lastVoucherNepaliDate: lastVoucherNepaliDate,
                currentDate: new Date().toISOString().split('T')[0],
                currentNepaliDate: new (require('nepali-date-converter'))().format('YYYY-MM-DD')
            }
        });

    } catch (error) {
        console.error('Error fetching date settings:', error);
        res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Failed to fetch date settings'
        });
    }
});

// Update date settings for a specific entry type
router.put('/:entryType', async (req, res) => {
    try {
        const { entryType } = req.params;
        const { useLastVoucherDate } = req.body;
        const companyId = req.session.currentCompany;
        const userId = req.user._id;
        const fiscalYearId = req.session.currentFiscalYear.id;

        // Validate entry type
        const validEntryTypes = ['payment', 'receipt', 'sales', 'purchase', 'journal', 'salesReturn', 'purchaseReturn'];
        if (!validEntryTypes.includes(entryType)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_ENTRY_TYPE',
                message: 'Invalid entry type'
            });
        }

        // Update date settings
        let dateSettings = await DateSettings.findOneAndUpdate(
            {
                company: companyId,
                userId: userId,
                fiscalYear: fiscalYearId
            },
            {
                $set: {
                    [`entryTypes.${entryType}.useLastVoucherDate`]: useLastVoucherDate
                }
            },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            message: 'Date settings updated successfully',
            data: {
                useLastVoucherDate: dateSettings.entryTypes[entryType].useLastVoucherDate
            }
        });

    } catch (error) {
        console.error('Error updating date settings:', error);
        res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Failed to update date settings'
        });
    }
});

// Update last voucher date after saving a voucher
router.post('/:entryType/update-last-date', async (req, res) => {
    try {
        const { entryType } = req.params;
        const { date, nepaliDate } = req.body;
        const companyId = req.session.currentCompany;
        const userId = req.user._id;
        const fiscalYearId = req.session.currentFiscalYear.id;

        // Validate entry type
        const validEntryTypes = ['payment', 'receipt', 'sales', 'purchase', 'journal', 'salesReturn', 'purchaseReturn'];
        if (!validEntryTypes.includes(entryType)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_ENTRY_TYPE',
                message: 'Invalid entry type'
            });
        }

        // Update last voucher date
        await DateSettings.findOneAndUpdate(
            {
                company: companyId,
                userId: userId,
                fiscalYear: fiscalYearId
            },
            {
                $set: {
                    [`entryTypes.${entryType}.lastVoucherDate`]: date,
                    [`entryTypes.${entryType}.lastVoucherNepaliDate`]: nepaliDate
                }
            },
            { upsert: true }
        );

        res.json({
            success: true,
            message: 'Last voucher date updated successfully'
        });

    } catch (error) {
        console.error('Error updating last voucher date:', error);
        res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Failed to update last voucher date'
        });
    }
});

module.exports = router;