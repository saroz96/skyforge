import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../../stylesheet/retailer/salesReturn/List.css';
import Header from '../Header';
import NepaliDate from 'nepali-date';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';

const SalesReturnList = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY/MM/DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];

    const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [data, setData] = useState(() => {
        if (draftSave && draftSave.salesReturnData) {
            return draftSave.salesReturnData;
        }
        // Default to current fiscal year start date if available
        const initialFromDate = data.currentFiscalYear?.startDate ||
            (company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate);
        return {
            company: null,
            currentFiscalYear: null,
            currentCompany: null,
            currentCompanyName: '',
            companyDateFormat: 'english',
            bills: [],
            fromDate: initialFromDate,
            toDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
            isAdminOrSupervisor: false
        };
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentModeFilter, setPaymentModeFilter] = useState('');
    const [totals, setTotals] = useState({
        subTotal: 0,
        discount: 0,
        taxable: 0,
        vat: 0,
        roundOff: 0,
        amount: 0
    });
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const [filteredBills, setFilteredBills] = useState([]);

    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);
    const searchInputRef = useRef(null);
    const paymentModeFilterRef = useRef(null);
    const generateReportRef = useRef(null);
    const tableBodyRef = useRef(null);
    const [shouldFetch, setShouldFetch] = useState(false);
    const navigate = useNavigate();

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        if (data.bills.length > 0 || data.fromDate || data.toDate) {
            setDraftSave({
                ...draftSave,
                salesReturnData: data
            });
        }
    }, [data]);

    // Fetch data when generate report is clicked
    useEffect(() => {
        const fetchData = async () => {
            if (!shouldFetch) return;

            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (data.fromDate) params.append('fromDate', data.fromDate);
                if (data.toDate) params.append('toDate', data.toDate);

                const response = await api.get(`api/retailer/sales-return/register?${params.toString()}`);
                setData({
                    ...response.data.data,
                    isAdminOrSupervisor: response.data.data.isAdminOrSupervisor
                });
                setError(null);
                setSelectedRowIndex(0); // Reset selection when new data loads
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch sales return bills');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchData();
    }, [shouldFetch, data.fromDate, data.toDate]);

    // Filter bills based on search and payment mode
    useEffect(() => {
        const filtered = data.bills.filter(bill => {
            const matchesSearch =
                bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (bill.account?.name || bill.cashAccount || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                bill.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesPaymentMode =
                paymentModeFilter === '' ||
                bill.paymentMode?.toLowerCase() === paymentModeFilter.toLowerCase();

            return matchesSearch && matchesPaymentMode;
        });

        setFilteredBills(filtered);
        // Reset selected row when filters change
        setSelectedRowIndex(0);
    }, [data.bills, searchQuery, paymentModeFilter]);

    // Calculate totals when filtered bills change
    useEffect(() => {
        if (filteredBills.length === 0) {
            setTotals({
                subTotal: 0,
                discount: 0,
                taxable: 0,
                vat: 0,
                roundOff: 0,
                amount: 0
            });
            return;
        }

        const newTotals = filteredBills.reduce((acc, bill) => {
            return {
                subTotal: acc.subTotal + (bill.subTotal || 0),
                discount: acc.discount + (bill.discountAmount || 0),
                taxable: acc.taxable + (bill.taxableAmount || 0),
                vat: acc.vat + (bill.vatAmount || 0),
                roundOff: acc.roundOff + (bill.roundOffAmount || 0),
                amount: acc.amount + (bill.totalAmount || 0)
            };
        }, {
            subTotal: 0,
            discount: 0,
            taxable: 0,
            vat: 0,
            roundOff: 0,
            amount: 0
        });

        setTotals(newTotals);
    }, [filteredBills]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (filteredBills.length === 0) return;

            // Check if focus is inside an input or select element
            const activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
                return;
            }

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedRowIndex(prev => Math.min(filteredBills.length - 1, prev + 1));
                    break;
                case 'Enter':
                    if (selectedRowIndex >= 0 && selectedRowIndex < filteredBills.length) {
                        navigate(`/api/retailer/sales-return/${filteredBills[selectedRowIndex]._id}/print`);
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredBills, selectedRowIndex, navigate]);

    // Scroll to selected row
    useEffect(() => {
        if (tableBodyRef.current && filteredBills.length > 0) {
            const rows = tableBodyRef.current.querySelectorAll('tr');
            if (rows.length > selectedRowIndex) {
                rows[selectedRowIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredBills]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = () => {
        if (!data.fromDate || !data.toDate) {
            setError('Please select both from and to dates');
            return;
        }
        setShouldFetch(true);
    };

    const handlePrint = (filtered = false) => {
        const rowsToPrint = filtered ? filteredBills : data.bills;

        if (rowsToPrint.length === 0) {
            alert("No bills to print");
            return;
        }

        const printWindow = window.open("", "_blank");
        const printHeader = `
            <div class="print-header">
                <h1>${data.currentCompanyName || 'Company Name'}</h1>
                <p>
                    ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''},
                    ${data.currentCompany?.country || ''}<br>
                    Tel.: ${data.currentCompany?.phone || ''}, Email: ${data.currentCompany?.email || ''}<br>
                    TPIN: ${data.currentCompany?.pan || ''}
                </p>
                <hr>
            </div>
        `;

        let tableContent = `
        <style>
            @page {
                size: A4 landscape;
                margin: 10mm;
            }
            body { 
                font-family: Arial, sans-serif; 
                font-size: 10px; 
                margin: 0;
                padding: 10mm;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                page-break-inside: auto;
            }
            tr { 
                page-break-inside: avoid; 
                page-break-after: auto; 
            }
            th, td { 
                border: 1px solid #000; 
                padding: 4px; 
                text-align: left; 
                white-space: nowrap;
            }
            th { 
                background-color: #f2f2f2 !important; 
                -webkit-print-color-adjust: exact; 
            }
            .print-header { 
                text-align: center; 
                margin-bottom: 15px; 
            }
            .nowrap {
                white-space: nowrap;
            }
        </style>
        ${printHeader}
        <h1 style="text-align:center;text-decoration:underline;">Sales Return's Register</h1>
        <table>
            <thead>
                <tr>
                    <th class="nowrap">Date</th>
                    <th class="nowrap">Vch. No.</th>
                    <th class="nowrap">Party Name</th>
                    <th class="nowrap">Pay Mode</th>
                    <th class="nowrap">Sub Total</th>
                    <th class="nowrap">Discount</th>
                    <th class="nowrap">Taxable</th>
                    <th class="nowrap">VAT</th>
                    <th class="nowrap">Off(-/+)</th>
                    <th class="nowrap">Total</th>
                    <th class="nowrap">User</th>
                </tr>
            </thead>
            <tbody>
        `;

        let totals = {
            subTotal: 0,
            discount: 0,
            taxable: 0,
            vat: 0,
            roundOff: 0,
            amount: 0
        };

        rowsToPrint.forEach(bill => {
            tableContent += `
            <tr>
                <td class="nowrap">${new Date(bill.date).toLocaleDateString()}</td>
                <td class="nowrap">${bill.billNumber}</td>
                <td class="nowrap">${bill.account?.name || bill.cashAccount || 'N/A'}</td>
                <td class="nowrap">${bill.paymentMode}</td>
                <td class="nowrap">${bill.subTotal?.toFixed(2)}</td>
                <td class="nowrap">${bill.discountPercentage?.toFixed(2)}% - ${bill.discountAmount?.toFixed(2)}</td>
                <td class="nowrap">${bill.taxableAmount?.toFixed(2)}</td>
                <td class="nowrap">${bill.vatPercentage?.toFixed(2)}% - ${bill.vatAmount?.toFixed(2)}</td>
                <td class="nowrap">${bill.roundOffAmount?.toFixed(2)}</td>
                <td class="nowrap">${bill.totalAmount?.toFixed(2)}</td>
                <td class="nowrap">${bill.user?.name || 'N/A'}</td>
            </tr>
            `;

            totals.subTotal += parseFloat(bill.subTotal || 0);
            totals.discount += parseFloat(bill.discountAmount || 0);
            totals.taxable += parseFloat(bill.taxableAmount || 0);
            totals.vat += parseFloat(bill.vatAmount || 0);
            totals.roundOff += parseFloat(bill.roundOffAmount || 0);
            totals.amount += parseFloat(bill.totalAmount || 0);
        });

        // Add final totals row
        tableContent += `
            <tr style="font-weight:bold; border-top: 2px solid #000;">
                <td colspan="4">Grand Totals</td>
                <td>${totals.subTotal.toFixed(2)}</td>
                <td>${totals.discount.toFixed(2)}</td>
                <td>${totals.taxable.toFixed(2)}</td>
                <td>${totals.vat.toFixed(2)}</td>
                <td>${totals.roundOff.toFixed(2)}</td>
                <td>${totals.amount.toFixed(2)}</td>
                <td></td>
            </tr>
            </tbody>
        </table>
        `;

        printWindow.document.write(`
        <html>
            <head>
                <title>Sales Return's Register</title>
            </head>
            <body>
                ${tableContent}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 200);
                    };
                <\/script>
            </body>
        </html>
        `);
        printWindow.document.close();
    };

    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toFixed(2);
    };

    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    const handleRowDoubleClick = (billId) => {
        navigate(`/api/retailer/sales-return/${billId}/print`);
    };

    const handleKeyDown = (e, nextFieldId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldId) {
                const nextField = document.getElementById(nextFieldId);
                if (nextField) {
                    nextField.focus();
                }
            } else {
                // If no nextFieldId provided, try to find the next focusable element
                const focusableElements = Array.from(
                    document.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
                ).filter(el => !el.disabled && el.offsetParent !== null);

                const currentIndex = focusableElements.findIndex(el => el === e.target);

                if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
                    focusableElements[currentIndex + 1].focus();
                }
            }
        }
    };

    if (loading) {
        return <div className="text-center py-5">Loading...</div>;
    }

    if (error) {
        return <div className="alert alert-danger text-center py-5">{error}</div>;
    }

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Sales Return's Register</h1>
                </div>

                <div className="card-body">
                    {/* Search and Filter Section */}
                    <div className="row mb-4">
                        <div className="col-md-8">
                            <div className="row g-3">
                                {/* Date Range Row */}
                                <div className="col">
                                    <label htmlFor="fromDate" className="form-label">From Date</label>
                                    <input
                                        type="date"
                                        name="fromDate"
                                        id="fromDate"
                                        ref={company.dateFormat === 'nepali' ? fromDateRef : null}
                                        className="form-control"
                                        value={data.fromDate ?
                                            new Date(data.fromDate).toISOString().split('T')[0] :
                                            ''}
                                        onChange={handleDateChange}
                                        required
                                        autoFocus
                                        autoComplete='off'
                                        onKeyDown={(e) => handleKeyDown(e, 'toDate')}
                                    />
                                </div>
                                <div className="col">
                                    <label htmlFor="toDate" className="form-label">To Date</label>
                                    <input
                                        type="date"
                                        name="toDate"
                                        id="toDate"
                                        ref={toDateRef}
                                        className="form-control"
                                        value={data.toDate ?
                                            new Date(data.toDate).toISOString().split('T')[0] :
                                            ''}
                                        onChange={handleDateChange}
                                        required
                                        autoComplete='off'
                                        onKeyDown={(e) => handleKeyDown(e, 'generateReport')}
                                    />
                                </div>
                                <div className="col-md-2 d-flex align-items-end">
                                    <button
                                        type="button"
                                        id="generateReport"
                                        ref={generateReportRef}
                                        className="btn btn-primary w-100"
                                        onClick={handleGenerateReport}
                                    >
                                        <i className="fas fa-chart-line me-2"></i>Generate
                                    </button>
                                </div>

                                {/* Search Row */}
                                <div className="col-md-4">
                                    <label htmlFor="searchInput" className="form-label">Search</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="searchInput"
                                            ref={searchInputRef}
                                            placeholder="Search by voucher number, party name or user..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            disabled={data.bills.length === 0}
                                            autoComplete='off'
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            disabled={data.bills.length === 0}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Payment Mode Filter Row */}
                                <div className="col">
                                    <label htmlFor="paymentModeFilter" className="form-label">Payment Mode</label>
                                    <select
                                        className="form-select"
                                        id="paymentModeFilter"
                                        ref={paymentModeFilterRef}
                                        value={paymentModeFilter}
                                        onChange={(e) => setPaymentModeFilter(e.target.value)}
                                        disabled={data.bills.length === 0}
                                    >
                                        <option value="">All</option>
                                        <option value="cash">Cash</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="col-md-4 d-flex align-items-end justify-content-end gap-2">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/api/retailer/sales-return')}
                            >
                                <i className="fas fa-receipt me-2"></i>New Voucher
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(false)}
                                disabled={data.bills.length === 0}
                            >
                                <i className="fas fa-print"></i>Print All
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handlePrint(true)}
                                disabled={data.bills.length === 0}
                            >
                                <i className="fas fa-filter"></i>Print Filtered
                            </button>
                        </div>
                    </div>

                    {data.bills.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            Please select date range and click "Generate Report" to view data
                        </div>
                    ) : (
                        <>
                            {/* Bills Table */}
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vch. No.</th>
                                            <th>Party Name</th>
                                            <th>Pay Mode</th>
                                            <th className="text-end">Sub Total</th>
                                            <th className="text-end">Discount</th>
                                            <th className="text-end">Taxable</th>
                                            <th className="text-end">VAT</th>
                                            <th className="text-end">Off(-/+)</th>
                                            <th className="text-end">Total</th>
                                            <th>User</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody ref={tableBodyRef}>
                                        {filteredBills.map((bill, index) => (
                                            <tr
                                                key={bill._id}
                                                className={`bill-row ${selectedRowIndex === index ? 'highlighted-row' : ''}`}
                                                onClick={() => handleRowClick(index)}
                                                onDoubleClick={() => handleRowDoubleClick(bill._id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td className="compact-cell">{new Date(bill.date).toLocaleDateString()}</td>
                                                <td className="compact-cell">{bill.billNumber}</td>
                                                <td className="compact-cell">{bill.account?.name || bill.cashAccount || 'N/A'}</td>
                                                <td className="compact-cell">{bill.paymentMode}</td>
                                                <td className="compact-cell text-end">{formatCurrency(bill.subTotal)}</td>
                                                <td className="compact-cell text-end">
                                                    {formatCurrency(bill.discountPercentage)}% - {formatCurrency(bill.discountAmount)}
                                                </td>
                                                <td className="compact-cell text-end">{formatCurrency(bill.taxableAmount)}</td>
                                                <td className="compact-cell text-end">
                                                    {formatCurrency(bill.vatPercentage)}% - {formatCurrency(bill.vatAmount)}
                                                </td>
                                                <td className="compact-cell text-end">{formatCurrency(bill.roundOffAmount)}</td>
                                                <td className="compact-cell text-end">{formatCurrency(bill.totalAmount)}</td>
                                                <td>{bill.user?.name || 'N/A'}</td>
                                                <td className='compact-cell'>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/api/retailer/sales-return/${bill._id}/print`)}
                                                        >
                                                            <i className="fas fa-eye"></i>View
                                                        </button>
                                                        {bill.account?._id ? (
                                                            <button
                                                                className="btn btn-sm btn-warning"
                                                                onClick={() => navigate(`/api/retailer/sales-return/edit/${bill._id}`)}
                                                                disabled={!data.isAdminOrSupervisor}
                                                            >
                                                                <i className="fas fa-edit"></i>Edit
                                                            </button>
                                                        ) : bill.cashAccount ? (
                                                            <button
                                                                className="btn btn-sm btn-warning"
                                                                onClick={() => navigate(`/api/retailer/sales-return/editCashAccount/${bill._id}`)}
                                                                disabled={!data.isAdminOrSupervisor}
                                                            >
                                                                <i className="fas fa-edit"></i>Edit
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="fw-bold">
                                            <td colSpan="4">Total:</td>
                                            <td className="text-end">{formatCurrency(totals.subTotal)}</td>
                                            <td className="text-end">{formatCurrency(totals.discount)}</td>
                                            <td className="text-end">{formatCurrency(totals.taxable)}</td>
                                            <td className="text-end">{formatCurrency(totals.vat)}</td>
                                            <td className="text-end">{formatCurrency(totals.roundOff)}</td>
                                            <td className="text-end">{formatCurrency(totals.amount)}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesReturnList;