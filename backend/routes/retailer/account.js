const express = require('express')
const router = express.Router()
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Account = require('../../models/retailer/Account');
const CompanyGroup = require('../../models/retailer/CompanyGroup');
const { ensureAuthenticated, ensureCompanySelected, isLoggedIn } = require('../../middleware/auth')
const { ensureTradeType } = require('../../middleware/tradeType')
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear')
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange')
const FiscalYear = require('../../models/FiscalYear')
const Company = require('../../models/Company')
const Transaction = require('../../models/retailer/Transaction')

const path = require('path');
const fs = require('fs');
const exceljs = require('exceljs');
const multer = require('multer');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'accountuploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

router.get('/contacts', async (req, res) => {
    try {
        const companyId = req.session.currentCompany;
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear');

        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({ error: 'No fiscal year found in session or company.' });
        }

        const relevantGroups = await CompanyGroup.find({
            name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
        }).exec();

        const relevantGroupIds = relevantGroups.map(group => group._id);

        const accountContacts = await Account.find({
            company: companyId,
            fiscalYear: fiscalYear,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        })
            .select('name address phone email contactperson')
            .sort({ name: 1 });

        res.json(accountContacts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

router.get('/companies', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const companyId = req.session.currentCompany;
        const currentCompanyName = req.session.currentCompanyName;

        // Fetch the company and populate the fiscalYear
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat')
            .populate('fiscalYear')
            .lean();

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            // Fetch the fiscal year from the database if available in the session
            currentFiscalYear = await FiscalYear.findById(fiscalYear).lean();
        }

        // If no fiscal year is found in session but exists in company
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;

            // Set the fiscal year in the session for future requests
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };

            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company'
            });
        }

        // Get initial fiscal year
        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1)
            .lean();

        // Check if current fiscal year is initial
        const isInitialFiscalYear = currentFiscalYear._id.toString() === initialFiscalYear._id.toString();

        // Get accounts
        const accounts = await Account.find({
            company: companyId,
            $or: [
                { originalFiscalYear: fiscalYear }, // Created here
                {
                    fiscalYear: fiscalYear,
                    originalFiscalYear: { $lt: fiscalYear } // Migrated from older FYs
                }
            ]
        })
            .populate('companyGroups')
            .populate('originalFiscalYear')
            .lean();

        const companyGroups = await CompanyGroup.find({ company: companyId }).lean();

        // Prepare response
        const responseData = {
            success: true,
            data: {
                company: {
                    _id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    fiscalYear: company.fiscalYear
                },
                accounts,
                companyGroups,
                companyId,
                currentCompanyName,
                currentFiscalYear,
                isInitialFiscalYear,
                user: {
                    _id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    isAdmin: req.user.isAdmin,
                    role: req.user.role,
                    preferences: req.user.preferences || { theme: 'light' }
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (error) {
        console.error('Error in /companies route:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get('/companies/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType !== 'retailer') {
        return res.status(403).json({
            success: false,
            error: 'Access restricted to retailer accounts'
        });
    }

    try {
        const accountId = req.params.id;
        const currentCompanyName = req.session.currentCompanyName;
        const companyId = req.session.currentCompany;

        // Fetch company groups and company data in parallel
        const [companyGroups, company] = await Promise.all([
            CompanyGroup.find({ company: companyId }),
            Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear')
        ]);

        // Check if fiscal year is already in the session or available in the company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // If no fiscal year is found in session but available in company
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;

            // Update session with fiscal year details
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };

            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        const account = await Account.findOne({ _id: accountId, fiscalYear: fiscalYear })
            .populate('companyGroups')
            .populate('company')
            .populate('openingBalanceByFiscalYear.fiscalYear');

        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        // Ensure the account belongs to the current company
        if (!account.company._id.equals(companyId)) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized access to this account'
            });
        }

        // Find the opening balance for the current fiscal year
        const currentOpeningBalance = account.openingBalanceByFiscalYear.find(
            balance => balance.fiscalYear && balance.fiscalYear._id.toString() === fiscalYear
        );

        // Prepare response data
        // Modify the account response preparation
        const responseData = {
            success: true,
            data: {
                company: {
                    id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat
                },
                account: {
                    ...account.toObject(),
                    // Handle case where companyGroups might be a single object or array
                    companyGroups: Array.isArray(account.companyGroups)
                        ? account.companyGroups.map(group => ({
                            id: group._id,
                            name: group.name
                        }))
                        : account.companyGroups
                            ? [{
                                id: account.companyGroups._id,
                                name: account.companyGroups.name
                            }]
                            : []
                },
                financialInfo: {
                    currentOpeningBalance: currentOpeningBalance || null,
                    fiscalYear: {
                        id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate
                    }
                },
                companyGroups: companyGroups.map(group => ({
                    id: group._id,
                    name: group.name
                })),
                currentCompanyName,
                user: {
                    id: req.user._id,
                    role: req.user.role,
                    isAdmin: req.user.isAdmin,
                    preferences: req.user.preferences || {}
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error('Error fetching company:', err);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching company data',
            message: err.message
        });
    }
});

router.post('/companies', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { name, address, phone, ward, pan, email, contactperson, openingBalance, creditLimit, companyGroups } = req.body;
        const companyId = req.session.currentCompany;

        // Input validation
        if (!name || !companyGroups) {
            return res.status(400).json({
                success: false,
                error: 'Name and company group are required fields'
            });
        }

        // Fetch the company and populate the fiscalYear
        const company = await Company.findById(companyId).populate('fiscalYear');
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Get the initial fiscal year
        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1);

        if (!initialFiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'Initial fiscal year not found'
            });
        }

        // Check if fiscal year is in session or company
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // Set current fiscal year if not in session
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company'
            });
        }

        // Validate company group
        const accountGroup = await CompanyGroup.findOne({ _id: companyGroups, company: companyId });
        if (!accountGroup) {
            return res.status(400).json({
                success: false,
                error: 'Invalid account group for this company'
            });
        }

        // Check if opening balance is only set in initial fiscal year
        const isInitialYear = currentFiscalYear._id.toString() === initialFiscalYear._id.toString();
        if (!isInitialYear && openingBalance?.amount && parseFloat(openingBalance.amount) !== 0) {
            return res.status(400).json({
                success: false,
                error: 'Opening balance can only be set in the initial fiscal year'
            });
        }

        // Prepare opening balance data
        const openingBalanceAmount = isInitialYear && openingBalance?.amount
            ? parseFloat(openingBalance.amount)
            : 0;
        const openingBalanceType = isInitialYear && openingBalance?.type
            ? openingBalance.type
            : 'Dr';

        // Create new account
        const newCompany = new Account({
            name,
            address,
            phone,
            ward,
            pan,
            email,
            contactperson,
            creditLimit,
            companyGroups,
            initialOpeningBalance: {
                date: currentFiscalYear.startDate,
                amount: openingBalanceAmount,
                type: openingBalanceType,
                initialFiscalYear: currentFiscalYear._id
            },
            openingBalance: {
                date: currentFiscalYear.startDate,
                amount: openingBalanceAmount,
                type: openingBalanceType,
                fiscalYear: fiscalYear
            },
            openingBalanceByFiscalYear: [{
                amount: openingBalanceAmount,
                type: openingBalanceType,
                date: currentFiscalYear.startDate,
                fiscalYear: fiscalYear
            }],
            openingBalanceDate: currentFiscalYear.startDate,
            company: companyId,
            fiscalYear: [fiscalYear],
            originalFiscalYear: currentFiscalYear,
            createdAt: new Date()
        });

        await newCompany.save();

        res.status(201).json({
            success: true,
            message: 'Successfully created a new account',
            data: {
                account: newCompany.toObject()
            }
        });

    } catch (err) {
        console.error('Error creating account:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'An account with this name already exists within the selected company'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error while creating account',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

router.put('/companies/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { id } = req.params;
        const { name, address, ward, phone, pan, contactperson, email, companyGroups, openingBalance, creditLimit } = req.body;
        const companyId = req.session.currentCompany;

        // Validate input
        if (!name || !companyGroups) {
            return res.status(400).json({
                success: false,
                error: 'Name and company group are required fields'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        // Fetch company and fiscal year data
        const company = await Company.findById(companyId).populate('fiscalYear');
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1);

        if (!initialFiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'Initial fiscal year not found'
            });
        }

        // Get current fiscal year
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        // Set current fiscal year if not in session
        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company'
            });
        }

        // Validate company group
        const accountGroup = await CompanyGroup.findOne({ _id: companyGroups, company: companyId });
        if (!accountGroup) {
            return res.status(400).json({
                success: false,
                error: 'Invalid account group for this company'
            });
        }

        // Check if opening balance is only set in initial fiscal year
        const isInitialYear = currentFiscalYear._id.toString() === initialFiscalYear._id.toString();
        if (!isInitialYear && openingBalance?.amount && parseFloat(openingBalance.amount) !== 0) {
            return res.status(400).json({
                success: false,
                error: 'Opening balance can only be set in the initial fiscal year'
            });
        }

        // Prepare opening balance data
        const openingBalanceAmount = isInitialYear && openingBalance?.amount
            ? parseFloat(openingBalance.amount)
            : 0;
        const openingBalanceType = isInitialYear && openingBalance?.type
            ? openingBalance.type
            : 'Dr';

        // Update the account
        const updatedAccount = await Account.findByIdAndUpdate(
            id,
            {
                name,
                address,
                ward,
                phone,
                pan,
                contactperson,
                email,
                companyGroups,
                creditLimit,
                initialOpeningBalance: {
                    date: currentFiscalYear.startDate,
                    amount: openingBalanceAmount,
                    type: openingBalanceType,
                    initialFiscalYear: currentFiscalYear._id
                },
                openingBalance: {
                    amount: openingBalanceAmount,
                    type: openingBalanceType,
                    fiscalYear: currentFiscalYear._id
                },
                openingBalanceByFiscalYear: [{
                    amount: openingBalanceAmount,
                    type: openingBalanceType,
                    date: currentFiscalYear.startDate,
                    fiscalYear: currentFiscalYear._id
                }],
                company: companyId,
                fiscalYear: [currentFiscalYear._id]
            },
            { new: true, runValidators: true }
        );

        if (!updatedAccount) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        res.json({
            success: true,
            message: 'Account updated successfully',
            data: {
                account: updatedAccount.toObject()
            }
        });

    } catch (err) {
        console.error('Error updating account:', err);

        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'An account with this name already exists within the selected company'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error while updating account',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

router.delete('/companies/:id', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    try {
        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }

        const { id } = req.params;
        const companyId = req.session.currentCompany;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid company ID'
            });
        }

        // Check if account exists and belongs to the company
        const account = await Account.findOne({ _id: id, company: companyId });
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found or does not belong to your company'
            });
        }

        // Check if it's a default cash account
        if (account.defaultCashAccount) {
            return res.status(403).json({
                success: false,
                error: 'Cannot delete default cash account'
            });
        }

        // Check for associated transactions
        const transactions = await Transaction.find({ account: id });
        if (transactions.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete account with associated transactions'
            });
        }

        // Delete the account
        const deletedAccount = await Account.findByIdAndDelete(id);
        if (!deletedAccount) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }

        res.json({
            success: true,
            message: 'Account deleted successfully',
            data: {
                id: deletedAccount._id,
                name: deletedAccount.name
            }
        });

    } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to delete account',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// GET route for accounts import page
