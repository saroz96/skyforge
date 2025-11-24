const express = require('express');
const router = express.Router();

const Company = require("../../models/Company");
const Account = require("../../models/retailer/Account");
const FiscalYear = require('../../models/FiscalYear');
const { isLoggedIn, ensureAuthenticated, ensureCompanySelected } = require('../../middleware/auth');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');

// routes/trialBalance.js
// router.get('/opening-trial-balance/alphabetical', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, async (req, res) => {
//     try {
//         const companyId = req.session.currentCompany;
//         // Fetch company and fiscal year details
//         const company = await Company.findById(companyId).select('renewalDate fiscalYear dateFormat').populate('fiscalYear');

//         // Check if fiscal year is already in the session or available in the company
//         let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//         let currentFiscalYear = null;

//         if (fiscalYear) {
//             currentFiscalYear = await FiscalYear.findById(fiscalYear);
//         }

//         // If no fiscal year is found in session or currentCompany, use company's fiscal year
//         if (!currentFiscalYear && company.fiscalYear) {
//             currentFiscalYear = company.fiscalYear;
//             req.session.currentFiscalYear = {
//                 id: currentFiscalYear._id.toString(),
//                 startDate: currentFiscalYear.startDate,
//                 endDate: currentFiscalYear.endDate,
//                 name: currentFiscalYear.name,
//                 dateFormat: currentFiscalYear.dateFormat,
//                 isActive: currentFiscalYear.isActive
//             };
//             fiscalYear = req.session.currentFiscalYear.id;
//         }

//         if (!fiscalYear) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'No fiscal year found in session or company.'
//             });
//         }


//         // Fetch all accounts with opening balances for the current fiscal year
//         const accounts = await Account.find({
//             company: companyId,
//             isActive: true,
//             $or: [
//                 {
//                     $or: [
//                         { 'openingBalance.fiscalYear': fiscalYear },
//                         { 'openingBalanceByFiscalYear.fiscalYear': fiscalYear }
//                     ]
//                 },
//                 {
//                     $and: [
//                         { originalFiscalYear: { $exists: true } },
//                         {
//                             $or: [
//                                 { 'initialOpeningBalance.initialFiscalYear': fiscalYear },
//                                 { originalFiscalYear: fiscalYear }
//                             ]
//                         }
//                     ]
//                 }
//             ]
//         })
//             .populate('companyGroups')
//             .sort({ name: 1 }); // Sort alphabetically by account name

//         // Process accounts to calculate debit and credit balances
//         let totalDebit = 0;
//         let totalCredit = 0;
//         let serialNumber = 1;

//         const trialBalanceData = accounts.map(account => {
//             let debitAmount = 0;
//             let creditAmount = 0;

//             // Check openingBalance for current fiscal year
//             if (account.openingBalance &&
//                 account.openingBalance.fiscalYear &&
//                 account.openingBalance.fiscalYear.toString() === fiscalYear.toString()) {
//                 if (account.openingBalance.type === 'Dr') {
//                     debitAmount += account.openingBalance.amount;
//                 } else {
//                     creditAmount += account.openingBalance.amount;
//                 }
//             }

//             // Check openingBalanceByFiscalYear array
//             const fiscalYearOpeningBalance = account.openingBalanceByFiscalYear.find(
//                 balance => balance.fiscalYear && balance.fiscalYear.toString() === fiscalYear.toString()
//             );

//             if (fiscalYearOpeningBalance) {
//                 if (fiscalYearOpeningBalance.type === 'Dr') {
//                     debitAmount += fiscalYearOpeningBalance.amount;
//                 } else {
//                     creditAmount += fiscalYearOpeningBalance.amount;
//                 }
//             }

//             // Check initialOpeningBalance for migrated accounts
//             if (account.initialOpeningBalance &&
//                 account.initialOpeningBalance.initialFiscalYear &&
//                 account.initialOpeningBalance.initialFiscalYear.toString() === fiscalYear.toString()) {
//                 if (account.initialOpeningBalance.type === 'Dr') {
//                     debitAmount += account.initialOpeningBalance.amount;
//                 } else {
//                     creditAmount += account.initialOpeningBalance.amount;
//                 }
//             }

//             // Add to totals
//             totalDebit += debitAmount;
//             totalCredit += creditAmount;

//             return {
//                 sNo: serialNumber++,
//                 account: account.name,
//                 debitBal: debitAmount > 0 ? debitAmount.toFixed(2) : '',
//                 creditBal: creditAmount > 0 ? creditAmount.toFixed(2) : ''
//             };
//         });

