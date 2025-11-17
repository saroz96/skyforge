// routes/vatConfirmation.js
const express = require('express');
const router = express.Router();
const Transaction = require('../../models/retailer/Transaction');
const Account = require('../../models/retailer/Account');
const Company = require('../../models/Company');
const FiscalYear = require('../../models/FiscalYear');
const mongoose = require('mongoose');
const SalesBill = require('../../models/retailer/SalesBill');
const PurchaseBill = require('../../models/retailer/PurchaseBill');
const SalesReturn = require('../../models/retailer/SalesReturn');
const PurchaseReturn = require('../../models/retailer/PurchaseReturns');
const Payment = require('../../models/retailer/Payment');
const Receipt = require('../../models/retailer/Receipt');
const JournalVoucher = require('../../models/retailer/JournalVoucher');
const ensureFiscalYear = require('../../middleware/checkActiveFiscalYear');
const DebitNote = require('../../models/retailer/DebitNote');
const CreditNote = require('../../models/retailer/CreditNote');
const CompanyGroup = require('../../models/retailer/CompanyGroup');

router.get('/party-summary/:accountId', ensureFiscalYear, async (req, res) => {
    try {
        const { accountId } = req.params;
        const { startDate, endDate } = req.query;
        const fiscalYear = req.session.currentFiscalYear.id; // Fixed: changed from req.fiscalYear
        const companyId = req.session.currentCompany;

        // Get company details
        const company = await Company.findById(companyId)
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Get party details
        const party = await Account.findById(accountId)
            .populate('companyGroups', 'name');
        if (!party) {
            return res.status(404).json({ message: 'Party not found' });
        }

        // Initialize comprehensive summary
        let summary = {
            // Sales related
            taxableSales: 0,           // Sales amount EXCLUDING VAT
            taxableSalesVAT: 0,         // ONLY VAT amount
            nonTaxableSales: 0,         // Non-VAT sales (full amount)
            salesReturn: 0,             // Return amount EXCLUDING VAT
            salesReturnVAT: 0,          // ONLY Return VAT amount

            // Purchase related
            taxablePurchase: 0,         // Purchase amount EXCLUDING VAT
            taxablePurchaseVAT: 0,      // ONLY VAT amount
            nonTaxablePurchase: 0,      // Non-VAT purchase (full amount)
            purchaseReturn: 0,          // Return amount EXCLUDING VAT
            purchaseReturnVAT: 0,       // ONLY Return VAT amount

            // Other transactions
            payments: 0,
            receipts: 0,
            journalDebit: 0,
            journalCredit: 0,
            debitNotes: 0,
            creditNotes: 0,

            // Balance information
            openingBalance: 0,
            closingBalance: 0,
            totalDebit: 0,
            totalCredit: 0,

            // Additional transaction types
            stockAdjustment: 0,
            roundOff: 0
        };

        // Calculate running balance
        let runningBalance = 0;

        // Get opening balance from account
        const openingBalanceData = party.openingBalanceByFiscalYear.find(
            ob => ob.fiscalYear && ob.fiscalYear.toString() === fiscalYear
        );

        if (openingBalanceData) {
            summary.openingBalance = openingBalanceData.type === 'Dr' ?
                openingBalanceData.amount : -openingBalanceData.amount;
            runningBalance = summary.openingBalance;
        }

        // Build date filter
        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // ==================== SALES BILLS ====================
        const salesBills = await SalesBill.find({
            company: companyId,
            fiscalYear: fiscalYear,
            account: accountId,
            ...dateFilter
        }).populate('items.item');

        console.log('=== SALES BILLS ===');
        salesBills.forEach(bill => {
            console.log(`Sales Bill ${bill.billNumber}:`, {
                taxableAmount: bill.taxableAmount,
                vatAmount: bill.vatAmount,
                nonVatSales: bill.nonVatSales,
                totalAmount: bill.totalAmount,
                isVatExempt: bill.isVatExempt
            });

            // SIMPLE LOGIC: Use the amounts as they are in the bill
            summary.taxableSales += bill.taxableAmount || 0;
            summary.taxableSalesVAT += bill.vatAmount || 0;
            summary.nonTaxableSales += bill.nonVatSales || 0;

            // Calculate balance change for sales bills
            // For sales, the party account is debited (increases balance)
            const balanceChange = bill.totalAmount || 0;
            runningBalance += balanceChange;

            console.log(`Added Sales - Taxable: ${bill.taxableAmount}, VAT: ${bill.vatAmount}, Non-Taxable: ${bill.nonVatSales}, Balance Change: +${balanceChange}`);
        });

        // ==================== PURCHASE BILLS ====================
        const purchaseBills = await PurchaseBill.find({
            company: companyId,
            fiscalYear: fiscalYear,
            account: accountId,
            ...dateFilter
        }).populate('items.item');

        console.log('=== PURCHASE BILLS ===');
        purchaseBills.forEach(bill => {
            console.log(`Purchase Bill ${bill.billNumber}:`, {
                taxableAmount: bill.taxableAmount,
                vatAmount: bill.vatAmount,
                nonVatPurchase: bill.nonVatPurchase || 0,
                totalAmount: bill.totalAmount,
                isVatExempt: bill.isVatExempt
            });

            // SIMPLE LOGIC: Use the amounts as they are in the bill
            summary.taxablePurchase += bill.taxableAmount || 0;
            summary.taxablePurchaseVAT += bill.vatAmount || 0;
            summary.nonTaxablePurchase += bill.nonVatPurchase || 0;

            // Calculate balance change for purchase bills
            // For purchases, the party account is credited (decreases balance)
            const balanceChange = -(bill.totalAmount || 0);
            runningBalance += balanceChange;

            console.log(`Added Purchase - Taxable: ${bill.taxableAmount}, VAT: ${bill.vatAmount}, Non-Taxable: ${bill.nonVatPurchase}, Balance Change: ${balanceChange}`);
        });

        // ==================== SALES RETURNS ====================
        const salesReturns = await SalesReturn.find({
            company: companyId,
            fiscalYear: fiscalYear,
            account: accountId,
            ...dateFilter
        }).populate('items.item');

        console.log('=== SALES RETURNS ===');
        salesReturns.forEach(returnBill => {
            console.log(`Sales Return ${returnBill.billNumber}:`, {
                taxableAmount: returnBill.taxableAmount,
                vatAmount: returnBill.vatAmount,
                nonVatSalesReturn: returnBill.nonVatSalesReturn || 0,
                totalAmount: returnBill.totalAmount,
                isVatExempt: returnBill.isVatExempt
            });

            // SIMPLE LOGIC: Use the amounts as they are in the return bill
            summary.salesReturn += returnBill.taxableAmount || 0;
            summary.salesReturnVAT += returnBill.vatAmount || 0;
            // For returns, non-taxable returns are also part of salesReturn amount
            summary.salesReturn += returnBill.nonVatSalesReturn || 0;

            // Calculate balance change for sales returns
            // For sales returns, the party account is credited (decreases balance)
            const balanceChange = -(returnBill.totalAmount || 0);
            runningBalance += balanceChange;

            console.log(`Added Sales Return - Taxable: ${returnBill.taxableAmount}, VAT: ${returnBill.vatAmount}, Non-Taxable: ${returnBill.nonVatSalesReturn}, Balance Change: ${balanceChange}`);
        });

        // ==================== PURCHASE RETURNS ====================
        const purchaseReturns = await PurchaseReturn.find({
            company: companyId,
            fiscalYear: fiscalYear,
            account: accountId,
            ...dateFilter
        }).populate('items.item');

        console.log('=== PURCHASE RETURNS ===');
        purchaseReturns.forEach(returnBill => {
            console.log(`Purchase Return ${returnBill.billNumber}:`, {
                taxableAmount: returnBill.taxableAmount,
                vatAmount: returnBill.vatAmount,
                nonVatPurchaseReturn: returnBill.nonVatPurchaseReturn || 0,
                totalAmount: returnBill.totalAmount,
                isVatExempt: returnBill.isVatExempt
            });

            // SIMPLE LOGIC: Use the amounts as they are in the return bill
            summary.purchaseReturn += returnBill.taxableAmount || 0;
            summary.purchaseReturnVAT += returnBill.vatAmount || 0;
            // For returns, non-taxable returns are also part of purchaseReturn amount
            summary.purchaseReturn += returnBill.nonVatPurchaseReturn || 0;

            // Calculate balance change for purchase returns
            // For purchase returns, the party account is debited (increases balance)
            const balanceChange = returnBill.totalAmount || 0;
            runningBalance += balanceChange;

            console.log(`Added Purchase Return - Taxable: ${returnBill.taxableAmount}, VAT: ${returnBill.vatAmount}, Non-Taxable: ${returnBill.nonVatPurchaseReturn}, Balance Change: +${balanceChange}`);
        });

        // ==================== PAYMENTS ====================
        const payments = await Payment.find({
            company: companyId,
            fiscalYear: fiscalYear,
            $or: [
                { account: accountId },
                { paymentAccount: accountId }
            ],
            status: 'active',
            isActive: true,
            ...dateFilter
        }).populate('account').populate('paymentAccount');

        console.log('=== PAYMENTS ===');
        console.log(`Found ${payments.length} payments`);

        payments.forEach(payment => {
            console.log(`Payment ${payment.billNumber}:`, {
                debit: payment.debit,
                credit: payment.credit,
                account: payment.account?._id,
                paymentAccount: payment.paymentAccount?._id,
                accountName: payment.account?.name,
                paymentAccountName: payment.paymentAccount?.name
            });

            let paymentAmount = 0;
            let balanceChange = 0;

            if (payment.account && payment.account._id.toString() === accountId) {
                // Party is receiving payment (we are paying them)
                // In payment voucher, when we pay party: debit=amount, credit=0
                paymentAmount = payment.debit || 0;
                balanceChange = -paymentAmount; // Party's balance decreases
                console.log(`Party receiving payment - We pay them ${paymentAmount}, Balance decreases`);
            } else if (payment.paymentAccount && payment.paymentAccount._id.toString() === accountId) {
                // Party is making payment (they are paying us)
                // In payment voucher, when party pays us: debit=0, credit=amount
                paymentAmount = payment.debit || 0;
                balanceChange = paymentAmount; // Party's balance increases
                console.log(`Party making payment - They pay us ${paymentAmount}, Balance increases`);
            }

            summary.payments -= paymentAmount;
            runningBalance -= balanceChange;

            console.log(`Added Payment - Amount: ${paymentAmount}, Balance Change: ${balanceChange}, Running Balance: ${runningBalance}`);
        });

        // ==================== RECEIPTS ====================
        const receipts = await Receipt.find({
            company: companyId,
            fiscalYear: fiscalYear,
            $or: [
                { account: accountId },
                { receiptAccount: accountId }
            ],
            status: 'active',
            isActive: true,
            ...dateFilter
        }).populate('account').populate('receiptAccount');

        console.log('=== RECEIPTS ===');
        console.log(`Found ${receipts.length} receipts`);

        receipts.forEach(receipt => {
            console.log(`Receipt ${receipt.billNumber}:`, {
                debit: receipt.debit,
                credit: receipt.credit,
                account: receipt.account?._id,
                receiptAccount: receipt.receiptAccount?._id,
                accountName: receipt.account?.name,
                receiptAccountName: receipt.receiptAccount?.name
            });

            let receiptAmount = 0;
            let balanceChange = 0;

            if (receipt.account && receipt.account._id.toString() === accountId) {
                // Party is making receipt (they are paying us)
                // In receipt voucher, when party pays us: debit=amount, credit=0
                receiptAmount = receipt.credit || 0;
                balanceChange = receiptAmount; // Party's balance increases
                console.log(`Party making receipt - They pay us ${receiptAmount}, Balance increases`);
            } else if (receipt.receiptAccount && receipt.receiptAccount._id.toString() === accountId) {
                // Party is receiving receipt (we are paying them)
                // In receipt voucher, when we pay party: debit=0, credit=amount
                receiptAmount = receipt.credit || 0;
                balanceChange = -receiptAmount; // Party's balance decreases
                console.log(`Party receiving receipt - We pay them ${receiptAmount}, Balance decreases`);
            }

            summary.receipts -= receiptAmount;
            runningBalance -= balanceChange;

            console.log(`Added Receipt - Amount: ${receiptAmount}, Balance Change: ${balanceChange}, Running Balance: ${runningBalance}`);
        });

        // ==================== JOURNAL VOUCHERS ====================
        const journalVouchers = await JournalVoucher.find({
            company: companyId,
            fiscalYear: fiscalYear,
            status: 'active',
            isActive: true,
            ...dateFilter
        })
            .populate('debitAccounts.account')
            .populate('creditAccounts.account');

        console.log('=== JOURNAL VOUCHERS ===');
        console.log(`Found ${journalVouchers.length} journal vouchers`);

        journalVouchers.forEach(journal => {
            console.log(`Journal Voucher ${journal.billNumber}:`, {
                debitAccounts: journal.debitAccounts.map(da => ({
                    accountId: da.account?._id?.toString(),
                    accountName: da.account?.name,
                    debit: da.debit
                })),
                creditAccounts: journal.creditAccounts.map(ca => ({
                    accountId: ca.account?._id?.toString(),
                    accountName: ca.account?.name,
                    credit: ca.credit
                }))
            });

            let journalDebit = 0;
            let journalCredit = 0;
            let balanceChange = 0;

            // Check if party is in debit accounts
            journal.debitAccounts.forEach(debitAccount => {
                if (debitAccount.account && debitAccount.account._id.toString() === accountId) {
                    journalDebit += debitAccount.debit || 0;
                    balanceChange += debitAccount.debit || 0; // Debit increases balance
                    console.log(`Party in debit - Debit: ${debitAccount.debit}, Balance increases`);
                }
            });

            // Check if party is in credit accounts
            journal.creditAccounts.forEach(creditAccount => {
                if (creditAccount.account && creditAccount.account._id.toString() === accountId) {
                    journalCredit += creditAccount.credit || 0;
                    balanceChange -= creditAccount.credit || 0; // Credit decreases balance
                    console.log(`Party in credit - Credit: ${creditAccount.credit}, Balance decreases`);
                }
            });

            summary.journalDebit += journalDebit;
            summary.journalCredit += journalCredit;
            runningBalance += balanceChange;

            console.log(`Added Journal - Debit: ${journalDebit}, Credit: ${journalCredit}, Balance Change: ${balanceChange}, Running Balance: ${runningBalance}`);
        });

        // ==================== DEBIT NOTES ====================
        const debitNotes = await DebitNote.find({
            company: companyId,
            fiscalYear: fiscalYear,
            status: 'active',
            isActive: true,
            ...dateFilter
        })
            .populate('debitAccounts.account')
            .populate('creditAccounts.account');

        console.log('=== DEBIT NOTES ===');
        console.log(`Found ${debitNotes.length} debit notes`);

        debitNotes.forEach(debitNote => {
            console.log(`Debit Note ${debitNote.billNumber}:`, {
                debitAccounts: debitNote.debitAccounts.map(da => ({
                    accountId: da.account?._id?.toString(),
                    accountName: da.account?.name,
                    debit: da.debit
                })),
                creditAccounts: debitNote.creditAccounts.map(ca => ({
                    accountId: ca.account?._id?.toString(),
                    accountName: ca.account?.name,
                    credit: ca.credit
                }))
            });

            let debitNoteAmount = 0;
            let balanceChange = 0;

            // Check if party is in debit accounts
            debitNote.debitAccounts.forEach(debitAccount => {
                if (debitAccount.account && debitAccount.account._id.toString() === accountId) {
                    debitNoteAmount += debitAccount.debit || 0;
                    balanceChange += debitAccount.debit || 0; // Debit increases balance
                    console.log(`Party in debit - Debit: ${debitAccount.debit}, Balance increases`);
                }
            });

            // Check if party is in credit accounts
            debitNote.creditAccounts.forEach(creditAccount => {
                if (creditAccount.account && creditAccount.account._id.toString() === accountId) {
                    debitNoteAmount += creditAccount.credit || 0;
                    balanceChange -= creditAccount.credit || 0; // Credit decreases balance
                    console.log(`Party in credit - Credit: ${creditAccount.credit}, Balance decreases`);
                }
            });

            summary.debitNotes += debitNoteAmount;
            runningBalance += balanceChange;

            console.log(`Added Debit Note - Amount: ${debitNoteAmount}, Balance Change: ${balanceChange}, Running Balance: ${runningBalance}`);
        });


        // ==================== CREDIT NOTES ====================
        const creditNotes = await CreditNote.find({
            company: companyId,
            fiscalYear: fiscalYear,
            status: 'active',
            isActive: true,
            ...dateFilter
        })
            .populate('debitAccounts.account')
            .populate('creditAccounts.account');

        console.log('=== CREDIT NOTES ===');
        console.log(`Found ${creditNotes.length} credit notes`);

        creditNotes.forEach(creditNote => {
            console.log(`Credit Note ${creditNote.billNumber}:`, {
                debitAccounts: creditNote.debitAccounts.map(da => ({
                    accountId: da.account?._id?.toString(),
                    accountName: da.account?.name,
                    debit: da.debit
                })),
                creditAccounts: creditNote.creditAccounts.map(ca => ({
                    accountId: ca.account?._id?.toString(),
                    accountName: ca.account?.name,
                    credit: ca.credit
                }))
            });

            let creditNoteAmount = 0;
            let balanceChange = 0;

            // Check if party is in debit accounts
            creditNote.debitAccounts.forEach(debitAccount => {
                if (debitAccount.account && debitAccount.account._id.toString() === accountId) {
                    creditNoteAmount += debitAccount.debit || 0;
                    balanceChange += debitAccount.debit || 0; // Debit increases balance
                    console.log(`Party in debit - Debit: ${debitAccount.debit}, Balance increases`);
                }
            });

            // Check if party is in credit accounts
            creditNote.creditAccounts.forEach(creditAccount => {
                if (creditAccount.account && creditAccount.account._id.toString() === accountId) {
                    creditNoteAmount += creditAccount.credit || 0;
                    balanceChange -= creditAccount.credit || 0; // Credit decreases balance
                    console.log(`Party in credit - Credit: ${creditAccount.credit}, Balance decreases`);
                }
            });

            summary.creditNotes += creditNoteAmount;
            runningBalance += balanceChange;

            console.log(`Added Credit Note - Amount: ${creditNoteAmount}, Balance Change: ${balanceChange}, Running Balance: ${runningBalance}`);
        });


        // Since we removed transaction model, we need to handle these separately
        // You'll need to add similar sections for Journal, DebitNote, CreditNote models if they exist
        // For now, we'll keep them as 0 since we don't have the direct models

        console.log('=== OTHER TRANSACTIONS ===');
        console.log('Note: Journals, Debit Notes, Credit Notes processing would be added here if direct models exist');

        summary.closingBalance = runningBalance;

        // Calculate net values
        const netSales = summary.taxableSales + summary.nonTaxableSales - summary.salesReturn;
        const netSalesVAT = summary.taxableSalesVAT - summary.salesReturnVAT;
        const netPurchase = summary.taxablePurchase + summary.nonTaxablePurchase - summary.purchaseReturn;
        const netPurchaseVAT = summary.taxablePurchaseVAT - summary.purchaseReturnVAT;

        // Calculate net payment/receipt effect
        const netPaymentReceipt = summary.receipts - summary.payments;

        // Final debug output
        console.log('=== FINAL SUMMARY ===');
        console.log('Balance Calculation:', {
            openingBalance: summary.openingBalance,
            closingBalance: summary.closingBalance,
            runningBalance: runningBalance
        });
        console.log('Sales Summary:', {
            taxableSales: summary.taxableSales,
            taxableSalesVAT: summary.taxableSalesVAT,
            nonTaxableSales: summary.nonTaxableSales,
            salesReturn: summary.salesReturn,
            salesReturnVAT: summary.salesReturnVAT,
            netSales: netSales,
            netSalesVAT: netSalesVAT
        });

        console.log('Purchase Summary:', {
            taxablePurchase: summary.taxablePurchase,
            taxablePurchaseVAT: summary.taxablePurchaseVAT,
            nonTaxablePurchase: summary.nonTaxablePurchase,
            purchaseReturn: summary.purchaseReturn,
            purchaseReturnVAT: summary.purchaseReturnVAT,
            netPurchase: netPurchase,
            netPurchaseVAT: netPurchaseVAT
        });

        console.log('Payment/Receipt Summary:', {
            payments: summary.payments,
            receipts: summary.receipts,
            netPaymentReceipt: netPaymentReceipt
        });

        res.json({
            company: {
                name: company.name,
                address: company.address,
                phone: company.phone,
                companyGroups: company.companyGroups,
                pan: company.pan
            },
            party: {
                name: party.name,
                address: party.address,
                pan: party.pan,
                phone: party.phone,
                companyGroups: party.companyGroups,
                uniqueNumber: party.uniqueNumber
            },
            fiscalYear: req.session.currentFiscalYear.name, // Fixed: changed from req.currentFiscalYear
            period: {
                start: startDate || req.session.currentFiscalYear.startDate, // Fixed: changed from req.currentFiscalYear
                end: endDate || req.session.currentFiscalYear.endDate // Fixed: changed from req.currentFiscalYear
            },
            summary: {
                ...summary,
                netSales,
                netSalesVAT,
                netPurchase,
                netPurchaseVAT,
                netPaymentReceipt,
                transactionCount: 0, // Since we removed transactions
                salesBillCount: salesBills.length,
                purchaseBillCount: purchaseBills.length,
                salesReturnCount: salesReturns.length,
                purchaseReturnCount: purchaseReturns.length,
                paymentCount: payments.length,
                receiptCount: receipts.length
            },
            generatedDate: new Date()
        });

    } catch (error) {
        console.error('Error in party-summary:', error);
        res.status(500).json({ message: error.message });
    }
});

