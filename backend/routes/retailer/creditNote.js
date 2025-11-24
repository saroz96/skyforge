const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const NepaliDate = require('nepali-date');
const { ensureAuthenticated, ensureCompanySelected } = require('../../middleware/auth');
const { ensureTradeType } = require('../../middleware/tradeType');
const Company = require('../../models/Company');
const FiscalYear = require('../../models/FiscalYear');
const CreditNote = require('../../models/retailer/CreditNote');
const Account = require('../../models/retailer/Account');
const BillCounter = require('../../models/retailer/billCounter');
const { getNextBillNumber } = require('../../middleware/getNextBillNumber');
const Transaction = require('../../models/retailer/Transaction');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const checkFiscalYearDateRange = require('../../middleware/checkFiscalYearDateRange');
const ObjectId = mongoose.Types.ObjectId;


// GET - Show list of credit notes (JSON API for React)
router.get('/credit-note/register', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    try {
        if (req.tradeType === 'retailer') {
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const currentCompany = await Company.findById(new ObjectId(companyId));
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            let fromDate = req.query.fromDate ? req.query.fromDate : null;
            let toDate = req.query.toDate ? req.query.toDate : null;

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                // Fetch the fiscal year from the database if available in the session
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, throw an error
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

                // Assign fiscal year ID for use
                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // If no date range provided, return empty response with company info
            if (!fromDate || !toDate) {
                return res.json({
                    success: true,
                    data: {
                        company: company,
                        currentFiscalYear: currentFiscalYear,
                        creditNotes: [],
                        fromDate: fromDate || '',
                        toDate: toDate || ''
                    }
                });
            }

            // Build the query
            let query = { company: companyId };

            if (fromDate && toDate) {
                query.date = { $gte: fromDate, $lte: toDate };
            } else if (fromDate) {
                query.date = { $gte: fromDate };
            } else if (toDate) {
                query.date = { $lte: toDate };
            }

            const creditNotes = await CreditNote.find(query)
                .populate('debitAccounts.account creditAccounts.account')
                .sort({ date: 1 }) // Sort by date and bill number descending
                .lean()
                .exec();

            // Format the response data
            const formattedCreditNotes = creditNotes.map(note => ({
                _id: note._id,
                billNumber: note.billNumber,
                date: note.date,
                description: note.description,
                totalDebit: note.debitAccounts.reduce((sum, acc) => sum + (acc.debit || 0), 0),
                totalCredit: note.creditAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0),
                debitAccounts: note.debitAccounts.map(acc => ({
                    account: acc.account ? {
                        _id: acc.account._id,
                        name: acc.account.name,
                        code: acc.account.code || acc.account.uniqueNumber
                    } : null,
                    debit: acc.debit
                })),
                creditAccounts: note.creditAccounts.map(acc => ({
                    account: acc.account ? {
                        _id: acc.account._id,
                        name: acc.account.name,
                        code: acc.account.code || acc.account.uniqueNumber
                    } : null,
                    credit: acc.credit
                })),
                user: note.user,
                company: note.company,
                fiscalYear: note.fiscalYear,
                isActive: note.isActive,
                status: note.status,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt
            }));

            return res.json({
                success: true,
                data: {
                    company,
                    currentFiscalYear,
                    creditNotes: formattedCreditNotes,
                    currentCompanyName,
                    currentCompany,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences || { theme: 'light' }
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'View Credit Notes',
                    body: 'retailer >> credit-note >> view credit notes',
                    theme: req.user.preferences?.theme || 'light' // Default to light if not set
                }
            });
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied for this trade type'
            });
        }
    } catch (error) {
        console.error('Error in credit-note-list endpoint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// GET - Get credit note form data
router.get('/credit-note', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
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
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Fetch all active accounts for the company and fiscal year
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: fiscalYear,
                isActive: true
            });

            // Get last counter without incrementing
            const lastCounter = await BillCounter.findOne({
                company: companyId,
                fiscalYear: fiscalYear,
                transactionType: 'creditNote'
            });

            // Calculate next number for display only
            const nextNumber = lastCounter ? lastCounter.currentBillNumber + 1 : 1;
            const fiscalYears = await FiscalYear.findById(fiscalYear);
            const prefix = fiscalYears.billPrefixes.creditNote;
            const nextBillNumber = `${prefix}${nextNumber.toString().padStart(7, '0')}`;

            // Prepare response data
            const responseData = {
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        name: currentFiscalYear.name,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts: accounts.map(account => ({
                        _id: account._id,
                        name: account.name,
                        code: account.uniqueNumber,
                        companyGroups: account.companyGroups,
                        openingBalance: account.openingBalance,
                        balanceType: account.balanceType,
                        isActive: account.isActive
                    })),
                    nextBillNumber,
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    currentDate: new Date().toISOString().split('T')[0],
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
            console.error('Error fetching data for credit note form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied for this trade type'
        });
    }
});

// POST - Create a new credit note with multiple debit and credit accounts
router.post('/credit-note', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        const { nepaliDate, billDate, creditAccounts, debitAccounts, description } = req.body;
        const companyId = req.session.currentCompany;
        const currentFiscalYear = req.session.currentFiscalYear.id;
        const fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        const userId = req.user._id;

        try {
            // Validate required fields
            if (!debitAccounts || !creditAccounts || debitAccounts.length === 0 || creditAccounts.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debit and credit accounts are required'
                });
            }

            // Validate debit and credit amounts match
            const totalDebit = debitAccounts.reduce((sum, account) => sum + parseFloat(account.debit || 0), 0);
            const totalCredit = creditAccounts.reduce((sum, account) => sum + parseFloat(account.credit || 0), 0);

            if (totalDebit !== totalCredit) {
                return res.status(400).json({
                    success: false,
                    message: 'Total debit amount must equal total credit amount'
                });
            }

            const billNumber = await getNextBillNumber(companyId, fiscalYearId, 'creditNote');

            // Create the Credit Note
            const creditNote = new CreditNote({
                billNumber: billNumber,
                date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                debitAccounts,
                creditAccounts,
                description,
                user: userId,
                company: companyId,
                fiscalYear: currentFiscalYear,
            });

            await creditNote.save();

            // Process Credit Accounts
            const creditTransactions = [];
            for (let credit of creditAccounts) {
                let previousCreditBalance = 0;
                const lastCreditTransaction = await Transaction.findOne({ account: credit.account }).sort({ transactionDate: -1 });
                if (lastCreditTransaction) {
                    previousCreditBalance = lastCreditTransaction.balance;
                }

                const debitAccountNames = await Promise.all(
                    debitAccounts.map(async (debit) => {
                        const account = await Account.findById(debit.account);
                        return account ? account.name : 'Credit Note';
                    })
                );

                const creditTransaction = new Transaction({
                    account: credit.account,
                    type: 'CrNt',
                    creditNoteId: creditNote._id,
                    billNumber: billNumber,
                    drCrNoteAccountTypes: 'Credit',
                    drCrNoteAccountType: debitAccountNames.join(', '),
                    debit: 0,
                    credit: credit.credit,
                    paymentMode: 'Cr Note',
                    balance: previousCreditBalance - credit.credit,
                    date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear,
                });

                await creditTransaction.save();
                creditTransactions.push(creditTransaction._id);
                await Account.findByIdAndUpdate(credit.account, { $push: { transactions: creditTransaction._id } });
            }

            // Process Debit Accounts
            const debitTransactions = [];
            for (let debit of debitAccounts) {
                let previousDebitBalance = 0;
                const lastDebitTransaction = await Transaction.findOne({ account: debit.account }).sort({ transactionDate: -1 });
                if (lastDebitTransaction) {
                    previousDebitBalance = lastDebitTransaction.balance;
                }

                const creditAccountNames = await Promise.all(
                    creditAccounts.map(async (credit) => {
                        const account = await Account.findById(credit.account);
                        return account ? account.name : 'Debit Note';
                    })
                );

                const debitTransaction = new Transaction({
                    account: debit.account,
                    type: 'CrNt',
                    creditNoteId: creditNote._id,
                    billNumber: billNumber,
                    drCrNoteAccountTypes: 'Debit',
                    drCrNoteAccountType: creditAccountNames.join(', '),
                    debit: debit.debit,
                    credit: 0,
                    paymentMode: 'Cr Note',
                    balance: previousDebitBalance + debit.debit,
                    date: nepaliDate ? new Date(nepaliDate) : new Date(billDate),
                    company: companyId,
                    user: userId,
                    fiscalYear: currentFiscalYear,
                });

                await debitTransaction.save();
                debitTransactions.push(debitTransaction._id);
                await Account.findByIdAndUpdate(debit.account, { $push: { transactions: debitTransaction._id } });
            }

            // Prepare success response
            const responseData = {
                success: true,
                message: 'Credit Note saved successfully!',
                data: {
                    creditNote: {
                        _id: creditNote._id,
                        billNumber: creditNote.billNumber,
                        date: creditNote.date,
                        description: creditNote.description,
                        debitAccounts: creditNote.debitAccounts,
                        creditAccounts: creditNote.creditAccounts,
                        totalDebit: totalDebit,
                        totalCredit: totalCredit
                    },
                    transactions: {
                        debitTransactions: debitTransactions,
                        creditTransactions: creditTransactions
                    },
                    redirectUrl: req.query.print === 'true'
                        ? `/credit-note/${creditNote._id}/direct-print`
                        : '/credit-note/new'
                }
            };

            res.status(201).json(responseData);

        } catch (err) {
            console.error('Error saving credit note:', err);
            res.status(500).json({
                success: false,
                message: 'Error saving credit note!',
                error: err.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Access denied for this trade type'
        });
    }
});