//         // Prepare response data
//         const responseData = {
//             success: true,
//             data: {
//                 company: {
//                     name: company?.name || 'Company Name',
//                     address: company?.address || 'Address not specified'
//                 },
//                 fiscalYear: fiscalYear?.name || 'Fiscal Year not specified',
//                 asOnDate: new Date().toLocaleDateString('en-US'), // You can format this as needed
//                 trialBalance: trialBalanceData,
//                 totals: {
//                     totalDebit: totalDebit.toFixed(2),
//                     totalCredit: totalCredit.toFixed(2)
//                 },
//                 grandTotal: {
//                     debit: totalDebit.toFixed(2),
//                     credit: totalCredit.toFixed(2)
//                 }
//             }
//         };

//         return res.json(responseData);

//     } catch (error) {
//         console.error('Error in /opening-trial-balance route:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'Internal server error',
//             details: error.message
//         });
//     }
// });

// router.get('/opening-trial-balance/alphabetical', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, async (req, res) => {
//     try {
//         const companyId = req.session.currentCompany;

//         // Fetch company and fiscal year details
//         const company = await Company.findById(companyId).select('name address renewalDate fiscalYear dateFormat').populate('fiscalYear');

//         // Check if fiscal year is already in the session or available in the company
//         let fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
//         let currentFiscalYear = null;

//         if (fiscalYearId) {
//             currentFiscalYear = await FiscalYear.findById(fiscalYearId);
//         }

//         // If no fiscal year is found in session or currentCompany, use company's fiscal year
//         if (!currentFiscalYear && company.fiscalYear) {
//             currentFiscalYear = company.fiscalYear;
//             req.session.currentFiscalYear = {
//                 id: currentFiscalYear._id.toString(),
//                 startDate: currentFiscalYear.startDate,
//                 endDate: currentFiscalYear.endDate,
//                 name: currentFiscalYear.name,
//                 dateFormat: currentFiscalYear.dateFormat,
//                 isActive: currentFiscalYear.isActive
//             };
//             fiscalYearId = req.session.currentFiscalYear.id;
//         }

//         if (!fiscalYearId) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'No fiscal year found in session or company.'
//             });
//         }

//         // Ensure currentFiscalYear is populated
//         if (!currentFiscalYear) {
//             currentFiscalYear = await FiscalYear.findById(fiscalYearId);
//         }

//         // Fetch all accounts with opening balances for the current fiscal year
//         const accounts = await Account.find({
//             company: companyId,
//             isActive: true,
//             $or: [
//                 {
//                     $or: [
//                         { 'openingBalance.fiscalYear': fiscalYearId },
//                         { 'openingBalanceByFiscalYear.fiscalYear': fiscalYearId }
//                     ]
//                 },
//                 {
//                     $and: [
//                         { originalFiscalYear: { $exists: true } },
//                         {
//                             $or: [
//                                 { 'initialOpeningBalance.initialFiscalYear': fiscalYearId },
//                                 { originalFiscalYear: fiscalYearId }
//                             ]
//                         }
//                     ]
//                 }
//             ]
//         })
//             .populate('companyGroups')
//             .sort({ name: 1 }); // Sort alphabetically by account name

//         // Process accounts to calculate debit and credit balances
//         let totalDebit = 0;
//         let totalCredit = 0;
//         let serialNumber = 1;

//         const trialBalanceData = accounts.map(account => {
//             let debitAmount = 0;
//             let creditAmount = 0;

//             // Check openingBalance for current fiscal year
//             if (account.openingBalance &&
//                 account.openingBalance.fiscalYear &&
//                 account.openingBalance.fiscalYear.toString() === fiscalYearId.toString()) {
//                 if (account.openingBalance.type === 'Dr') {
//                     debitAmount += account.openingBalance.amount || 0;
//                 } else {
//                     creditAmount += account.openingBalance.amount || 0;
//                 }
//             }

//             // Check openingBalanceByFiscalYear array
//             const fiscalYearOpeningBalance = account.openingBalanceByFiscalYear.find(
//                 balance => balance.fiscalYear && balance.fiscalYear.toString() === fiscalYearId.toString()
//             );

//             if (fiscalYearOpeningBalance) {
//                 if (fiscalYearOpeningBalance.type === 'Dr') {
//                     debitAmount += fiscalYearOpeningBalance.amount || 0;
//                 } else {
//                     creditAmount += fiscalYearOpeningBalance.amount || 0;
//                 }
//             }

//             // Check initialOpeningBalance for migrated accounts
//             if (account.initialOpeningBalance &&
//                 account.initialOpeningBalance.initialFiscalYear &&
//                 account.initialOpeningBalance.initialFiscalYear.toString() === fiscalYearId.toString()) {
//                 if (account.initialOpeningBalance.type === 'Dr') {
//                     debitAmount += account.initialOpeningBalance.amount || 0;
//                 } else {
//                     creditAmount += account.initialOpeningBalance.amount || 0;
//                 }
//             }

//             // Only include accounts with non-zero balances
//             if (debitAmount === 0 && creditAmount === 0) {
//                 return null;
//             }

//             // Add to totals
//             totalDebit += debitAmount;
//             totalCredit += creditAmount;