router.get('/accounts-import', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;

            if (!companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'COMPANY_NOT_SELECTED',
                    message: 'Company ID not found in session.',
                    code: 'SESSION_COMPANY_MISSING'
                });
            }

            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat name').populate('fiscalYear');
            const currentCompanyName = req.session.currentCompanyName;
            const currentCompany = await Company.findById(new ObjectId(companyId));

            // Get available company groups
            const companyGroups = await CompanyGroup.find({ company: companyId }).select('name _id');

            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            if (!currentFiscalYear && company.fiscalYear) {
                currentFiscalYear = company.fiscalYear;
                fiscalYear = currentFiscalYear._id.toString();

                // Update session
                req.session.currentFiscalYear = {
                    id: currentFiscalYear._id.toString(),
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                };
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'FISCAL_YEAR_MISSING',
                    message: 'No fiscal year found in session or company.',
                    code: 'FISCAL_YEAR_REQUIRED'
                });
            }

            // Return JSON response for React component
            return res.json({
                success: true,
                data: {
                    company: {
                        id: company._id,
                        name: company.name,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear ? {
                            id: company.fiscalYear._id,
                            name: company.fiscalYear.name,
                            startDate: company.fiscalYear.startDate,
                            endDate: company.fiscalYear.endDate,
                            isActive: company.fiscalYear.isActive
                        } : null
                    },
                    currentCompany: {
                        id: currentCompany._id,
                        name: currentCompany.name,
                        renewalDate: currentCompany.renewalDate,
                        dateFormat: currentCompany.dateFormat
                    },
                    currentCompanyName: currentCompanyName,
                    currentFiscalYear: currentFiscalYear ? {
                        id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    } : null,
                    fiscalYear: fiscalYear,
                    companyGroups: companyGroups.map(group => ({
                        id: group._id,
                        name: group.name
                    })),
                    user: {
                        preferences: {
                            theme: req.user.preferences?.theme || 'light'
                        },
                        isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor',
                        role: req.user.role,
                        isAdmin: req.user.isAdmin
                    }
                },
                metadata: {
                    title: 'Import Accounts',
                    timestamp: new Date().toISOString(),
                    tradeType: req.tradeType
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'ACCESS_DENIED',
                message: 'Access denied for this trade type.',
                code: 'INVALID_TRADE_TYPE'
            });
        }
    } catch (error) {
        console.error('Error in accounts import route:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Failed to load import page data.',
            code: 'LOAD_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST route for importing accounts
// router.post('/accounts-import', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, ensureTradeType, upload.single('excelFile'), async (req, res) => {
//     // Add start time for performance tracking
//     req.startTime = Date.now();

//     try {
//         if (req.tradeType !== 'retailer') {
//             return res.status(403).json({
//                 success: false,
//                 error: 'ACCESS_DENIED',
//                 message: 'This feature is only available for retailers.',
//                 code: 'INVALID_TRADE_TYPE'
//             });
//         }

//         if (!req.file) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'NO_FILE_UPLOADED',
//                 message: 'No file uploaded.',
//                 code: 'FILE_MISSING'
//             });
//         }

//         const companyId = req.session.currentCompany;
//         const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat name').populate('fiscalYear');
//         const fiscalYearId = req.session.currentFiscalYear.id;

//         // Validate file type
//         const extname = path.extname(req.file.originalname).toLowerCase();
//         if (extname !== '.xlsx') {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'INVALID_FILE_TYPE',
//                 message: 'Only .xlsx files are allowed.',
//                 code: 'FILE_TYPE_INVALID'
//             });
//         }

//         // Validate file size (5MB max)
//         if (req.file.size > 5 * 1024 * 1024) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'FILE_TOO_LARGE',
//                 message: 'File size exceeds 5MB limit.',
//                 code: 'FILE_SIZE_EXCEEDED'
//             });
//         }

//         // Process the Excel file
//         const workbook = new exceljs.Workbook();
//         await workbook.xlsx.readFile(req.file.path);
//         const worksheet = workbook.worksheets[0];

//         // Validate worksheet headers
//         const expectedHeaders = ['Name', 'Company Group', 'Address', 'Ward', 'Phone', 'PAN', 'Contact Person', 'Email', 'Opening Balance', 'Balance Type'];
//         const actualHeaders = [];
//         worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
//             actualHeaders.push(cell.value?.toString().trim());
//         });

//         // Check if all required headers are present
//         const requiredHeaders = ['Name', 'Company Group'];
//         const missingHeaders = requiredHeaders.filter(header => !actualHeaders.includes(header));
//         if (missingHeaders.length > 0) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'INVALID_EXCEL_FORMAT',
//                 message: `Invalid Excel format. Missing required headers: ${missingHeaders.join(', ')}`,
//                 code: 'MISSING_REQUIRED_HEADERS',
//                 data: {
//                     missingHeaders,
//                     expectedHeaders,
//                     actualHeaders
//                 }
//             });
//         }

//         // Get all company groups for validation
//         const companyGroups = await CompanyGroup.find({ company: companyId });
//         const groupNameToIdMap = new Map();
//         companyGroups.forEach(group => {
//             groupNameToIdMap.set(group.name.toLowerCase(), {
//                 id: group._id,
//                 name: group.name
//             });
//         });

//         // Process each row
//         const accounts = [];
//         const errors = [];
//         const fiscalYear = await FiscalYear.findById(fiscalYearId);

//         if (!fiscalYear) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'FISCAL_YEAR_NOT_FOUND',
//                 message: 'Fiscal year not found.',
//                 code: 'FISCAL_YEAR_INVALID'
//             });
//         }

//         // Generate a unique number for each account
//         const lastAccount = await mongoose.model('Account').findOne({ company: companyId })
//             .sort({ uniqueNumber: -1 })
//             .select('uniqueNumber');

//         let nextUniqueNumber = (lastAccount?.uniqueNumber || 0) + 1;

//         // Track processed rows
//         let totalRows = 0;
//         let skippedRows = 0;
//         let processedRows = 0;

//         // Start from row 2 (skip header)
//         for (let i = 2; i <= worksheet.rowCount; i++) {
//             const row = worksheet.getRow(i);
//             totalRows++;

//             // Skip empty rows
//             if (!row.getCell(1).value) {
//                 skippedRows++;
//                 continue;
//             }

//             processedRows++;

//             try {
//                 const rowData = {};
//                 actualHeaders.forEach((header, index) => {
//                     const cellValue = row.getCell(index + 1).value;
//                     rowData[header.toLowerCase().replace(' ', '')] = cellValue ? cellValue.toString().trim() : '';
//                 });

//                 // Validate required fields
//                 if (!rowData.name || rowData.name.trim() === '') {
//                     throw new Error('Account name is required');
//                 }

//                 if (!rowData.companygroup || rowData.companygroup.trim() === '') {
//                     throw new Error('Company Group is required');
//                 }

//                 // Get company group ID
//                 const groupInfo = groupNameToIdMap.get(rowData.companygroup.toLowerCase());
//                 if (!groupInfo) {
//                     const availableGroups = Array.from(groupNameToIdMap.values()).map(g => g.name);
//                     throw new Error(`Company Group "${rowData.companygroup}" not found. Available groups: ${availableGroups.join(', ')}`);
//                 }

//                 // Prepare account data with uniqueNumber
//                 const accountData = {
//                     name: rowData.name.trim(),
//                     companyGroups: groupInfo.id,
//                     company: companyId,
//                     fiscalYear: [fiscalYearId],
//                     originalFiscalYear: fiscalYearId,
//                     isActive: true,
//                     uniqueNumber: nextUniqueNumber++
//                 };

//                 // Add optional fields if they exist
//                 if (rowData.address && rowData.address.trim() !== '') {
//                     accountData.address = rowData.address.trim();
//                 }
//                 if (rowData.ward && rowData.ward.trim() !== '') {
//                     const ward = parseInt(rowData.ward);
//                     if (!isNaN(ward)) {
//                         accountData.ward = ward;
//                     }
//                 }
//                 if (rowData.phone && rowData.phone.trim() !== '') {
//                     accountData.phone = rowData.phone.trim();
//                 }
//                 if (rowData.pan && rowData.pan.trim() !== '') {
//                     const pan = parseInt(rowData.pan);
//                     if (isNaN(pan) || pan.toString().length !== 9) {
//                         throw new Error('PAN must be exactly 9 digits');
//                     }
//                     accountData.pan = pan;
//                 }
//                 if (rowData.contactperson && rowData.contactperson.trim() !== '') {
//                     accountData.contactperson = rowData.contactperson.trim();
//                 }
//                 if (rowData.email && rowData.email.trim() !== '') {
//                     // Basic email validation
//                     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//                     if (!emailRegex.test(rowData.email)) {
//                         throw new Error('Invalid email format');
//                     }
//                     accountData.email = rowData.email.trim();
//                 }

//                 // Handle opening balance if provided
//                 if (rowData.openingbalance && rowData.openingbalance.trim() !== '') {
//                     const amount = parseFloat(rowData.openingbalance);
//                     if (isNaN(amount)) {
//                         throw new Error('Opening Balance must be a valid number');
//                     }

//                     const type = (rowData.balancetype || 'Dr').trim() === 'Cr' ? 'Cr' : 'Dr';

//                     accountData.openingBalance = {
//                         fiscalYear: fiscalYearId,
//                         amount: Math.abs(amount), // Ensure positive amount
//                         type,
//                         date: new Date()
//                     };

//                     accountData.openingBalanceByFiscalYear = [{
//                         fiscalYear: fiscalYearId,
//                         amount: Math.abs(amount),
//                         type,
//                         date: new Date()
//                     }];
//                 }

//                 // Check for duplicate account name in this company and fiscal year
//                 const existingAccount = await mongoose.model('Account').findOne({
//                     name: accountData.name,
//                     company: companyId,
//                     fiscalYear: { $in: [fiscalYearId] }
//                 });

//                 if (existingAccount) {
//                     throw new Error(`Account "${accountData.name}" already exists in this fiscal year`);
//                 }

//                 accounts.push(accountData);
//             } catch (error) {
//                 errors.push({
//                     row: i,
//                     message: error.message,
//                     data: {
//                         name: row.getCell(1).value?.toString().trim() || 'N/A',
//                         companyGroup: row.getCell(2).value?.toString().trim() || 'N/A',
//                         address: row.getCell(3).value?.toString().trim() || '',
//                         phone: row.getCell(5).value?.toString().trim() || '',
//                         email: row.getCell(8).value?.toString().trim() || ''
//                     }
//                 });
//             }
//         }

//         // Determine overall success based on actual results
//         const hasSuccessfulImports = accounts.length > 0;
//         const hasErrors = errors.length > 0;
//         const allFailed = accounts.length === 0 && errors.length > 0;
//         const partialSuccess = accounts.length > 0 && errors.length > 0;
//         const allSkipped = accounts.length === 0 && errors.length === 0 && skippedRows > 0;
//         const noData = totalRows === 0;

//         // Clean up uploaded file
//         try {
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }
//         } catch (cleanupError) {
//             console.error('Error cleaning up uploaded file:', cleanupError);
//         }

//         // If there are errors and no successful imports, return error response
//         if (allFailed) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'IMPORT_FAILED',
//                 message: 'All accounts failed to import. Please check the error details below.',
//                 code: 'ALL_ACCOUNTS_FAILED',
//                 data: {
//                     results: {
//                         total: totalRows,
//                         success: accounts.length,
//                         errors: errors,
//                         processed: processedRows,
//                         skipped: skippedRows,
//                         successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                     },
//                     summary: {
//                         company: company.name,
//                         fiscalYear: fiscalYear.name,
//                         importDate: new Date().toISOString(),
//                         fileName: req.file.originalname,
//                         status: 'failed',
//                         availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                     }
//                 },
//                 metadata: {
//                     timestamp: new Date().toISOString(),
//                     processedIn: `${Date.now() - req.startTime}ms`
//                 }
//             });
//         }

//         // If no valid accounts found
//         if (noData || allSkipped) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'NO_VALID_DATA',
//                 message: 'No valid accounts found in the Excel file.',
//                 code: 'EMPTY_DATA',
//                 data: {
//                     results: {
//                         total: totalRows,
//                         success: accounts.length,
//                         errors: errors,
//                         processed: processedRows,
//                         skipped: skippedRows,
//                         successRate: 0
//                     },
//                     summary: {
//                         company: company.name,
//                         fiscalYear: fiscalYear.name,
//                         importDate: new Date().toISOString(),
//                         fileName: req.file.originalname,
//                         status: 'no_data',
//                         availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                     }
//                 },
//                 metadata: {
//                     timestamp: new Date().toISOString(),
//                     processedIn: `${Date.now() - req.startTime}ms`
//                 }
//             });
//         }

//         // Insert all valid accounts in a transaction to ensure atomicity
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const createdAccounts = await mongoose.model('Account').insertMany(accounts, { session });
//             await session.commitTransaction();
//             session.endSession();

//             // Prepare response based on success type
//             if (partialSuccess) {
//                 return res.json({
//                     success: true,
//                     warning: 'PARTIAL_IMPORT',
//                     message: `${accounts.length} accounts imported successfully, ${errors.length} accounts failed.`,
//                     code: 'PARTIAL_SUCCESS',
//                     data: {
//                         results: {
//                             total: totalRows,
//                             success: accounts.length,
//                             errors: errors,
//                             processed: processedRows,
//                             skipped: skippedRows,
//                             successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                         },
//                         summary: {
//                             company: company.name,
//                             fiscalYear: fiscalYear.name,
//                             importDate: new Date().toISOString(),
//                             fileName: req.file.originalname,
//                             status: 'partial',
//                             availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                         },
//                         importedAccounts: createdAccounts.map(acc => ({
//                             id: acc._id,
//                             name: acc.name,
//                             uniqueNumber: acc.uniqueNumber,
//                             companyGroup: Array.from(groupNameToIdMap.values()).find(g => g.id.equals(acc.companyGroups))?.name || 'Unknown',
//                             address: acc.address,
//                             phone: acc.phone,
//                             email: acc.email
//                         }))
//                     },
//                     metadata: {
//                         timestamp: new Date().toISOString(),
//                         processedIn: `${Date.now() - req.startTime}ms`
//                     }
//                 });
//             } else {
//                 // All successful
//                 return res.json({
//                     success: true,
//                     message: `Successfully imported ${accounts.length} accounts`,
//                     code: 'SUCCESS',
//                     data: {
//                         results: {
//                             total: totalRows,
//                             success: accounts.length,
//                             errors: errors,
//                             processed: processedRows,
//                             skipped: skippedRows,
//                             successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                         },
//                         summary: {
//                             company: company.name,
//                             fiscalYear: fiscalYear.name,
//                             importDate: new Date().toISOString(),
//                             fileName: req.file.originalname,
//                             status: 'success',
//                             availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                         },
//                         importedAccounts: createdAccounts.map(acc => ({
//                             id: acc._id,
//                             name: acc.name,
//                             uniqueNumber: acc.uniqueNumber,
//                             companyGroup: Array.from(groupNameToIdMap.values()).find(g => g.id.equals(acc.companyGroups))?.name || 'Unknown',
//                             address: acc.address,
//                             phone: acc.phone,
//                             email: acc.email
//                         }))
//                     },
//                     metadata: {
//                         timestamp: new Date().toISOString(),
//                         processedIn: `${Date.now() - req.startTime}ms`
//                     }
//                 });
//             }
//         } catch (insertError) {
//             await session.abortTransaction();
//             session.endSession();
//             throw insertError;
//         }

//     } catch (error) {
//         console.error('Error importing accounts:', error);

//         // Clean up uploaded file on error
//         try {
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }
//         } catch (cleanupError) {
//             console.error('Error cleaning up uploaded file on error:', cleanupError);
//         }