router.get('/credit-note/finds', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, use company's fiscal year
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
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Fetch the latest saved credit note entry (without modifying it)
            const latestCreditNote = await CreditNote.findOne({
                company: companyId,
                fiscalYear: fiscalYear
            })
                .sort({ date: -1, billNumber: -1 }) // Sort by date descending, then billNumber descending
                .select('billNumber date')
                .lean();

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    billNumber: latestCreditNote?.billNumber || '',
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    companyDateFormat: companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
                    nepaliDate: nepaliDate,
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences || { theme: 'light' }
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor',
                    meta: {
                        title: 'Find Credit Note',
                        body: 'retailer >> credit-note >> find',
                        theme: req.user.preferences?.theme || 'light'
                    }
                }
            });
        } catch (error) {
            console.error('Error in /credit-note/finds:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    } else {
        return res.status(400).json({
            success: false,
            error: 'Invalid trade type'
        });
    }
});

router.get('/credit-note/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const creditNoteId = req.params.id;
            const companyId = req.session.currentCompany;
            const currentCompanyName = req.session.currentCompanyName;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Find the credit note document by ID
            const creditNote = await CreditNote.findById(creditNoteId)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            if (!creditNote) {
                return res.status(404).json({
                    success: false,
                    error: 'Credit note not found'
                });
            }

            // Fetch accounts
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: fiscalYear,
                isActive: true
            }).exec();

            // Format dates safely
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            };

            // Calculate totals
            const totalDebit = creditNote.debitAccounts.reduce((sum, acc) => sum + (acc.debit || 0), 0);
            const totalCredit = creditNote.creditAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);

            res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    creditNote: {
                        ...creditNote.toObject(),
                        date: formatDate(creditNote.date),
                        createdAt: formatDate(creditNote.createdAt),
                        updatedAt: formatDate(creditNote.updatedAt),
                        debitAccounts: creditNote.debitAccounts || [],
                        creditAccounts: creditNote.creditAccounts || [],
                        user: creditNote.user || null,
                        company: creditNote.company || null,
                        totalDebit: totalDebit,
                        totalCredit: totalCredit
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts: accounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.uniqueNumber,
                        uniqueNumber: acc.uniqueNumber,
                        accountType: acc.accountType,
                        isActive: acc.isActive,
                        openingBalance: acc.openingBalance,
                        balanceType: acc.balanceType,
                        companyGroups: acc.companyGroups
                    })),
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
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
            });

        } catch (error) {
            console.error('Error fetching data for credit note form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

router.get('/credit-note/edit/billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.query;
            const companyId = req.session.currentCompany;
            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
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
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Find the credit note document by billNumber
            const creditNote = await CreditNote.findOne({
                billNumber: billNumber,
                company: companyId,
                fiscalYear: fiscalYear
            })
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            if (!creditNote) {
                return res.status(404).json({
                    success: false,
                    error: 'Credit note not found'
                });
            }

            // Fetch accounts excluding 'Cash in Hand' and 'Bank Accounts'
            const accounts = await Account.find({
                company: companyId,
                fiscalYear: fiscalYear,
            }).exec();

            // Format dates safely
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            };

            // Calculate totals
            const totalDebit = creditNote.debitAccounts.reduce((sum, acc) => sum + (acc.debit || 0), 0);
            const totalCredit = creditNote.creditAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);

            // Return JSON response instead of rendering
            return res.json({
                success: true,
                data: {
                    company: {
                        _id: company._id,
                        renewalDate: company.renewalDate,
                        dateFormat: company.dateFormat,
                        fiscalYear: company.fiscalYear
                    },
                    creditNote: {
                        _id: creditNote._id,
                        billNumber: creditNote.billNumber,
                        date: formatDate(creditNote.date),
                        description: creditNote.description,
                        status: creditNote.status,
                        isActive: creditNote.isActive,
                        totalDebit: totalDebit,
                        totalCredit: totalCredit,
                        debitAccounts: creditNote.debitAccounts.map(da => ({
                            account: {
                                _id: da.account._id,
                                name: da.account.name,
                                code: da.account.code || da.account.uniqueNumber,
                                uniqueNumber: da.account.uniqueNumber
                            },
                            debit: da.debit,
                            description: da.description
                        })),
                        creditAccounts: creditNote.creditAccounts.map(ca => ({
                            account: {
                                _id: ca.account._id,
                                name: ca.account.name,
                                code: ca.account.code || ca.account.uniqueNumber,
                                uniqueNumber: ca.account.uniqueNumber
                            },
                            credit: ca.credit,
                            description: ca.description
                        })),
                        user: creditNote.user ? {
                            _id: creditNote.user._id,
                            name: creditNote.user.name
                        } : null,
                        company: creditNote.company ? {
                            _id: creditNote.company._id,
                            name: creditNote.company.name
                        } : null,
                        createdAt: formatDate(creditNote.createdAt),
                        updatedAt: formatDate(creditNote.updatedAt)
                    },
                    currentFiscalYear: {
                        _id: currentFiscalYear._id,
                        startDate: currentFiscalYear.startDate,
                        endDate: currentFiscalYear.endDate,
                        name: currentFiscalYear.name,
                        dateFormat: currentFiscalYear.dateFormat,
                        isActive: currentFiscalYear.isActive
                    },
                    accounts: accounts.map(acc => ({
                        _id: acc._id,
                        name: acc.name,
                        code: acc.code,
                        uniqueNumber: acc.uniqueNumber,
                        accountType: acc.accountType,
                        isActive: acc.isActive,
                        openingBalance: acc.openingBalance,
                        balanceType: acc.balanceType,
                        companyGroups: acc.companyGroups
                    })),
                    nepaliDate,
                    companyDateFormat,
                    currentCompanyName: req.session.currentCompanyName,
                    date: new Date().toISOString().split('T')[0],
                    user: {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role,
                        preferences: req.user.preferences || { theme: 'light' }
                    },
                    isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
                },
                meta: {
                    title: 'Edit Credit Note',
                    body: 'retailer >> credit-note >> edit',
                    theme: req.user.preferences?.theme || 'light'
                }
            });
        } catch (error) {
            console.error('Error fetching data for credit note form:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            error: 'Access denied for this trade type'
        });
    }
});