//             return {
//                 sNo: serialNumber++,
//                 account: account.name,
//                 debitBal: debitAmount > 0 ? debitAmount.toFixed(2) : '',
//                 creditBal: creditAmount > 0 ? creditAmount.toFixed(2) : ''
//             };
//         }).filter(item => item !== null); // Remove null entries

//         // Format date based on company settings or use default
//         const asOnDate = currentFiscalYear?.startDate ?
//             new Date(currentFiscalYear.startDate).toLocaleDateString('en-US') :
//             new Date().toLocaleDateString('en-US');

//         // Prepare response data
//         const responseData = {
//             success: true,
//             data: {
//                 company: {
//                     name: company?.name || 'Company Name',
//                     address: company?.address || 'Address not specified'
//                 },
//                 fiscalYear: currentFiscalYear?.name || 'Fiscal Year not specified',
//                 asOnDate: asOnDate,
//                 trialBalance: trialBalanceData,
//                 totals: {
//                     totalDebit: totalDebit.toFixed(2),
//                     totalCredit: totalCredit.toFixed(2)
//                 },
//                 grandTotal: {
//                     debit: totalDebit.toFixed(2),
//                     credit: totalCredit.toFixed(2)
//                 }
//             }
//         };

//         return res.json(responseData);

//     } catch (error) {
//         console.error('Error in /opening-trial-balance route:', error);
//         return res.status(500).json({
//             success: false,
//             error: 'Internal server error',
//             details: error.message
//         });
//     }
// });

router.get('/opening-trial-balance/alphabetical', isLoggedIn, ensureAuthenticated, ensureCompanySelected, ensureFiscalYear, async (req, res) => {
    try {
        const companyId = req.session.currentCompany;

        // Fetch company and fiscal year details
        const company = await Company.findById(companyId).select('name address renewalDate fiscalYear dateFormat').populate('fiscalYear');

        // Check if fiscal year is already in the session or available in the company
        let fiscalYearId = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYearId) {
            currentFiscalYear = await FiscalYear.findById(fiscalYearId);
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
            fiscalYearId = req.session.currentFiscalYear.id;
        }

        if (!fiscalYearId) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company.'
            });
        }

        // Ensure currentFiscalYear is populated
        if (!currentFiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYearId);
        }

        // Fetch all accounts with opening balances ONLY from openingBalanceByFiscalYear for the current fiscal year
        const accounts = await Account.find({
            company: companyId,
            isActive: true,
            'openingBalanceByFiscalYear.fiscalYear': fiscalYearId
        })
        .populate('companyGroups')
        .sort({ name: 1 }); // Sort alphabetically by account name

        // Process accounts to calculate debit and credit balances ONLY from openingBalanceByFiscalYear
        let totalDebit = 0;
        let totalCredit = 0;
        let serialNumber = 1;

        const trialBalanceData = accounts.map(account => {
            let debitAmount = 0;
            let creditAmount = 0;

            // ONLY check openingBalanceByFiscalYear array for the current fiscal year
            const fiscalYearOpeningBalance = account.openingBalanceByFiscalYear.find(
                balance => balance.fiscalYear && balance.fiscalYear.toString() === fiscalYearId.toString()
            );

            if (fiscalYearOpeningBalance) {
                if (fiscalYearOpeningBalance.type === 'Dr') {
                    debitAmount += fiscalYearOpeningBalance.amount || 0;
                } else {
                    creditAmount += fiscalYearOpeningBalance.amount || 0;
                }
            }

            // Only include accounts with non-zero balances from openingBalanceByFiscalYear
            if (debitAmount === 0 && creditAmount === 0) {
                return null;
            }

            // Add to totals
            totalDebit += debitAmount;
            totalCredit += creditAmount;

            return {
                sNo: serialNumber++,
                account: account.name,
                debitBal: debitAmount > 0 ? debitAmount.toFixed(2) : '',
                creditBal: creditAmount > 0 ? creditAmount.toFixed(2) : ''
            };
        }).filter(item => item !== null); // Remove null entries

        // Format date based on company settings or use default
        const asOnDate = currentFiscalYear?.startDate ?
            new Date(currentFiscalYear.startDate).toLocaleDateString('en-US') :
            new Date().toLocaleDateString('en-US');

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                company: {
                    name: company?.name || 'Company Name',
                    address: company?.address || 'Address not specified'
                },
                fiscalYear: currentFiscalYear?.name || 'Fiscal Year not specified',
                asOnDate: asOnDate,
                trialBalance: trialBalanceData,
                totals: {
                    totalDebit: totalDebit.toFixed(2),
                    totalCredit: totalCredit.toFixed(2)
                },
                grandTotal: {
                    debit: totalDebit.toFixed(2),
                    credit: totalCredit.toFixed(2)
                }
            }
        };

        return res.json(responseData);

    } catch (error) {
        console.error('Error in /opening-trial-balance route:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

module.exports = router;