//         return res.status(500).json({
//             success: false,
//             error: 'IMPORT_FAILED',
//             message: 'An error occurred while importing accounts',
//             code: 'PROCESSING_ERROR',
//             details: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// });


// // POST route for importing accounts - CORRECTED VERSION
// router.post('/accounts-import', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, ensureTradeType, upload.single('excelFile'), async (req, res) => {
//     // Add start time for performance tracking
//     req.startTime = Date.now();

//     try {
//         console.log('=== ACCOUNTS IMPORT PROCESS STARTED ===');

//         if (req.tradeType !== 'retailer') {
//             return res.status(403).json({
//                 success: false,
//                 error: 'ACCESS_DENIED',
//                 message: 'This feature is only available for retailers.',
//                 code: 'INVALID_TRADE_TYPE'
//             });
//         }

//         if (!req.file) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'NO_FILE_UPLOADED',
//                 message: 'No file uploaded.',
//                 code: 'FILE_MISSING'
//             });
//         }

//         const companyId = req.session.currentCompany;
//         const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat name').populate('fiscalYear');
//         const fiscalYearId = req.session.currentFiscalYear.id;

//         console.log('Processing import for company:', company?.name, 'Fiscal Year:', fiscalYearId);

//         // Validate file type
//         const extname = path.extname(req.file.originalname).toLowerCase();
//         if (extname !== '.xlsx') {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'INVALID_FILE_TYPE',
//                 message: 'Only .xlsx files are allowed.',
//                 code: 'FILE_TYPE_INVALID'
//             });
//         }

//         // Validate file size (5MB max)
//         if (req.file.size > 5 * 1024 * 1024) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'FILE_TOO_LARGE',
//                 message: 'File size exceeds 5MB limit.',
//                 code: 'FILE_SIZE_EXCEEDED'
//             });
//         }

//         // Process the Excel file
//         const workbook = new exceljs.Workbook();
//         await workbook.xlsx.readFile(req.file.path);
//         const worksheet = workbook.worksheets[0];

//         console.log('Excel file loaded successfully. Total rows:', worksheet.rowCount);

//         // Validate worksheet headers
//         const expectedHeaders = ['Name', 'Company Group', 'Address', 'Ward', 'Phone', 'PAN', 'Contact Person', 'Email', 'Opening Balance', 'Balance Type'];
//         const actualHeaders = [];
//         worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
//             actualHeaders.push(cell.value?.toString().trim());
//         });

//         console.log('Found headers:', actualHeaders);

//         // Check if all required headers are present
//         const requiredHeaders = ['Name', 'Company Group'];
//         const missingHeaders = requiredHeaders.filter(header => !actualHeaders.includes(header));
//         if (missingHeaders.length > 0) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'INVALID_EXCEL_FORMAT',
//                 message: `Invalid Excel format. Missing required headers: ${missingHeaders.join(', ')}`,
//                 code: 'MISSING_REQUIRED_HEADERS',
//                 data: {
//                     missingHeaders,
//                     expectedHeaders,
//                     actualHeaders
//                 }
//             });
//         }