// PUT - Update an existing credit note by ID with multiple debit and credit accounts (JSON response for React)
router.put('/credit-note/:id', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, checkFiscalYearDateRange, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { nepaliDate, billDate, debitAccounts, creditAccounts, description } = req.body;
            const { id } = req.params;
            const companyId = req.session.currentCompany;
            const currentFiscalYear = req.session.currentFiscalYear._id;
            const userId = req.user._id;

            // Validation
            if (!debitAccounts || !creditAccounts || debitAccounts.length === 0 || creditAccounts.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debit and credit accounts are required'
                });
            }

            // Validate debit and credit amounts match
            const totalDebit = debitAccounts.reduce((sum, debit) => sum + parseFloat(debit.debit || 0), 0);
            const totalCredit = creditAccounts.reduce((sum, credit) => sum + parseFloat(credit.credit || 0), 0);

            if (totalDebit !== totalCredit) {
                return res.status(400).json({
                    success: false,
                    message: 'Total debit and credit amounts must match'
                });
            }

            // Validate ObjectId
            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Credit Note ID.'
                });
            }

            // Find the existing credit note by ID
            const creditNote = await CreditNote.findById(id);
            if (!creditNote) {
                return res.status(404).json({
                    success: false,
                    message: 'Credit note not found'
                });
            }

            // List of current debit and credit accounts from the request
            const updatedDebitAccountIds = debitAccounts.map(debit => debit.account);
            const updatedCreditAccountIds = creditAccounts.map(credit => credit.account);

            // Remove outdated debit transactions
            await Transaction.deleteMany({
                creditNoteId: creditNote._id,
                drCrNoteAccountTypes: 'Debit',
                account: { $nin: updatedDebitAccountIds }
            });

            // Remove outdated credit transactions
            await Transaction.deleteMany({
                creditNoteId: creditNote._id,
                drCrNoteAccountTypes: 'Credit',
                account: { $nin: updatedCreditAccountIds }
            });

            // Update the credit note fields
            creditNote.date = nepaliDate ? new Date(nepaliDate) : new Date(billDate);
            creditNote.debitAccounts = debitAccounts;
            creditNote.creditAccounts = creditAccounts;
            creditNote.description = description;
            await creditNote.save();

            // Update or create Debit Transactions
            for (const debit of debitAccounts) {
                const existingDebitTransaction = await Transaction.findOne({
                    creditNoteId: creditNote._id,
                    account: debit.account,
                    drCrNoteAccountTypes: 'Debit'
                });

                let previousDebitBalance = 0;
                const lastDebitTransaction = await Transaction.findOne({ account: debit.account }).sort({ transactionDate: -1 });
                if (lastDebitTransaction) {
                    previousDebitBalance = lastDebitTransaction.balance;
                }

                const creditAccountNames = await Promise.all(
                    creditAccounts.map(async credit => {
                        const account = await Account.findById(credit.account);
                        return account ? account.name : 'Credit Note';
                    })
                );

                if (existingDebitTransaction) {
                    // Update existing transaction
                    existingDebitTransaction.debit = debit.debit;
                    existingDebitTransaction.balance = previousDebitBalance + debit.debit;
                    existingDebitTransaction.date = creditNote.date;
                    existingDebitTransaction.drCrNoteAccountType = creditAccountNames.join(', ');
                    await existingDebitTransaction.save();
                } else {
                    // Create new transaction if it doesn't exist
                    const debitTransaction = new Transaction({
                        account: debit.account,
                        type: 'CrNt',
                        creditNoteId: creditNote._id,
                        billNumber: creditNote.billNumber,
                        drCrNoteAccountTypes: 'Debit',
                        drCrNoteAccountType: creditAccountNames.join(', '),
                        debit: debit.debit,
                        credit: 0,
                        paymentMode: 'Cr Note',
                        balance: previousDebitBalance + debit.debit,
                        date: creditNote.date,
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });

                    await debitTransaction.save();
                    await Account.findByIdAndUpdate(debit.account, { $push: { transactions: debitTransaction._id } });
                }
            }

            // Update or create Credit Transactions
            for (const credit of creditAccounts) {
                const existingCreditTransaction = await Transaction.findOne({
                    creditNoteId: creditNote._id,
                    account: credit.account,
                    drCrNoteAccountTypes: 'Credit'
                });

                let previousCreditBalance = 0;
                const lastCreditTransaction = await Transaction.findOne({ account: credit.account }).sort({ transactionDate: -1 });
                if (lastCreditTransaction) {
                    previousCreditBalance = lastCreditTransaction.balance;
                }

                const debitAccountNames = await Promise.all(
                    debitAccounts.map(async debit => {
                        const account = await Account.findById(debit.account);
                        return account ? account.name : 'Debit Note';
                    })
                );

                if (existingCreditTransaction) {
                    // Update existing transaction
                    existingCreditTransaction.credit = credit.credit;
                    existingCreditTransaction.balance = previousCreditBalance - credit.credit;
                    existingCreditTransaction.date = creditNote.date;
                    existingCreditTransaction.drCrNoteAccountType = debitAccountNames.join(', ');
                    await existingCreditTransaction.save();
                } else {
                    // Create new transaction if it doesn't exist
                    const creditTransaction = new Transaction({
                        account: credit.account,
                        type: 'CrNt',
                        creditNoteId: creditNote._id,
                        billNumber: creditNote.billNumber,
                        drCrNoteAccountTypes: 'Credit',
                        drCrNoteAccountType: debitAccountNames.join(', '),
                        debit: 0,
                        credit: credit.credit,
                        paymentMode: 'Cr Note',
                        balance: previousCreditBalance - credit.credit,
                        date: creditNote.date,
                        company: companyId,
                        user: userId,
                        fiscalYear: currentFiscalYear,
                    });

                    await creditTransaction.save();
                    await Account.findByIdAndUpdate(credit.account, { $push: { transactions: creditTransaction._id } });
                }
            }

            // Populate the updated credit note for response
            const updatedCreditNote = await CreditNote.findById(creditNote._id)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company');

            // Calculate totals for response
            const responseTotalDebit = updatedCreditNote.debitAccounts.reduce((sum, acc) => sum + (acc.debit || 0), 0);
            const responseTotalCredit = updatedCreditNote.creditAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);

            // Response for React frontend
            const response = {
                success: true,
                message: 'Credit note updated successfully!',
                data: {
                    creditNote: {
                        ...updatedCreditNote.toObject(),
                        totalDebit: responseTotalDebit,
                        totalCredit: responseTotalCredit
                    },
                    printUrl: `/credit-note/${creditNote._id}/direct-print-edit`
                }
            };

            if (req.query.print === 'true') {
                response.print = true;
            }

            res.json(response);

        } catch (error) {
            console.error('Error updating credit note:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    } else {
        res.status(403).json({
            success: false,
            message: 'Unauthorized trade type.'
        });
    }
});