function getTransactionDescription(transaction) {
    const typeMap = {
        'Purc': 'Purchase',
        'PrRt': 'Purchase Return',
        'Sale': 'Sales',
        'SlRt': 'Sales Return',
        'Pymt': 'Payment',
        'Rcpt': 'Receipt',
        'Jrnl': 'Journal Entry',
        'DrNt': 'Debit Note',
        'CrNt': 'Credit Note',
        'stockAdjustment': 'Stock Adjustment',
        'Opening Balance': 'Opening Balance'
    };

    let description = typeMap[transaction.type] || transaction.type;

    if (transaction.billNumber) {
        description += ` - ${transaction.billNumber}`;
    }

    if (transaction.billId && transaction.billId.billNumber) {
        description += ` (Bill: ${transaction.billId.billNumber})`;
    }

    if (transaction.purchaseBillId && transaction.purchaseBillId.billNumber) {
        description += ` (Purchase Bill: ${transaction.purchaseBillId.billNumber})`;
    }

    return description;
}

// Get detailed transactions for a party (optional - for debugging)
router.get('/party-transactions-detail/:accountId', ensureFiscalYear, async (req, res) => {
    try {
        const { accountId } = req.params;
        const fiscalYear = req.fiscalYear;
        const companyId = req.session.currentCompany;

        const query = {
            $or: [
                { account: accountId },
                { paymentAccount: accountId },
                { receiptAccount: accountId },
                { debitAccount: accountId },
                { creditAccount: accountId }
            ],
            fiscalYear: fiscalYear,
            status: 'active',
            isActive: true,
            company: companyId
        };

        const transactions = await Transaction.find(query)
            .populate('billId', 'billNumber isVatExempt')
            .populate('purchaseBillId', 'billNumber isVatExempt')
            .populate('salesReturnBillId', 'billNumber')
            .populate('purchaseReturnBillId', 'billNumber')
            .populate('journalBillId', 'billNumber')
            .populate('debitNoteId', 'billNumber')
            .populate('creditNoteId', 'billNumber')
            .populate('paymentAccountId', 'billNumber')
            .populate('receiptAccountId', 'billNumber')
            .populate('account', 'name')
            .populate('paymentAccount', 'name')
            .populate('receiptAccount', 'name')
            .populate('debitAccount', 'name')
            .populate('creditAccount', 'name')
            .sort({ date: 1 })
            .select('date type isType billNumber debit credit vatDetails billId purchaseBillId account paymentAccount receiptAccount debitAccount creditAccount');

        res.json({
            transactions: transactions.map(t => ({
                date: t.date,
                type: t.type,
                isType: t.isType,
                billNumber: t.billNumber,
                debit: t.debit,
                credit: t.credit,
                vatAmount: t.vatDetails?.vatAmount,
                account: t.account?.name,
                paymentAccount: t.paymentAccount?.name,
                receiptAccount: t.receiptAccount?.name,
                debitAccount: t.debitAccount?.name,
                creditAccount: t.creditAccount?.name,
                salesBill: t.billId?.billNumber,
                purchaseBill: t.purchaseBillId?.billNumber,
                description: getTransactionDescription(t)
            }))
        });

    } catch (error) {
        console.error('Error in party-transactions-detail:', error);
        res.status(500).json({ message: error.message });
    }
});