//         // Get all company groups for validation
//         const companyGroups = await CompanyGroup.find({ company: companyId });
//         const groupNameToIdMap = new Map();
//         companyGroups.forEach(group => {
//             groupNameToIdMap.set(group.name.toLowerCase(), {
//                 id: group._id,
//                 name: group.name
//             });
//         });

//         console.log('Available company groups:', Array.from(groupNameToIdMap.values()).map(g => g.name));

//         // Process each row
//         const accounts = [];
//         const errors = [];
//         const fiscalYear = await FiscalYear.findById(fiscalYearId);

//         if (!fiscalYear) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'FISCAL_YEAR_NOT_FOUND',
//                 message: 'Fiscal year not found.',
//                 code: 'FISCAL_YEAR_INVALID'
//             });
//         }

//         // Generate a unique number for each account
//         const lastAccount = await mongoose.model('Account').findOne({ company: companyId })
//             .sort({ uniqueNumber: -1 })
//             .select('uniqueNumber');

//         let nextUniqueNumber = (lastAccount?.uniqueNumber || 0) + 1;

//         console.log('Starting unique number:', nextUniqueNumber);

//         // Track processed rows
//         let totalRows = 0;
//         let skippedRows = 0;
//         let processedRows = 0;

//         // Start from row 2 (skip header)
//         for (let i = 2; i <= worksheet.rowCount; i++) {
//             const row = worksheet.getRow(i);
//             totalRows++;

//             // Skip empty rows
//             if (!row.getCell(1).value) {
//                 skippedRows++;
//                 continue;
//             }

//             processedRows++;

//             try {
//                 const rowData = {};

//                 // CORRECTED: Proper cell value extraction with better error handling
//                 actualHeaders.forEach((header, index) => {
//                     const cell = row.getCell(index + 1);
//                     let cellValue = '';

//                     // Use cell.text for display value or fallback to cell.value
//                     if (cell.text && cell.text.toString().trim() !== '') {
//                         cellValue = cell.text.toString().trim();
//                     } else if (cell.value) {
//                         // Handle different value types
//                         if (typeof cell.value === 'object') {
//                             if (cell.value.text) {
//                                 cellValue = cell.value.text.toString().trim();
//                             } else if (cell.value.result) {
//                                 cellValue = cell.value.result.toString().trim();
//                             } else if (cell.value.hyperlink) {
//                                 cellValue = cell.value.toString().trim();
//                             } else {
//                                 // Fallback: stringify and clean
//                                 cellValue = JSON.stringify(cell.value).replace(/[{}"']/g, '').trim();
//                             }
//                         } else {
//                             cellValue = cell.value.toString().trim();
//                         }
//                     }

//                     const cleanHeader = header.toLowerCase().replace(/\s+/g, '');
//                     rowData[cleanHeader] = cellValue;
//                 });

//                 // Debug logging for email values
//                 if (rowData.email) {
//                     console.log(`Row ${i} - Email extracted: "${rowData.email}"`);
//                 }

//                 // Validate required fields
//                 if (!rowData.name || rowData.name.trim() === '') {
//                     throw new Error('Account name is required');
//                 }

//                 if (!rowData.companygroup || rowData.companygroup.trim() === '') {
//                     throw new Error('Company Group is required');
//                 }

//                 // Get company group ID
//                 const groupInfo = groupNameToIdMap.get(rowData.companygroup.toLowerCase());
//                 if (!groupInfo) {
//                     const availableGroups = Array.from(groupNameToIdMap.values()).map(g => g.name);
//                     throw new Error(`Company Group "${rowData.companygroup}" not found. Available groups: ${availableGroups.join(', ')}`);
//                 }

//                 // Prepare account data with uniqueNumber
//                 const accountData = {
//                     name: rowData.name.trim(),
//                     companyGroups: groupInfo.id,
//                     company: companyId,
//                     fiscalYear: [fiscalYearId],
//                     originalFiscalYear: fiscalYearId,
//                     isActive: true,
//                     uniqueNumber: nextUniqueNumber++
//                 };

//                 // Add optional fields if they exist
//                 if (rowData.address && rowData.address.trim() !== '') {
//                     accountData.address = rowData.address.trim();
//                 }

//                 if (rowData.ward && rowData.ward.trim() !== '') {
//                     const ward = parseInt(rowData.ward);
//                     if (!isNaN(ward)) {
//                         accountData.ward = ward;
//                     }
//                 }

//                 if (rowData.phone && rowData.phone.trim() !== '') {
//                     accountData.phone = rowData.phone.trim();
//                 }

//                 if (rowData.pan && rowData.pan.trim() !== '') {
//                     const pan = parseInt(rowData.pan);
//                     if (isNaN(pan) || pan.toString().length !== 9) {
//                         throw new Error('PAN must be exactly 9 digits');
//                     }
//                     accountData.pan = pan;
//                 }

//                 if (rowData.contactperson && rowData.contactperson.trim() !== '') {
//                     accountData.contactperson = rowData.contactperson.trim();
//                 }

//                 // CORRECTED: Email handling with proper validation
//                 if (rowData.email && rowData.email.trim() !== '') {
//                     let emailValue = rowData.email.trim();

//                     // Final cleanup of email value
//                     if (emailValue === '[object Object]') {
//                         throw new Error('Email cell contains invalid data. Please ensure it contains a valid email address.');
//                     }

//                     // Basic email validation
//                     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//                     if (!emailRegex.test(emailValue)) {
//                         throw new Error(`Invalid email format: "${emailValue}"`);
//                     }
//                     accountData.email = emailValue;
//                 }

//                 // Handle opening balance if provided
//                 if (rowData.openingbalance && rowData.openingbalance.trim() !== '') {
//                     const amount = parseFloat(rowData.openingbalance);
//                     if (isNaN(amount)) {
//                         throw new Error('Opening Balance must be a valid number');
//                     }

//                     const type = (rowData.balancetype || 'Dr').trim() === 'Cr' ? 'Cr' : 'Dr';

//                     accountData.openingBalance = {
//                         fiscalYear: fiscalYearId,
//                         amount: Math.abs(amount),
//                         type,
//                         date: new Date()
//                     };

//                     accountData.openingBalanceByFiscalYear = [{
//                         fiscalYear: fiscalYearId,
//                         amount: Math.abs(amount),
//                         type,
//                         date: new Date()
//                     }];
//                 }

//                 // Check for duplicate account name in this company and fiscal year
//                 const existingAccount = await mongoose.model('Account').findOne({
//                     name: accountData.name,
//                     company: companyId,
//                     fiscalYear: { $in: [fiscalYearId] }
//                 });

//                 if (existingAccount) {
//                     throw new Error(`Account "${accountData.name}" already exists in this fiscal year`);
//                 }

//                 accounts.push(accountData);
//                 console.log(`✓ Row ${i} - Account prepared: ${accountData.name}`);

//             } catch (error) {
//                 console.log(`✗ Row ${i} - Error: ${error.message}`);

//                 // Helper function to safely extract cell values for error reporting
//                 const getSafeCellValue = (cellIndex) => {
//                     try {
//                         const cell = row.getCell(cellIndex);
//                         return cell.text ? cell.text.toString().trim() : 
//                                cell.value ? cell.value.toString().trim() : 'N/A';
//                     } catch (e) {
//                         return 'N/A';
//                     }
//                 };

//                 errors.push({
//                     row: i,
//                     message: error.message,
//                     data: {
//                         name: getSafeCellValue(1),
//                         companyGroup: getSafeCellValue(2),
//                         address: getSafeCellValue(3),
//                         phone: getSafeCellValue(5),
//                         email: getSafeCellValue(8)
//                     }
//                 });
//             }
//         }

//         console.log('Processing completed:');
//         console.log('- Total rows:', totalRows);
//         console.log('- Processed rows:', processedRows);
//         console.log('- Skipped rows:', skippedRows);
//         console.log('- Valid accounts:', accounts.length);
//         console.log('- Errors:', errors.length);

//         // Determine overall success based on actual results
//         const hasSuccessfulImports = accounts.length > 0;
//         const hasErrors = errors.length > 0;
//         const allFailed = accounts.length === 0 && errors.length > 0;
//         const partialSuccess = accounts.length > 0 && errors.length > 0;
//         const allSkipped = accounts.length === 0 && errors.length === 0 && skippedRows > 0;
//         const noData = totalRows === 0;

//         // Clean up uploaded file
//         try {
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//                 console.log('Uploaded file cleaned up');
//             }
//         } catch (cleanupError) {
//             console.error('Error cleaning up uploaded file:', cleanupError);
//         }

//         // If there are errors and no successful imports, return error response
//         if (allFailed) {
//             console.log('All accounts failed to import');
//             return res.status(400).json({
//                 success: false,
//                 error: 'IMPORT_FAILED',
//                 message: 'All accounts failed to import. Please check the error details below.',
//                 code: 'ALL_ACCOUNTS_FAILED',
//                 data: {
//                     results: {
//                         total: totalRows,
//                         success: accounts.length,
//                         errors: errors,
//                         processed: processedRows,
//                         skipped: skippedRows,
//                         successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                     },
//                     summary: {
//                         company: company.name,
//                         fiscalYear: fiscalYear.name,
//                         importDate: new Date().toISOString(),
//                         fileName: req.file.originalname,
//                         status: 'failed',
//                         availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                     }
//                 },
//                 metadata: {
//                     timestamp: new Date().toISOString(),
//                     processedIn: `${Date.now() - req.startTime}ms`
//                 }
//             });
//         }

//         // If no valid accounts found
//         if (noData || allSkipped) {
//             console.log('No valid data found');
//             return res.status(400).json({
//                 success: false,
//                 error: 'NO_VALID_DATA',
//                 message: 'No valid accounts found in the Excel file.',
//                 code: 'EMPTY_DATA',
//                 data: {
//                     results: {
//                         total: totalRows,
//                         success: accounts.length,
//                         errors: errors,
//                         processed: processedRows,
//                         skipped: skippedRows,
//                         successRate: 0
//                     },
//                     summary: {
//                         company: company.name,
//                         fiscalYear: fiscalYear.name,
//                         importDate: new Date().toISOString(),
//                         fileName: req.file.originalname,
//                         status: 'no_data',
//                         availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                     }
//                 },
//                 metadata: {
//                     timestamp: new Date().toISOString(),
//                     processedIn: `${Date.now() - req.startTime}ms`
//                 }
//             });
//         }