// Route to cancel the credit note and related transactions (JSON response)
router.post('/credit-note/cancel/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the credit note status to 'canceled'
            const updateCreditNoteStatus = await CreditNote.updateOne(
                { billNumber },
                { status: 'canceled', isActive: false }
            );

            console.log('Credit Note Canceled Update Result: ', updateCreditNoteStatus);

            // Mark related transactions as 'canceled' and set isActive to false
            const updateTransactionsStatus = await Transaction.updateMany(
                { billNumber, type: 'CrNt' },
                { status: 'canceled', isActive: false }
            );

            console.log('Related transaction update result: ', updateTransactionsStatus);

            // Return JSON response
            res.json({
                success: true,
                message: 'Credit note and related transactions have been canceled successfully.',
                data: {
                    creditNote: updateCreditNoteStatus,
                    transactions: updateTransactionsStatus
                }
            });

        } catch (error) {
            console.error('Error canceling credit note:', error);

            // Return JSON error response
            res.status(500).json({
                success: false,
                message: 'An error occurred while canceling the credit note.',
                error: error.message
            });
        }
    } else {
        // Return unauthorized response for non-retailer trade types
        res.status(403).json({
            success: false,
            message: 'Unauthorized trade type. Only retailers can perform this action.'
        });
    }
});