// // Get all parties for confirmation
// router.get('/parties', ensureFiscalYear, async (req, res) => {
//     try {
//         const companyId = req.session.currentCompany;
//         const { search } = req.query;

//         const query = {
//             company: companyId,
//             isActive: true
//         };

//         if (search) {
//             query.$or = [
//                 { name: { $regex: search, $options: 'i' } },
//                 { pan: { $regex: search, $options: 'i' } }
//             ];
//         }

//         const parties = await Account.find(query)
//             .select('name pan address phone uniqueNumber openingBalanceByFiscalYear companyGroups')
//             .populate('companyGroups', 'name')
//             .sort({ name: 1 })

//         res.json(parties);
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

// Get all parties for confirmation (only Sundry Debtors and Sundry Creditors)
router.get('/parties', ensureFiscalYear, async (req, res) => {
    try {
        console.log('=== /parties route called ===');
        const companyId = req.session.currentCompany;
        const { search } = req.query;

        console.log('Company ID:', companyId);
        console.log('Search term:', search);

        if (!companyId) {
            return res.status(400).json({ 
                message: 'Company not selected in session' 
            });
        }

        // First, find the Sundry Debtors and Sundry Creditors company groups
        const relevantGroups = await CompanyGroup.find({
            company: companyId,
            name: { $in: ['Sundry Debtors', 'Sundry Creditors'] }
        }).select('_id').exec();

        console.log('Found relevant groups:', relevantGroups);

        // If no groups found, return empty array instead of error
        const relevantGroupIds = relevantGroups.map(group => group._id);
        
        if (relevantGroupIds.length === 0) {
            console.log('No Sundry Debtors/Creditors groups found, returning empty array');
            return res.json([]);
        }

        // Build the query
        const query = {
            company: companyId,
            isActive: true,
            companyGroups: { $in: relevantGroupIds }
        };

        if (search && search.trim() !== '') {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { pan: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('Final query:', JSON.stringify(query));

        const parties = await Account.find(query)
            .select('name pan address phone uniqueNumber openingBalanceByFiscalYear companyGroups')
            .populate('companyGroups', 'name')
            .sort({ name: 1 })
            .limit(100)
            .lean(); // Added lean() for better performance

        console.log(`Found ${parties.length} parties`);

        res.json(parties);

    } catch (error) {
        console.error('Error in /parties route:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;