//         console.log('Starting database insertion...');

//         // Insert all valid accounts in a transaction to ensure atomicity
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const createdAccounts = await mongoose.model('Account').insertMany(accounts, { session });
//             await session.commitTransaction();
//             session.endSession();

//             console.log('Accounts inserted successfully:', createdAccounts.length);

//             // Prepare response based on success type
//             if (partialSuccess) {
//                 console.log('Partial success response');
//                 return res.json({
//                     success: true,
//                     warning: 'PARTIAL_IMPORT',
//                     message: `${accounts.length} accounts imported successfully, ${errors.length} accounts failed.`,
//                     code: 'PARTIAL_SUCCESS',
//                     data: {
//                         results: {
//                             total: totalRows,
//                             success: accounts.length,
//                             errors: errors,
//                             processed: processedRows,
//                             skipped: skippedRows,
//                             successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                         },
//                         summary: {
//                             company: company.name,
//                             fiscalYear: fiscalYear.name,
//                             importDate: new Date().toISOString(),
//                             fileName: req.file.originalname,
//                             status: 'partial',
//                             availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                         },
//                         importedAccounts: createdAccounts.map(acc => ({
//                             id: acc._id,
//                             name: acc.name,
//                             uniqueNumber: acc.uniqueNumber,
//                             companyGroup: Array.from(groupNameToIdMap.values()).find(g => g.id.equals(acc.companyGroups))?.name || 'Unknown',
//                             address: acc.address,
//                             phone: acc.phone,
//                             email: acc.email
//                         }))
//                     },
//                     metadata: {
//                         timestamp: new Date().toISOString(),
//                         processedIn: `${Date.now() - req.startTime}ms`
//                     }
//                 });
//             } else {
//                 // All successful
//                 console.log('Full success response');
//                 return res.json({
//                     success: true,
//                     message: `Successfully imported ${accounts.length} accounts`,
//                     code: 'SUCCESS',
//                     data: {
//                         results: {
//                             total: totalRows,
//                             success: accounts.length,
//                             errors: errors,
//                             processed: processedRows,
//                             skipped: skippedRows,
//                             successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                         },
//                         summary: {
//                             company: company.name,
//                             fiscalYear: fiscalYear.name,
//                             importDate: new Date().toISOString(),
//                             fileName: req.file.originalname,
//                             status: 'success',
//                             availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name)
//                         },
//                         importedAccounts: createdAccounts.map(acc => ({
//                             id: acc._id,
//                             name: acc.name,
//                             uniqueNumber: acc.uniqueNumber,
//                             companyGroup: Array.from(groupNameToIdMap.values()).find(g => g.id.equals(acc.companyGroups))?.name || 'Unknown',
//                             address: acc.address,
//                             phone: acc.phone,
//                             email: acc.email
//                         }))
//                     },
//                     metadata: {
//                         timestamp: new Date().toISOString(),
//                         processedIn: `${Date.now() - req.startTime}ms`
//                     }
//                 });
//             }
//         } catch (insertError) {
//             await session.abortTransaction();
//             session.endSession();
//             console.error('Database insertion error:', insertError);
//             throw insertError;
//         }

//     } catch (error) {
//         console.error('=== ACCOUNTS IMPORT ERROR ===');
//         console.error('Error message:', error.message);
//         console.error('Error stack:', error.stack);
//         console.error('=== END ERROR ===');

//         // Clean up uploaded file on error
//         try {
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//                 console.log('File cleaned up after error');
//             }
//         } catch (cleanupError) {
//             console.error('Error cleaning up uploaded file on error:', cleanupError);
//         }

//         return res.status(500).json({
//             success: false,
//             error: 'IMPORT_FAILED',
//             message: 'An error occurred while importing accounts',
//             code: 'PROCESSING_ERROR',
//             details: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// });

// router.post('/accounts-import', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, ensureTradeType, upload.single('excelFile'), async (req, res) => {
//     // Add start time for performance tracking
//     req.startTime = Date.now();

//     try {
//         console.log('=== ACCOUNTS IMPORT PROCESS STARTED ===');

//         if (req.tradeType !== 'retailer') {
//             return res.status(403).json({
//                 success: false,
//                 error: 'ACCESS_DENIED',
//                 message: 'This feature is only available for retailers.',
//                 code: 'INVALID_TRADE_TYPE'
//             });
//         }

//         if (!req.file) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'NO_FILE_UPLOADED',
//                 message: 'No file uploaded.',
//                 code: 'FILE_MISSING'
//             });
//         }

//         const companyId = req.session.currentCompany;
//         const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat name').populate('fiscalYear');
//         const fiscalYearId = req.session.currentFiscalYear.id;

//         console.log('Processing import for company:', company?.name, 'Fiscal Year:', fiscalYearId);

//         // Validate file type
//         const extname = path.extname(req.file.originalname).toLowerCase();
//         if (extname !== '.xlsx') {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'INVALID_FILE_TYPE',
//                 message: 'Only .xlsx files are allowed.',
//                 code: 'FILE_TYPE_INVALID'
//             });
//         }

//         // Validate file size (5MB max)
//         if (req.file.size > 5 * 1024 * 1024) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'FILE_TOO_LARGE',
//                 message: 'File size exceeds 5MB limit.',
//                 code: 'FILE_SIZE_EXCEEDED'
//             });
//         }

//         // Process the Excel file
//         const workbook = new exceljs.Workbook();
//         await workbook.xlsx.readFile(req.file.path);
//         const worksheet = workbook.worksheets[0];

//         console.log('Excel file loaded successfully. Total rows:', worksheet.rowCount);

//         // Validate worksheet headers
//         const expectedHeaders = ['Name', 'Company Group', 'Address', 'Ward', 'Phone', 'PAN', 'Contact Person', 'Email', 'Opening Balance', 'Balance Type'];
//         const actualHeaders = [];
//         worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
//             actualHeaders.push(cell.value?.toString().trim());
//         });

//         console.log('Found headers:', actualHeaders);

//         // Check if all required headers are present
//         const requiredHeaders = ['Name', 'Company Group'];
//         const missingHeaders = requiredHeaders.filter(header => !actualHeaders.includes(header));
//         if (missingHeaders.length > 0) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'INVALID_EXCEL_FORMAT',
//                 message: `Invalid Excel format. Missing required headers: ${missingHeaders.join(', ')}`,
//                 code: 'MISSING_REQUIRED_HEADERS',
//                 data: {
//                     missingHeaders,
//                     expectedHeaders,
//                     actualHeaders
//                 }
//             });
//         }

//         // Get all company groups for validation
//         const companyGroups = await CompanyGroup.find({ company: companyId });
//         const groupNameToIdMap = new Map();
//         companyGroups.forEach(group => {
//             groupNameToIdMap.set(group.name.toLowerCase(), {
//                 id: group._id,
//                 name: group.name
//             });
//         });

//         console.log('Available company groups:', Array.from(groupNameToIdMap.values()).map(g => g.name));

//         // Process each row
//         const accounts = [];
//         const errors = [];
//         const fiscalYear = await FiscalYear.findById(fiscalYearId);

//         if (!fiscalYear) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'FISCAL_YEAR_NOT_FOUND',
//                 message: 'Fiscal year not found.',
//                 code: 'FISCAL_YEAR_INVALID'
//             });
//         }

//         // Get the initial fiscal year for opening balance validation
//         const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
//             .sort({ startDate: 1 })
//             .limit(1);

//         if (!initialFiscalYear) {
//             // Clean up file
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//             }

//             return res.status(400).json({
//                 success: false,
//                 error: 'INITIAL_FISCAL_YEAR_NOT_FOUND',
//                 message: 'Initial fiscal year not found.',
//                 code: 'INITIAL_FISCAL_YEAR_MISSING'
//             });
//         }

//         const isInitialYear = fiscalYear._id.toString() === initialFiscalYear._id.toString();
//         console.log('Is initial fiscal year:', isInitialYear);

//         // Generate a unique number for each account
//         const lastAccount = await mongoose.model('Account').findOne({ company: companyId })
//             .sort({ uniqueNumber: -1 })
//             .select('uniqueNumber');

//         let nextUniqueNumber = (lastAccount?.uniqueNumber || 0) + 1;

//         console.log('Starting unique number:', nextUniqueNumber);

//         // Track processed rows
//         let totalRows = 0;
//         let skippedRows = 0;
//         let processedRows = 0;

//         // Start from row 2 (skip header)
//         for (let i = 2; i <= worksheet.rowCount; i++) {
//             const row = worksheet.getRow(i);
//             totalRows++;

//             // Skip empty rows
//             if (!row.getCell(1).value) {
//                 skippedRows++;
//                 continue;
//             }

//             processedRows++;

//             try {
//                 const rowData = {};

//                 // CORRECTED: Proper cell value extraction with better error handling
//                 actualHeaders.forEach((header, index) => {
//                     const cell = row.getCell(index + 1);
//                     let cellValue = '';

//                     // Use cell.text for display value or fallback to cell.value
//                     if (cell.text && cell.text.toString().trim() !== '') {
//                         cellValue = cell.text.toString().trim();
//                     } else if (cell.value) {
//                         // Handle different value types
//                         if (typeof cell.value === 'object') {
//                             if (cell.value.text) {
//                                 cellValue = cell.value.text.toString().trim();
//                             } else if (cell.value.result) {
//                                 cellValue = cell.value.result.toString().trim();
//                             } else if (cell.value.hyperlink) {
//                                 cellValue = cell.value.toString().trim();
//                             } else {
//                                 // Fallback: stringify and clean
//                                 cellValue = JSON.stringify(cell.value).replace(/[{}"']/g, '').trim();
//                             }
//                         } else {
//                             cellValue = cell.value.toString().trim();
//                         }
//                     }

//                     const cleanHeader = header.toLowerCase().replace(/\s+/g, '');
//                     rowData[cleanHeader] = cellValue;
//                 });

//                 // Debug logging for email values
//                 if (rowData.email) {
//                     console.log(`Row ${i} - Email extracted: "${rowData.email}"`);
//                 }