// Route to reactivate the credit note and related transactions (JSON response)
router.post('/credit-note/reactivate/:billNumber', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const { billNumber } = req.params;

            // Update the credit note status to 'active'
            const updateCreditNoteStatus = await CreditNote.updateOne(
                { billNumber },
                { status: 'active', isActive: true }
            );

            console.log('Update credit note status:', updateCreditNoteStatus);

            // Reactivate related transactions and set isActive to true
            const updateTransactionsStatus = await Transaction.updateMany(
                {
                    billNumber,
                    type: 'CrNt'
                },
                { status: 'active', isActive: true }
            );

            console.log('Update Transactions Status:', updateTransactionsStatus);

            // Return JSON response
            res.json({
                success: true,
                message: 'Credit note and related transactions have been reactivated successfully.',
                data: {
                    creditNote: updateCreditNoteStatus,
                    transactions: updateTransactionsStatus
                }
            });

        } catch (error) {
            console.error("Error reactivating credit note:", error);

            // Return JSON error response
            res.status(500).json({
                success: false,
                message: 'An error occurred while reactivating the credit note.',
                error: error.message
            });
        }
    } else {
        // Return unauthorized response for non-retailer trade types
        res.status(403).json({
            success: false,
            message: 'Unauthorized trade type. Only retailers can perform this action.'
        });
    }
});

// View individual credit note (JSON API for React)
router.get('/credit-note/:id/print', ensureAuthenticated, ensureCompanySelected, ensureTradeType, ensureFiscalYear, async (req, res) => {
    if (req.tradeType === 'retailer') {
        try {
            const creditNoteId = req.params.id;
            const currentCompanyName = req.session.currentCompanyName;
            const companyId = req.session.currentCompany;

            const today = new Date();
            const nepaliDate = new NepaliDate(today).format('YYYY-MM-DD');
            const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat name address ward city country phone email pan').populate('fiscalYear');
            const companyDateFormat = company ? company.dateFormat : 'english';

            // Check if fiscal year is already in the session or available in the company
            let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
            let currentFiscalYear = null;

            if (fiscalYear) {
                currentFiscalYear = await FiscalYear.findById(fiscalYear);
            }

            // If no fiscal year is found in session or currentCompany, throw an error
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

                // Assign fiscal year ID for use
                fiscalYear = req.session.currentFiscalYear.id;
            }

            if (!fiscalYear) {
                return res.status(400).json({
                    success: false,
                    error: 'No fiscal year found in session or company.'
                });
            }

            // Validate the selectedDate
            if (!nepaliDate || isNaN(new Date(nepaliDate).getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid invoice date provided'
                });
            }

            const currentCompany = await Company.findById(new ObjectId(companyId));
            if (!currentCompany) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Validate credit note ID
            if (!mongoose.Types.ObjectId.isValid(creditNoteId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid credit note ID.'
                });
            }

            // Find the credit note
            const creditNote = await CreditNote.findById(creditNoteId)
                .populate('debitAccounts.account')
                .populate('creditAccounts.account')
                .populate('user')
                .populate('company')
                .lean()
                .exec();

            if (!creditNote) {
                return res.status(404).json({
                    success: false,
                    message: 'Credit note not found.'
                });
            }

            const creditTransactions = await Transaction.find({
                creditNoteId: creditNote._id,
                type: 'CrNt',
                drCrNoteAccountTypes: 'Credit'
            }).populate('account').lean().exec();

            const debitTransactions = await Transaction.find({
                creditNoteId: creditNote._id,
                type: 'CrNt',
                drCrNoteAccountTypes: 'Debit'
            }).populate('account').lean().exec();

            // Format dates safely
            const formatDate = (date) => {
                if (!date) return null;
                try {
                    return new Date(date).toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            };

            // Calculate totals
            const totalDebit = creditNote.debitAccounts.reduce((sum, acc) => sum + (acc.debit || 0), 0);
            const totalCredit = creditNote.creditAccounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);

            // Prepare response
            const response = {
                success: true,
                data: {
                    company: {
                        ...company,
                        fiscalYear: company.fiscalYear
                    },
                    currentFiscalYear: currentFiscalYear,
                    creditNote: {
                        ...creditNote,
                        date: formatDate(creditNote.date),
                        createdAt: formatDate(creditNote.createdAt),
                        updatedAt: formatDate(creditNote.updatedAt),
                        debitAccounts: creditNote.debitAccounts || [],
                        creditAccounts: creditNote.creditAccounts || [],
                        user: creditNote.user || { name: 'N/A' },
                        company: creditNote.company || { name: 'N/A' },
                        totalDebit: totalDebit,
                        totalCredit: totalCredit
                    },
                    creditTransactions: creditTransactions || [],
                    debitTransactions: debitTransactions || [],
                    currentCompanyName,
                    currentCompany: {
                        _id: currentCompany._id,
                        name: currentCompany.name,
                        phone: currentCompany.phone,
                        pan: currentCompany.pan,
                        address: currentCompany.address,
                        ward: currentCompany.ward,
                        city: currentCompany.city,
                        country: currentCompany.country,
                        email: currentCompany.email
                    },
                    currentDate: formatDate(new Date()),
                    nepaliDate,
                    user: req.user ? {
                        _id: req.user._id,
                        name: req.user.name,
                        email: req.user.email,
                        isAdmin: req.user.isAdmin,
                        role: req.user.role
                    } : null,
                    userPreferences: {
                        theme: req.user?.preferences?.theme || 'light'
                    },
                    userRoles: {
                        isAdminOrSupervisor: req.user?.isAdmin || req.user?.role === 'Supervisor'
                    }
                },
                meta: {
                    title: 'Print Credit Note',
                    body: 'retailer >> credit-note >> print'
                }
            };

            res.json(response);
        } catch (error) {
            console.error('Error retrieving credit note:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
});


module.exports = router;