//                 // Validate required fields
//                 if (!rowData.name || rowData.name.trim() === '') {
//                     throw new Error('Account name is required');
//                 }

//                 if (!rowData.companygroup || rowData.companygroup.trim() === '') {
//                     throw new Error('Company Group is required');
//                 }

//                 // Get company group ID
//                 const groupInfo = groupNameToIdMap.get(rowData.companygroup.toLowerCase());
//                 if (!groupInfo) {
//                     const availableGroups = Array.from(groupNameToIdMap.values()).map(g => g.name);
//                     throw new Error(`Company Group "${rowData.companygroup}" not found. Available groups: ${availableGroups.join(', ')}`);
//                 }

//                 // Prepare account data with uniqueNumber
//                 const accountData = {
//                     name: rowData.name.trim(),
//                     companyGroups: groupInfo.id,
//                     company: companyId,
//                     fiscalYear: [fiscalYearId],
//                     originalFiscalYear: fiscalYearId,
//                     isActive: true,
//                     uniqueNumber: nextUniqueNumber++,
//                     createdAt: new Date()
//                 };

//                 // Add optional fields if they exist
//                 if (rowData.address && rowData.address.trim() !== '') {
//                     accountData.address = rowData.address.trim();
//                 }

//                 if (rowData.ward && rowData.ward.trim() !== '') {
//                     const ward = parseInt(rowData.ward);
//                     if (!isNaN(ward)) {
//                         accountData.ward = ward;
//                     }
//                 }

//                 if (rowData.phone && rowData.phone.trim() !== '') {
//                     accountData.phone = rowData.phone.trim();
//                 }

//                 if (rowData.pan && rowData.pan.trim() !== '') {
//                     const pan = parseInt(rowData.pan);
//                     if (isNaN(pan) || pan.toString().length !== 9) {
//                         throw new Error('PAN must be exactly 9 digits');
//                     }
//                     accountData.pan = pan;
//                 }

//                 if (rowData.contactperson && rowData.contactperson.trim() !== '') {
//                     accountData.contactperson = rowData.contactperson.trim();
//                 }

//                 // CORRECTED: Email handling with proper validation
//                 if (rowData.email && rowData.email.trim() !== '') {
//                     let emailValue = rowData.email.trim();

//                     // Final cleanup of email value
//                     if (emailValue === '[object Object]') {
//                         throw new Error('Email cell contains invalid data. Please ensure it contains a valid email address.');
//                     }

//                     // Basic email validation
//                     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//                     if (!emailRegex.test(emailValue)) {
//                         throw new Error(`Invalid email format: "${emailValue}"`);
//                     }
//                     accountData.email = emailValue;
//                 }

//                 // CORRECTED: Handle opening balance with proper validation (matching your company creation logic)
//                 if (rowData.openingbalance && rowData.openingbalance.trim() !== '') {
//                     const amount = parseFloat(rowData.openingbalance);

//                     // Validate opening balance amount
//                     if (isNaN(amount)) {
//                         throw new Error('Opening Balance must be a valid number');
//                     }

//                     // Check if opening balance is only allowed in initial fiscal year
//                     if (!isInitialYear && amount !== 0) {
//                         throw new Error('Opening balance can only be set in the initial fiscal year');
//                     }

//                     const type = (rowData.balancetype || 'Dr').trim() === 'Cr' ? 'Cr' : 'Dr';

//                     // Set all opening balance fields as per your company creation logic
//                     const openingBalanceAmount = isInitialYear ? Math.abs(amount) : 0;
//                     const openingBalanceType = isInitialYear ? type : 'Dr';

//                     // Set initial opening balance (only for initial fiscal year)
//                     if (isInitialYear) {
//                         accountData.initialOpeningBalance = {
//                             date: fiscalYear.startDate,
//                             amount: openingBalanceAmount,
//                             type: openingBalanceType,
//                             initialFiscalYear: fiscalYearId
//                         };
//                     }

//                     // Set current opening balance
//                     accountData.openingBalance = {
//                         date: fiscalYear.startDate,
//                         amount: openingBalanceAmount,
//                         type: openingBalanceType,
//                         fiscalYear: fiscalYearId
//                     };

//                     // Set opening balance by fiscal year array
//                     accountData.openingBalanceByFiscalYear = [{
//                         amount: openingBalanceAmount,
//                         type: openingBalanceType,
//                         date: fiscalYear.startDate,
//                         fiscalYear: fiscalYearId
//                     }];

//                     // Set opening balance date
//                     accountData.openingBalanceDate = fiscalYear.startDate;

//                     console.log(`Row ${i} - Opening balance set: ${openingBalanceAmount} ${openingBalanceType}`);
//                 } else {
//                     // Set default opening balance values when no opening balance provided
//                     accountData.initialOpeningBalance = {
//                         date: fiscalYear.startDate,
//                         amount: 0,
//                         type: 'Dr',
//                         initialFiscalYear: fiscalYearId
//                     };

//                     accountData.openingBalance = {
//                         date: fiscalYear.startDate,
//                         amount: 0,
//                         type: 'Dr',
//                         fiscalYear: fiscalYearId
//                     };

//                     accountData.openingBalanceByFiscalYear = [{
//                         amount: 0,
//                         type: 'Dr',
//                         date: fiscalYear.startDate,
//                         fiscalYear: fiscalYearId
//                     }];

//                     accountData.openingBalanceDate = fiscalYear.startDate;
//                 }

//                 // Check for duplicate account name in this company and fiscal year
//                 const existingAccount = await mongoose.model('Account').findOne({
//                     name: accountData.name,
//                     company: companyId,
//                     fiscalYear: { $in: [fiscalYearId] }
//                 });

//                 if (existingAccount) {
//                     throw new Error(`Account "${accountData.name}" already exists in this fiscal year`);
//                 }

//                 accounts.push(accountData);
//                 console.log(`✓ Row ${i} - Account prepared: ${accountData.name}`);

//             } catch (error) {
//                 console.log(`✗ Row ${i} - Error: ${error.message}`);

//                 // Helper function to safely extract cell values for error reporting
//                 const getSafeCellValue = (cellIndex) => {
//                     try {
//                         const cell = row.getCell(cellIndex);
//                         return cell.text ? cell.text.toString().trim() :
//                             cell.value ? cell.value.toString().trim() : 'N/A';
//                     } catch (e) {
//                         return 'N/A';
//                     }
//                 };

//                 errors.push({
//                     row: i,
//                     message: error.message,
//                     data: {
//                         name: getSafeCellValue(1),
//                         companyGroup: getSafeCellValue(2),
//                         address: getSafeCellValue(3),
//                         phone: getSafeCellValue(5),
//                         email: getSafeCellValue(8),
//                         openingBalance: getSafeCellValue(9),
//                         balanceType: getSafeCellValue(10)
//                     }
//                 });
//             }
//         }

//         console.log('Processing completed:');
//         console.log('- Total rows:', totalRows);
//         console.log('- Processed rows:', processedRows);
//         console.log('- Skipped rows:', skippedRows);
//         console.log('- Valid accounts:', accounts.length);
//         console.log('- Errors:', errors.length);

//         // Determine overall success based on actual results
//         const hasSuccessfulImports = accounts.length > 0;
//         const hasErrors = errors.length > 0;
//         const allFailed = accounts.length === 0 && errors.length > 0;
//         const partialSuccess = accounts.length > 0 && errors.length > 0;
//         const allSkipped = accounts.length === 0 && errors.length === 0 && skippedRows > 0;
//         const noData = totalRows === 0;

//         // Clean up uploaded file
//         try {
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//                 console.log('Uploaded file cleaned up');
//             }
//         } catch (cleanupError) {
//             console.error('Error cleaning up uploaded file:', cleanupError);
//         }

//         // If there are errors and no successful imports, return error response
//         if (allFailed) {
//             console.log('All accounts failed to import');
//             return res.status(400).json({
//                 success: false,
//                 error: 'IMPORT_FAILED',
//                 message: 'All accounts failed to import. Please check the error details below.',
//                 code: 'ALL_ACCOUNTS_FAILED',
//                 data: {
//                     results: {
//                         total: totalRows,
//                         success: accounts.length,
//                         errors: errors,
//                         processed: processedRows,
//                         skipped: skippedRows,
//                         successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                     },
//                     summary: {
//                         company: company.name,
//                         fiscalYear: fiscalYear.name,
//                         importDate: new Date().toISOString(),
//                         fileName: req.file.originalname,
//                         status: 'failed',
//                         availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name),
//                         isInitialFiscalYear: isInitialYear
//                     }
//                 },
//                 metadata: {
//                     timestamp: new Date().toISOString(),
//                     processedIn: `${Date.now() - req.startTime}ms`
//                 }
//             });
//         }

//         // If no valid accounts found
//         if (noData || allSkipped) {
//             console.log('No valid data found');
//             return res.status(400).json({
//                 success: false,
//                 error: 'NO_VALID_DATA',
//                 message: 'No valid accounts found in the Excel file.',
//                 code: 'EMPTY_DATA',
//                 data: {
//                     results: {
//                         total: totalRows,
//                         success: accounts.length,
//                         errors: errors,
//                         processed: processedRows,
//                         skipped: skippedRows,
//                         successRate: 0
//                     },
//                     summary: {
//                         company: company.name,
//                         fiscalYear: fiscalYear.name,
//                         importDate: new Date().toISOString(),
//                         fileName: req.file.originalname,
//                         status: 'no_data',
//                         availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name),
//                         isInitialFiscalYear: isInitialYear
//                     }
//                 },
//                 metadata: {
//                     timestamp: new Date().toISOString(),
//                     processedIn: `${Date.now() - req.startTime}ms`
//                 }
//             });
//         }

//         console.log('Starting database insertion...');

//         // Insert all valid accounts in a transaction to ensure atomicity
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//             const createdAccounts = await mongoose.model('Account').insertMany(accounts, { session });
//             await session.commitTransaction();
//             session.endSession();

//             console.log('Accounts inserted successfully:', createdAccounts.length);

//             // Prepare response based on success type
//             if (partialSuccess) {
//                 console.log('Partial success response');
//                 return res.json({
//                     success: true,
//                     warning: 'PARTIAL_IMPORT',
//                     message: `${accounts.length} accounts imported successfully, ${errors.length} accounts failed.`,
//                     code: 'PARTIAL_SUCCESS',
//                     data: {
//                         results: {
//                             total: totalRows,
//                             success: accounts.length,
//                             errors: errors,
//                             processed: processedRows,
//                             skipped: skippedRows,
//                             successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                         },
//                         summary: {
//                             company: company.name,
//                             fiscalYear: fiscalYear.name,
//                             importDate: new Date().toISOString(),
//                             fileName: req.file.originalname,
//                             status: 'partial',
//                             availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name),
//                             isInitialFiscalYear: isInitialYear
//                         },
//                         importedAccounts: createdAccounts.map(acc => ({
//                             id: acc._id,
//                             name: acc.name,
//                             uniqueNumber: acc.uniqueNumber,
//                             companyGroup: Array.from(groupNameToIdMap.values()).find(g => g.id.equals(acc.companyGroups))?.name || 'Unknown',
//                             address: acc.address,
//                             phone: acc.phone,
//                             email: acc.email,
//                             openingBalance: acc.openingBalance?.amount || 0,
//                             balanceType: acc.openingBalance?.type || 'Dr'
//                         }))
//                     },
//                     metadata: {
//                         timestamp: new Date().toISOString(),
//                         processedIn: `${Date.now() - req.startTime}ms`
//                     }
//                 });
//             } else {
//                 // All successful
//                 console.log('Full success response');
//                 return res.json({
//                     success: true,
//                     message: `Successfully imported ${accounts.length} accounts`,
//                     code: 'SUCCESS',
//                     data: {
//                         results: {
//                             total: totalRows,
//                             success: accounts.length,
//                             errors: errors,
//                             processed: processedRows,
//                             skipped: skippedRows,
//                             successRate: totalRows > 0 ? ((accounts.length / totalRows) * 100).toFixed(2) : 0
//                         },
//                         summary: {
//                             company: company.name,
//                             fiscalYear: fiscalYear.name,
//                             importDate: new Date().toISOString(),
//                             fileName: req.file.originalname,
//                             status: 'success',
//                             availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name),
//                             isInitialFiscalYear: isInitialYear
//                         },
//                         importedAccounts: createdAccounts.map(acc => ({
//                             id: acc._id,
//                             name: acc.name,
//                             uniqueNumber: acc.uniqueNumber,
//                             companyGroup: Array.from(groupNameToIdMap.values()).find(g => g.id.equals(acc.companyGroups))?.name || 'Unknown',
//                             address: acc.address,
//                             phone: acc.phone,
//                             email: acc.email,
//                             openingBalance: acc.openingBalance?.amount || 0,
//                             balanceType: acc.openingBalance?.type || 'Dr'
//                         }))
//                     },
//                     metadata: {
//                         timestamp: new Date().toISOString(),
//                         processedIn: `${Date.now() - req.startTime}ms`
//                     }
//                 });
//             }
//         } catch (insertError) {
//             await session.abortTransaction();
//             session.endSession();
//             console.error('Database insertion error:', insertError);

//             // Handle duplicate key errors specifically
//             if (insertError.code === 11000) {
//                 return res.status(400).json({
//                     success: false,
//                     error: 'DUPLICATE_ACCOUNTS',
//                     message: 'Some accounts already exist in the system.',
//                     code: 'DUPLICATE_KEY_ERROR',
//                     details: 'Please check for duplicate account names'
//                 });
//             }

//             throw insertError;
//         }

//     } catch (error) {
//         console.error('=== ACCOUNTS IMPORT ERROR ===');
//         console.error('Error message:', error.message);
//         console.error('Error stack:', error.stack);
//         console.error('=== END ERROR ===');

//         // Clean up uploaded file on error
//         try {
//             if (req.file && req.file.path) {
//                 fs.unlinkSync(req.file.path);
//                 console.log('File cleaned up after error');
//             }
//         } catch (cleanupError) {
//             console.error('Error cleaning up uploaded file on error:', cleanupError);
//         }

//         return res.status(500).json({
//             success: false,
//             error: 'IMPORT_FAILED',
//             message: 'An error occurred while importing accounts',
//             code: 'PROCESSING_ERROR',
//             details: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// });

router.post('/accounts-import', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, ensureTradeType, upload.single('excelFile'), async (req, res) => {
    // Add start time for performance tracking
    req.startTime = Date.now();

    try {
        console.log('=== ACCOUNTS IMPORT PROCESS STARTED ===');

        if (req.tradeType !== 'retailer') {
            return res.status(403).json({
                success: false,
                error: 'ACCESS_DENIED',
                message: 'This feature is only available for retailers.',
                code: 'INVALID_TRADE_TYPE'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'NO_FILE_UPLOADED',
                message: 'No file uploaded.',
                code: 'FILE_MISSING'
            });
        }

        const companyId = req.session.currentCompany;
        const fiscalYearId = req.session.currentFiscalYear.id;

        // Get company and fiscal year info
        const company = await Company.findById(companyId).select('name');
        const fiscalYear = await FiscalYear.findById(fiscalYearId);
        
        if (!company || !fiscalYear) {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                error: 'COMPANY_NOT_FOUND',
                message: 'Company or fiscal year not found.',
                code: 'INVALID_COMPANY'
            });
        }

        console.log('Processing import for company:', company?.name, 'Fiscal Year:', fiscalYear.name, 'ID:', fiscalYearId);

        // Validate file type
        const extname = path.extname(req.file.originalname).toLowerCase();
        if (extname !== '.xlsx') {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                error: 'INVALID_FILE_TYPE',
                message: 'Only .xlsx files are allowed.',
                code: 'FILE_TYPE_INVALID'
            });
        }

        // Validate file size (5MB max)
        if (req.file.size > 5 * 1024 * 1024) {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                error: 'FILE_TOO_LARGE',
                message: 'File size exceeds 5MB limit.',
                code: 'FILE_SIZE_EXCEEDED'
            });
        }

        // Process the Excel file
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0];

        console.log('Excel file loaded successfully. Total rows:', worksheet.rowCount);

        // Get all company groups for validation
        const companyGroups = await CompanyGroup.find({ company: companyId });
        const groupNameToIdMap = new Map();
        companyGroups.forEach(group => {
            groupNameToIdMap.set(group.name.toLowerCase(), {
                id: group._id,
                name: group.name
            });
        });

        console.log('Available company groups:', Array.from(groupNameToIdMap.values()).map(g => g.name));

        // Process each row
        const accounts = [];
        const errors = [];
        const skippedAccounts = [];
        
        // Get initial fiscal year
        const initialFiscalYear = await FiscalYear.findOne({ company: companyId })
            .sort({ startDate: 1 })
            .limit(1);

        const isInitialYear = initialFiscalYear && fiscalYear._id.toString() === initialFiscalYear._id.toString();
        console.log('Is initial fiscal year:', isInitialYear);

        // Get next unique number
        const lastAccount = await mongoose.model('Account').findOne({ company: companyId })
            .sort({ uniqueNumber: -1 })
            .select('uniqueNumber');
        let nextUniqueNumber = (lastAccount?.uniqueNumber || 0) + 1;
        console.log('Starting unique number:', nextUniqueNumber);

        // Track processed rows
        let totalRows = 0;
        let processedRows = 0;

        // Read headers
        const headerRow = worksheet.getRow(1);
        const actualHeaders = [];
        headerRow.eachCell({ includeEmpty: true }, (cell) => {
            actualHeaders.push(cell.value?.toString().trim());
        });

        console.log('Found headers:', actualHeaders);

        // Create header mapping
        const headerMap = {};
        actualHeaders.forEach((header, index) => {
            if (header) {
                const cleanHeader = header.toLowerCase().replace(/\s+/g, '');
                headerMap[cleanHeader] = index + 1;
            }
        });

        // Check for required columns
        if (!headerMap.name || !headerMap.companygroup) {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                error: 'INVALID_EXCEL_FORMAT',
                message: 'Excel file must contain "Name" and "Company Group" columns.',
                code: 'MISSING_REQUIRED_HEADERS',
                data: {
                    requiredHeaders: ['Name', 'Company Group'],
                    foundHeaders: actualHeaders
                }
            });
        }

        // Process each row starting from row 2
        for (let i = 2; i <= worksheet.rowCount; i++) {
            totalRows++;
            const row = worksheet.getRow(i);
            
            try {
                // Get name and group (required fields)
                const nameCell = row.getCell(headerMap.name);
                const groupCell = row.getCell(headerMap.companygroup);
                
                const name = nameCell?.value?.toString().trim() || '';
                const groupName = groupCell?.value?.toString().trim() || '';
                
                // Skip if both are empty
                if (!name && !groupName) {
                    continue;
                }
                
                processedRows++;
                
                // Validate required fields
                if (!name) {
                    throw new Error('Account Name is required');
                }
                if (!groupName) {
                    throw new Error('Company Group is required');
                }
                
                // Check if group exists
                const groupInfo = groupNameToIdMap.get(groupName.toLowerCase());
                if (!groupInfo) {
                    const availableGroups = Array.from(groupNameToIdMap.values()).map(g => g.name);
                    throw new Error(`Company Group "${groupName}" not found. Available groups: ${availableGroups.join(', ')}`);
                }
                
                // Check if account already exists (using the unique index: name + company + fiscalYear)
                const existingAccount = await mongoose.model('Account').findOne({
                    name: name,
                    company: companyId,
                    fiscalYear: { $in: [fiscalYearId] }
                });
                
                if (existingAccount) {
                    console.log(`Row ${i} - Skipping existing account: "${name}"`);
                    skippedAccounts.push({
                        row: i,
                        name: name,
                        companyGroup: groupName,
                        reason: 'Account already exists in this fiscal year'
                    });
                    continue;
                }
                
                // Helper to get optional cell value
                const getCellValue = (headerKey) => {
                    const colIndex = headerMap[headerKey];
                    if (!colIndex) return null;
                    const cell = row.getCell(colIndex);
                    return cell?.value?.toString().trim() || null;
                };
                
                // Prepare account data
                const accountData = {
                    name: name,
                    companyGroups: groupInfo.id,
                    company: companyId,
                    fiscalYear: [fiscalYearId], // This must be an array
                    originalFiscalYear: fiscalYearId,
                    isActive: true,
                    uniqueNumber: nextUniqueNumber++,
                    createdAt: new Date()
                };
                
                // Optional fields
                const address = getCellValue('address');
                if (address) accountData.address = address;
                
                const ward = getCellValue('ward');
                if (ward && !isNaN(parseInt(ward))) {
                    accountData.ward = parseInt(ward);
                }
                
                const phone = getCellValue('phone');
                if (phone) accountData.phone = phone;
                
                const pan = getCellValue('pan');
                if (pan && !isNaN(parseInt(pan)) && pan.length === 9) {
                    accountData.pan = parseInt(pan);
                }
                
                const contactPerson = getCellValue('contactperson');
                if (contactPerson) accountData.contactperson = contactPerson;
                
                const email = getCellValue('email');
                if (email) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (emailRegex.test(email)) {
                        accountData.email = email;
                    }
                }
                
                // Handle opening balance
                const openingBalanceStr = getCellValue('openingbalance');
                const balanceTypeStr = getCellValue('balancetype');
                
                const openingBalanceAmount = openingBalanceStr && !isNaN(parseFloat(openingBalanceStr)) 
                    ? Math.abs(parseFloat(openingBalanceStr)) 
                    : 0;
                
                const openingBalanceType = (balanceTypeStr || 'Dr').trim() === 'Cr' ? 'Cr' : 'Dr';
                
                // Only set opening balance if it's the initial fiscal year OR if amount is 0
                if (isInitialYear || openingBalanceAmount === 0) {
                    accountData.initialOpeningBalance = {
                        date: fiscalYear.startDate,
                        amount: openingBalanceAmount,
                        type: openingBalanceType,
                        initialFiscalYear: fiscalYearId
                    };
                    
                    accountData.openingBalance = {
                        date: fiscalYear.startDate,
                        amount: openingBalanceAmount,
                        type: openingBalanceType,
                        fiscalYear: fiscalYearId
                    };
                    
                    accountData.openingBalanceByFiscalYear = [{
                        amount: openingBalanceAmount,
                        type: openingBalanceType,
                        date: fiscalYear.startDate,
                        fiscalYear: fiscalYearId
                    }];
                    
                    accountData.openingBalanceDate = fiscalYear.startDate;
                } else {
                    // For non-initial years, only allow 0 opening balance
                    if (openingBalanceAmount !== 0) {
                        throw new Error(`Opening balance can only be set in initial fiscal year (${initialFiscalYear?.name}). Current FY: ${fiscalYear.name}`);
                    }
                    // Set default 0 opening balance
                    accountData.initialOpeningBalance = {
                        date: fiscalYear.startDate,
                        amount: 0,
                        type: 'Dr',
                        initialFiscalYear: fiscalYearId
                    };
                    
                    accountData.openingBalance = {
                        date: fiscalYear.startDate,
                        amount: 0,
                        type: 'Dr',
                        fiscalYear: fiscalYearId
                    };
                    
                    accountData.openingBalanceByFiscalYear = [{
                        amount: 0,
                        type: 'Dr',
                        date: fiscalYear.startDate,
                        fiscalYear: fiscalYearId
                    }];
                    
                    accountData.openingBalanceDate = fiscalYear.startDate;
                }
                
                accounts.push(accountData);
                console.log(`✓ Row ${i} - Account prepared: ${name}`);
                
            } catch (error) {
                console.log(`✗ Row ${i} - Error: ${error.message}`);
                errors.push({
                    row: i,
                    message: error.message,
                    data: {
                        name: row.getCell(headerMap.name)?.value?.toString().trim() || 'N/A',
                        companyGroup: row.getCell(headerMap.companygroup)?.value?.toString().trim() || 'N/A'
                    }
                });
            }
        }

        console.log('Processing completed:');
        console.log('- Total rows:', totalRows);
        console.log('- Processed rows:', processedRows);
        console.log('- Valid accounts:', accounts.length);
        console.log('- Errors:', errors.length);
        console.log('- Skipped existing accounts:', skippedAccounts.length);

        // Clean up uploaded file
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('Uploaded file cleaned up');
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError);
            }
        }

        // If no accounts to import
        if (accounts.length === 0) {
            const response = {
                success: true,
                message: 'No new accounts to import.',
                code: 'NO_NEW_ACCOUNTS',
                data: {
                    results: {
                        total: totalRows,
                        success: 0,
                        errors: errors,
                        skippedExisting: skippedAccounts.length,
                        processed: processedRows,
                        successRate: 0
                    },
                    summary: {
                        company: company.name,
                        fiscalYear: fiscalYear.name,
                        importDate: new Date().toISOString(),
                        fileName: req.file.originalname,
                        status: 'no_new_data',
                        availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name),
                        isInitialFiscalYear: isInitialYear
                    }
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    processedIn: `${Date.now() - req.startTime}ms`
                }
            };
            
            if (skippedAccounts.length > 0) {
                response.message = `All ${skippedAccounts.length} accounts already exist. No new accounts imported.`;
                response.data.skippedAccounts = skippedAccounts;
            }
            
            return res.json(response);
        }

        // Insert accounts
        console.log('Starting database insertion...');
        const createdAccounts = [];
        const failedInserts = [];

        for (const accountData of accounts) {
            try {
                // Create and save account individually
                const Account = mongoose.model('Account');
                const account = new Account(accountData);
                const savedAccount = await account.save();
                createdAccounts.push(savedAccount);
                console.log(`✓ Account inserted: ${accountData.name} (ID: ${savedAccount._id})`);
            } catch (insertError) {
                console.error(`✗ Failed to insert account ${accountData.name}:`, insertError.message);
                
                // Handle duplicate error
                if (insertError.code === 11000 || insertError.name === 'MongoServerError') {
                    // This should not happen as we checked earlier, but handle gracefully
                    skippedAccounts.push({
                        name: accountData.name,
                        reason: `Duplicate error: ${insertError.message}`
                    });
                } else {
                    failedInserts.push({
                        name: accountData.name,
                        error: insertError.message
                    });
                }
            }
        }

        console.log('Insertion completed:');
        console.log('- Successfully inserted:', createdAccounts.length);
        console.log('- Failed inserts:', failedInserts.length);

        // Prepare response
        const response = {
            success: true,
            data: {
                results: {
                    total: totalRows,
                    success: createdAccounts.length,
                    errors: errors.length,
                    failedInserts: failedInserts.length,
                    skippedExisting: skippedAccounts.length,
                    processed: processedRows,
                    successRate: totalRows > 0 ? ((createdAccounts.length / totalRows) * 100).toFixed(2) : 0
                },
                summary: {
                    company: company.name,
                    fiscalYear: fiscalYear.name,
                    importDate: new Date().toISOString(),
                    fileName: req.file.originalname,
                    status: createdAccounts.length > 0 ? 'success' : 'failed',
                    availableGroups: Array.from(groupNameToIdMap.values()).map(g => g.name),
                    isInitialFiscalYear: isInitialYear
                },
                importedAccounts: createdAccounts.map(acc => ({
                    id: acc._id,
                    name: acc.name,
                    uniqueNumber: acc.uniqueNumber,
                    companyGroup: acc.companyGroups ? 
                        (Array.from(groupNameToIdMap.values()).find(g => g.id.toString() === acc.companyGroups.toString())?.name || 'Unknown') : 
                        'Unknown',
                    address: acc.address,
                    phone: acc.phone,
                    email: acc.email,
                    openingBalance: acc.openingBalance?.amount || 0,
                    balanceType: acc.openingBalance?.type || 'Dr'
                }))
            },
            metadata: {
                timestamp: new Date().toISOString(),
                processedIn: `${Date.now() - req.startTime}ms`
            }
        };

        // Set appropriate message
        if (createdAccounts.length > 0 && failedInserts.length === 0 && errors.length === 0) {
            response.message = `Successfully imported ${createdAccounts.length} accounts`;
            response.code = 'SUCCESS';
            if (skippedAccounts.length > 0) {
                response.message += ` (${skippedAccounts.length} existing accounts were skipped)`;
                response.data.skippedAccounts = skippedAccounts;
            }
        } else if (createdAccounts.length > 0) {
            response.warning = 'PARTIAL_IMPORT';
            response.message = `${createdAccounts.length} accounts imported successfully`;
            response.code = 'PARTIAL_SUCCESS';
            if (errors.length > 0) {
                response.message += `, ${errors.length} rows had errors`;
                response.data.errors = errors;
            }
            if (failedInserts.length > 0) {
                response.message += `, ${failedInserts.length} inserts failed`;
                response.data.failedInserts = failedInserts;
            }
            if (skippedAccounts.length > 0) {
                response.message += `, ${skippedAccounts.length} existing accounts were skipped`;
                response.data.skippedAccounts = skippedAccounts;
            }
        } else {
            response.success = false;
            response.error = 'IMPORT_FAILED';
            response.message = 'No accounts were imported';
            response.code = 'FAILED';
            if (skippedAccounts.length > 0) {
                response.data.skippedAccounts = skippedAccounts;
            }
            if (errors.length > 0) {
                response.data.errors = errors;
            }
            return res.status(400).json(response);
        }

        return res.json(response);

    } catch (error) {
        console.error('=== ACCOUNTS IMPORT ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=== END ERROR ===');

        // Clean up uploaded file on error
        try {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
                console.log('File cleaned up after error');
            }
        } catch (cleanupError) {
            console.error('Error cleaning up uploaded file on error:', cleanupError);
        }

        return res.status(500).json({
            success: false,
            error: 'IMPORT_FAILED',
            message: 'An error occurred while importing accounts',
            code: 'PROCESSING_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update the route handler
router.get('/accounts-import-template', (req, res) => {
    const filePath = path.join(__dirname, '../../public/templates/accounts-import-template.xlsx');
    res.download(filePath, 'accounts-import-template.xlsx', (err) => {
        if (err) {
            console.error('Error downloading template:', err);
            res.status(404).send('Template file not found');
        }
    });
});

module.exports = router;