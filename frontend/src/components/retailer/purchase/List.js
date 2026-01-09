import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../../stylesheet/retailer/purchase/List.css';
import Header from '../Header';
import NepaliDate from 'nepali-date-converter';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';
import '../../../stylesheet/noDateIcon.css'
import '../../../stylesheet/loader.css';
import Loader from '../../Loader';
import ProductModal from '../dashboard/modals/ProductModal';

const PurchaseBillsList = () => {
    const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];
    const [showProductModal, setShowProductModal] = useState(false);
    const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();

    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [data, setData] = useState(() => {
        if (draftSave && draftSave.purchaseBillsData) {
            return draftSave.purchaseBillsData;
        }
        return {
            company: null,
            currentFiscalYear: null,
            bills: [],
            fromDate: '',
            toDate: ''
        };
    });

    const [searchQuery, setSearchQuery] = useState(() => {
        if (draftSave && draftSave.purchaseBillsSearch) {
            return draftSave.purchaseBillsSearch.searchQuery || '';
        }
        return '';
    });

    const [paymentModeFilter, setPaymentModeFilter] = useState(() => {
        if (draftSave && draftSave.purchaseBillsSearch) {
            return draftSave.purchaseBillsSearch.paymentModeFilter || '';
        }
        return '';
    });

    const [selectedRowIndex, setSelectedRowIndex] = useState(() => {
        if (draftSave && draftSave.purchaseBillsSearch) {
            return draftSave.purchaseBillsSearch.selectedRowIndex || 0;
        }
        return 0;
    });

    // Fetch company and fiscal year info when component mounts
    // useEffect(() => {
    //     const fetchInitialData = async () => {
    //         try {
    //             const response = await api.get('/api/my-company');
    //             if (response.data.success) {
    //                 const { company: companyData, currentFiscalYear } = response.data;

    //                 // Set company info
    //                 const dateFormat = companyData.dateFormat || 'english';
    //                 setCompany({
    //                     dateFormat,
    //                     isVatExempt: companyData.isVatExempt || false,
    //                     vatEnabled: companyData.vatEnabled !== false, // default true
    //                     fiscalYear: currentFiscalYear || {}
    //                 });

    //                 // Set dates based on fiscal year
    //                 if (currentFiscalYear?.startDate) {
    //                     setData(prev => ({
    //                         ...prev,
    //                         fromDate: dateFormat === 'nepali'
    //                             ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
    //                             : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
    //                         toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
    //                         company: companyData,
    //                         currentFiscalYear
    //                     }));
    //                 }
    //             }
    //         } catch (err) {
    //             console.error('Error fetching initial data:', err);
    //         }
    //     };

    //     fetchInitialData();
    // }, []);

    // Fetch company and fiscal year info when component mounts
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await api.get('/api/my-company');
                if (response.data.success) {
                    const { company: companyData, currentFiscalYear } = response.data;

                    // Set company info
                    const dateFormat = companyData.dateFormat || 'english';
                    setCompany({
                        dateFormat,
                        isVatExempt: companyData.isVatExempt || false,
                        vatEnabled: companyData.vatEnabled !== false, // default true
                        fiscalYear: currentFiscalYear || {}
                    });

                    // Check if we have draft dates
                    const hasDraftDates = draftSave?.purchaseBillsData?.fromDate && draftSave?.purchaseBillsData?.toDate;

                    if (!hasDraftDates && currentFiscalYear?.startDate) {
                        // Only set default dates if we don't have draft dates
                        setData(prev => ({
                            ...prev,
                            fromDate: dateFormat === 'nepali'
                                ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
                                : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
                            toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
                            company: companyData,
                            currentFiscalYear
                        }));
                    } else {
                        // If we have draft data, ensure company info is updated
                        setData(prev => ({
                            ...prev,
                            company: companyData,
                            currentFiscalYear
                        }));
                    }
                }
            } catch (err) {
                console.error('Error fetching initial data:', err);
            }
        };

        fetchInitialData();
    }, []);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totals, setTotals] = useState({
        subTotal: 0,
        discount: 0,
        taxable: 0,
        vat: 0,
        roundOff: 0,
        amount: 0
    });
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

    // Save data and search state to draft context
    useEffect(() => {
        setDraftSave({
            ...draftSave,
            purchaseBillsData: data,
            purchaseBillsSearch: {
                searchQuery,
                paymentModeFilter,
                selectedRowIndex,
                fromDate: data.fromDate,
                toDate: data.toDate
            }
        });
    }, [data, searchQuery, paymentModeFilter, selectedRowIndex, data.fromDate, data.toDate]);

    // Fetch data when generate report is clicked
    // useEffect(() => {
    //     const fetchData = async () => {
    //         if (!shouldFetch) return;

    //         try {
    //             setLoading(true);
    //             const params = new URLSearchParams();
    //             if (data.fromDate) params.append('fromDate', data.fromDate);
    //             if (data.toDate) params.append('toDate', data.toDate);

    //             const response = await api.get(`/api/retailer/purchase-register?${params.toString()}`);
    //             setData(response.data.data);
    //             setError(null);
    //             // Don't reset selection when new data loads if we have a saved position
    //             if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
    //                 setSelectedRowIndex(0);
    //             }
    //         } catch (err) {
    //             setError(err.response?.data?.error || 'Failed to fetch purchase bills');
    //         } finally {
    //             setLoading(false);
    //             setShouldFetch(false);
    //         }
    //     };

    //     fetchData();
    // }, [shouldFetch, data.fromDate, data.toDate]);

    // Fetch data when generate report is clicked
    useEffect(() => {
        const fetchData = async () => {
            if (!shouldFetch) return;

            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (data.fromDate) params.append('fromDate', data.fromDate);
                if (data.toDate) params.append('toDate', data.toDate);

                const response = await api.get(`/api/retailer/purchase-register?${params.toString()}`);
                setData(response.data.data);
                setError(null);
                // Don't reset selection when new data loads if we have a saved position
                if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
                    setSelectedRowIndex(0);
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch purchase bills');
            } finally {
                setLoading(false);
                setShouldFetch(false);
            }
        };

        fetchData();
    }, [shouldFetch, data.fromDate, data.toDate]);

    // Filter bills based on search and payment mode
    // useEffect(() => {
    //     const filtered = data.bills.filter(bill => {
    //         const matchesSearch =
    //             bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //             bill.partyBillNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //             bill.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //             bill.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    //         const matchesPaymentMode =
    //             paymentModeFilter === '' ||
    //             bill.paymentMode?.toLowerCase() === paymentModeFilter.toLowerCase();

    //         return matchesSearch && matchesPaymentMode;
    //     });

    //     setFilteredBills(filtered);
    //     // Reset selected row when filters change, but only if we don't have a saved position
    //     if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
    //         setSelectedRowIndex(0);
    //     }
    // }, [data.bills, searchQuery, paymentModeFilter]);

    // Filter bills based on search and payment mode
    useEffect(() => {
        const filtered = data.bills.filter(bill => {
            const matchesSearch =
                bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                bill.partyBillNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                bill.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                bill.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesPaymentMode =
                paymentModeFilter === '' ||
                bill.paymentMode?.toLowerCase() === paymentModeFilter.toLowerCase();

            return matchesSearch && matchesPaymentMode;
        });

        setFilteredBills(filtered);

        // Reset selected row when filters change, but only if we don't have a saved position
        if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
            setSelectedRowIndex(0);
        }
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

    useEffect(() => {
        // Add F9 key handler here
        const handF9leKeyDown = (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                setShowProductModal(prev => !prev); // Toggle modal visibility
            }
        };
        window.addEventListener('keydown', handF9leKeyDown);
        return () => {
            window.removeEventListener('keydown', handF9leKeyDown);
        };
    }, []);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handlePaymentModeFilterChange = (e) => {
        setPaymentModeFilter(e.target.value);
    };

    const handleGenerateReport = () => {
        if (!data.fromDate || !data.toDate) {
            setError('Please select both from and to dates');
            return;
        }
        setShouldFetch(true);
    };

    const handlePrint = (filtered = false) => {
        const rowsToPrint = filtered ?
            document.querySelectorAll('.bill-row:not([style*="display: none"])') :
            document.querySelectorAll('.bill-row');
        const vatEnabled = data.company?.vatEnabled || false;
        const isVatExempt = data.company?.isVatExempt || false;
        const showVatColumns = vatEnabled && !isVatExempt;

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
                TPIN: ${data.currentCompany?.pan || ''}<br>
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
                background-color: 'N/A'f2f2f2 !important; 
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
        <h1 style="text-align:center;text-decoration:underline;">Purchase Voucher's Register</h1>
        <table>
            <thead>
                <tr>
                    <th class="nowrap">Date</th>
                    <th class="nowrap">Vch. No.</th>
                    <th class="nowrap">Inv No.</th>
                    <th class="nowrap">Suppliers Name</th>
                    <th class="nowrap">Pay Mode</th>
                    <th class="nowrap">Sub Total</th>
                    <th class="nowrap">Discount</th>
                    ${showVatColumns ? `
                    <th class="nowrap">Taxable</th>
                    <th class="nowrap">VAT</th>
                    ` : ''}
                    <th class="nowrap">Round Off</th>
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

        filteredBills.forEach(bill => {
            tableContent += `
            <tr>
                <td class="nowrap">${new Date(bill.date).toLocaleDateString()}</td>
                <td class="nowrap">${bill.billNumber}</td>
                <td class="nowrap">${bill.partyBillNumber || 'N/A'}</td>
                <td class="nowrap">${bill.account?.name || 'N/A'}</td>
                <td class="nowrap">${bill.paymentMode}</td>
                <td class="nowrap">${bill.subTotal?.toFixed(2)}</td>
                <td class="nowrap">${bill.discountPercentage?.toFixed(2)}% - ${bill.discountAmount?.toFixed(2)}</td>
                ${showVatColumns ? `
                <td class="nowrap">${bill.taxableAmount?.toFixed(2)}</td>
                <td class="nowrap">${bill.vatAmount?.toFixed(2)}</td>
                ` : ''}
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
                <td colspan="5">Grand Totals</td>
                <td>${totals.subTotal.toFixed(2)}</td>
                <td>${totals.discount.toFixed(2)}</td>
                ${showVatColumns ? `
                <td>${totals.taxable.toFixed(2)}</td>
                <td>${totals.vat.toFixed(2)}</td>
                ` : ''}
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
                <title>Purchase Voucher's Register</title>
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

    const formatCurrency = (num) => {
        const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
        if (company.dateFormat === 'nepali') {
            // Indian grouping, two decimals, English digits
            return number.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        // English (US) grouping by default
        return number.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const handleRowClick = (index) => {
        setSelectedRowIndex(index);
    };

    const handleRowDoubleClick = (billId) => {
        navigate(`/retailer/purchase/${filteredBills[selectedRowIndex]._id}/print`);
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

    if (error) {
        return <div className="alert alert-danger text-center py-5">{error}</div>;
    }

    if (loading) return <Loader />;

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Purchase Voucher's Register</h1>
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
                                        type="text"
                                        name="fromDate"
                                        id="fromDate"
                                        ref={company.dateFormat === 'nepali' ? fromDateRef : null}
                                        className="form-control no-date-icon"
                                        value={data.fromDate}
                                        onChange={handleDateChange}
                                        required
                                        autoComplete='off'
                                        onKeyDown={(e) => handleKeyDown(e, 'toDate')}
                                    />
                                </div>
                                <div className="col">
                                    <label htmlFor="toDate" className="form-label">To Date</label>
                                    <input
                                        type="text"
                                        name="toDate"
                                        id="toDate"
                                        ref={toDateRef}
                                        className="form-control no-date-icon"
                                        value={data.toDate}
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
                                        <i className="fas fa-chart-line me-2" id='generateReport'></i>Generate
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
                                            placeholder="Search bills..."
                                            value={searchQuery}
                                            onChange={handleSearchChange}
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
                                        onChange={handlePaymentModeFilterChange}
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
                                onClick={() => navigate('/retailer/purchase')}
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
                                            <th>Inv. No.</th>
                                            <th>Suppliers Name</th>
                                            <th>Pay Mode</th>
                                            <th className="text-end">Sub Total</th>
                                            <th className="text-end">Discount</th>
                                            {data.company.vatEnabled && !data.company.isVatExempt && (
                                                <>
                                                    <th className="text-end">Taxable</th>
                                                    <th className="text-end">VAT</th>
                                                </>
                                            )}
                                            <th className="text-end">Round Off</th>
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
                                                <td className="compact-cell">{new NepaliDate(bill.date).format('YYYY-MM-DD')}</td>
                                                <td className="compact-cell">{bill.billNumber}</td>
                                                <td className="compact-cell">{bill.partyBillNumber || 'N/A'}</td>
                                                <td className="compact-cell">{bill.account?.name || 'N/A'}</td>
                                                <td className="compact-cell">{bill.paymentMode}</td>
                                                <td className="compact-cell text-end">{formatCurrency(bill.subTotal)}</td>
                                                <td className="compact-cell text-end">
                                                    {formatCurrency(bill.discountPercentage)}% - {formatCurrency(bill.discountAmount)}
                                                </td>
                                                {data.company.vatEnabled && !data.company.isVatExempt && (
                                                    <>
                                                        <td className="compact-cell text-end">{formatCurrency(bill.taxableAmount)}</td>
                                                        <td className="compact-cell text-end">
                                                            {formatCurrency(bill.vatAmount)}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="compact-cell text-end">{formatCurrency(bill.roundOffAmount)}</td>
                                                <td className="compact-cell text-end">{formatCurrency(bill.totalAmount)}</td>
                                                <td>{bill.user?.name || 'N/A'}</td>
                                                <td className='compact-cell'>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => navigate(`/retailer/purchase/${bill._id}/print`)}
                                                        >
                                                            <i className="fas fa-eye"></i>View
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-warning"
                                                            onClick={() => navigate(`/retailer/purchase/edit/${bill._id}`)}
                                                        >
                                                            <i className="fas fa-edit"></i>Edit
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="fw-bold">
                                            <td colSpan="5">Total:</td>
                                            <td className="text-end">{formatCurrency(totals.subTotal)}</td>
                                            <td className="text-end">{formatCurrency(totals.discount)}</td>
                                            {data.company.vatEnabled && !data.company.isVatExempt && (
                                                <>
                                                    <td className="text-end">{formatCurrency(totals.taxable)}</td>
                                                    <td className="text-end">{formatCurrency(totals.vat)}</td>
                                                </>
                                            )}
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

            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </div>
    );
};

export default PurchaseBillsList;

// //-------------------------------------------------------------------------------
// // import React, { useState, useEffect, useRef } from 'react';
// // import { useNavigate } from 'react-router-dom';
// // import axios from 'axios';
// // import '../../../stylesheet/retailer/purchase/List.css';
// // import Header from '../Header';
// // import NepaliDate from 'nepali-date-converter';
// // import { usePageNotRefreshContext } from '../PageNotRefreshContext';
// // import '../../../stylesheet/noDateIcon.css'
// // import '../../../stylesheet/loader.css';
// // import Loader from '../../Loader';
// // import ProductModal from '../dashboard/modals/ProductModal';

// // const PurchaseBillsList = () => {
// //     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
// //     const currentEnglishDate = new Date().toISOString().split('T')[0];
// //     const [showProductModal, setShowProductModal] = useState(false);
// //     const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();

// //     const [company, setCompany] = useState({
// //         dateFormat: 'nepali',
// //         vatEnabled: true,
// //         fiscalYear: {}
// //     });

// //     const [data, setData] = useState(() => {
// //         if (draftSave && draftSave.purchaseBillsData) {
// //             return draftSave.purchaseBillsData;
// //         }
// //         return {
// //             company: null,
// //             currentFiscalYear: null,
// //             bills: [],
// //             fromDate: '',
// //             toDate: ''
// //         };
// //     });

// //     const [searchQuery, setSearchQuery] = useState(() => {
// //         if (draftSave && draftSave.purchaseBillsSearch) {
// //             return draftSave.purchaseBillsSearch.searchQuery || '';
// //         }
// //         return '';
// //     });

// //     const [paymentModeFilter, setPaymentModeFilter] = useState(() => {
// //         if (draftSave && draftSave.purchaseBillsSearch) {
// //             return draftSave.purchaseBillsSearch.paymentModeFilter || '';
// //         }
// //         return '';
// //     });

// //     const [selectedRowIndex, setSelectedRowIndex] = useState(() => {
// //         if (draftSave && draftSave.purchaseBillsSearch) {
// //             return draftSave.purchaseBillsSearch.selectedRowIndex || 0;
// //         }
// //         return 0;
// //     });

// //     // Fetch company and fiscal year info when component mounts
// //     useEffect(() => {
// //         const fetchInitialData = async () => {
// //             try {
// //                 const response = await api.get('/api/my-company');
// //                 if (response.data.success) {
// //                     const { company: companyData, currentFiscalYear } = response.data;

// //                     // Set company info
// //                     const dateFormat = companyData.dateFormat || 'english';
// //                     setCompany({
// //                         dateFormat,
// //                         isVatExempt: companyData.isVatExempt || false,
// //                         vatEnabled: companyData.vatEnabled !== false, // default true
// //                         fiscalYear: currentFiscalYear || {}
// //                     });

// //                     // Check if we have draft dates
// //                     const hasDraftDates = draftSave?.purchaseBillsData?.fromDate && draftSave?.purchaseBillsData?.toDate;

// //                     if (!hasDraftDates && currentFiscalYear?.startDate) {
// //                         // Only set default dates if we don't have draft dates
// //                         setData(prev => ({
// //                             ...prev,
// //                             fromDate: dateFormat === 'nepali'
// //                                 ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
// //                                 : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
// //                             toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
// //                             company: companyData,
// //                             currentFiscalYear
// //                         }));
// //                     } else {
// //                         // If we have draft data, ensure company info is updated
// //                         setData(prev => ({
// //                             ...prev,
// //                             company: companyData,
// //                             currentFiscalYear
// //                         }));
// //                     }
// //                 }
// //             } catch (err) {
// //                 console.error('Error fetching initial data:', err);
// //             }
// //         };

// //         fetchInitialData();
// //     }, []);

// //     const [loading, setLoading] = useState(false);
// //     const [error, setError] = useState(null);
// //     const [totals, setTotals] = useState({
// //         subTotal: 0,
// //         discount: 0,
// //         taxable: 0,
// //         vat: 0,
// //         roundOff: 0,
// //         amount: 0
// //     });
// //     const [filteredBills, setFilteredBills] = useState([]);

// //     const fromDateRef = useRef(null);
// //     const toDateRef = useRef(null);
// //     const searchInputRef = useRef(null);
// //     const paymentModeFilterRef = useRef(null);
// //     const generateReportRef = useRef(null);
// //     const tableBodyRef = useRef(null);
// //     const [shouldFetch, setShouldFetch] = useState(false);
// //     const navigate = useNavigate();

// //     const api = axios.create({
// //         baseURL: process.env.REACT_APP_API_BASE_URL,
// //         withCredentials: true,
// //     });

// //     // Save data and search state to draft context
// //     useEffect(() => {
// //         setDraftSave({
// //             ...draftSave,
// //             purchaseBillsData: data,
// //             purchaseBillsSearch: {
// //                 searchQuery,
// //                 paymentModeFilter,
// //                 selectedRowIndex,
// //                 fromDate: data.fromDate,
// //                 toDate: data.toDate
// //             }
// //         });
// //     }, [data, searchQuery, paymentModeFilter, selectedRowIndex, data.fromDate, data.toDate]);

// //     // Fetch data when generate report is clicked
// //     useEffect(() => {
// //         const fetchData = async () => {
// //             if (!shouldFetch) return;

// //             try {
// //                 setLoading(true);
// //                 const params = new URLSearchParams();
// //                 if (data.fromDate) params.append('fromDate', data.fromDate);
// //                 if (data.toDate) params.append('toDate', data.toDate);

// //                 const response = await api.get(`/api/retailer/purchase-register?${params.toString()}`);
// //                 setData(response.data.data);
// //                 setError(null);
// //                 // Don't reset selection when new data loads if we have a saved position
// //                 if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
// //                     setSelectedRowIndex(0);
// //                 }
// //             } catch (err) {
// //                 setError(err.response?.data?.error || 'Failed to fetch purchase bills');
// //             } finally {
// //                 setLoading(false);
// //                 setShouldFetch(false);
// //             }
// //         };

// //         fetchData();
// //     }, [shouldFetch, data.fromDate, data.toDate]);

// //     // Filter bills based on search and payment mode
// //     useEffect(() => {
// //         const filtered = data.bills.filter(bill => {
// //             const matchesSearch =
// //                 bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
// //                 bill.partyBillNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
// //                 bill.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
// //                 bill.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

// //             const matchesPaymentMode =
// //                 paymentModeFilter === '' ||
// //                 bill.paymentMode?.toLowerCase() === paymentModeFilter.toLowerCase();

// //             return matchesSearch && matchesPaymentMode;
// //         });

// //         setFilteredBills(filtered);

// //         // Reset selected row when filters change, but only if we don't have a saved position
// //         if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
// //             setSelectedRowIndex(0);
// //         }
// //     }, [data.bills, searchQuery, paymentModeFilter]);

// //     // Calculate totals when filtered bills change
// //     useEffect(() => {
// //         if (filteredBills.length === 0) {
// //             setTotals({
// //                 subTotal: 0,
// //                 discount: 0,
// //                 taxable: 0,
// //                 vat: 0,
// //                 roundOff: 0,
// //                 amount: 0
// //             });
// //             return;
// //         }

// //         const newTotals = filteredBills.reduce((acc, bill) => {
// //             return {
// //                 subTotal: acc.subTotal + (bill.subTotal || 0),
// //                 discount: acc.discount + (bill.discountAmount || 0),
// //                 taxable: acc.taxable + (bill.taxableAmount || 0),
// //                 vat: acc.vat + (bill.vatAmount || 0),
// //                 roundOff: acc.roundOff + (bill.roundOffAmount || 0),
// //                 amount: acc.amount + (bill.totalAmount || 0)
// //             };
// //         }, {
// //             subTotal: 0,
// //             discount: 0,
// //             taxable: 0,
// //             vat: 0,
// //             roundOff: 0,
// //             amount: 0
// //         });

// //         setTotals(newTotals);
// //     }, [filteredBills]);

// //     // Handle keyboard navigation
// //     useEffect(() => {
// //         const handleKeyDown = (e) => {
// //             if (filteredBills.length === 0) return;

// //             // Check if focus is inside an input or select element
// //             const activeElement = document.activeElement;
// //             if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
// //                 return;
// //             }

// //             switch (e.key) {
// //                 case 'ArrowUp':
// //                     e.preventDefault();
// //                     setSelectedRowIndex(prev => Math.max(0, prev - 1));
// //                     break;
// //                 case 'ArrowDown':
// //                     e.preventDefault();
// //                     setSelectedRowIndex(prev => Math.min(filteredBills.length - 1, prev + 1));
// //                     break;
// //                 default:
// //                     break;
// //             }
// //         };

// //         window.addEventListener('keydown', handleKeyDown);
// //         return () => window.removeEventListener('keydown', handleKeyDown);
// //     }, [filteredBills, selectedRowIndex, navigate]);

// //     // Scroll to selected row
// //     useEffect(() => {
// //         if (tableBodyRef.current && filteredBills.length > 0) {
// //             const rows = tableBodyRef.current.querySelectorAll('tr');
// //             if (rows.length > selectedRowIndex) {
// //                 rows[selectedRowIndex].scrollIntoView({
// //                     behavior: 'smooth',
// //                     block: 'nearest'
// //                 });
// //             }
// //         }
// //     }, [selectedRowIndex, filteredBills]);

// //     useEffect(() => {
// //         // Add F9 key handler here
// //         const handF9leKeyDown = (e) => {
// //             if (e.key === 'F9') {
// //                 e.preventDefault();
// //                 setShowProductModal(prev => !prev); // Toggle modal visibility
// //             }
// //         };
// //         window.addEventListener('keydown', handF9leKeyDown);
// //         return () => {
// //             window.removeEventListener('keydown', handF9leKeyDown);
// //         };
// //     }, []);

// //     const handleDateChange = (e) => {
// //         const { name, value } = e.target;
// //         setData(prev => ({ ...prev, [name]: value }));
// //     };

// //     const handleSearchChange = (e) => {
// //         setSearchQuery(e.target.value);
// //     };

// //     const handlePaymentModeFilterChange = (e) => {
// //         setPaymentModeFilter(e.target.value);
// //     };

// //     const handleGenerateReport = () => {
// //         if (!data.fromDate || !data.toDate) {
// //             setError('Please select both from and to dates');
// //             return;
// //         }
// //         setShouldFetch(true);
// //     };

// //     const handlePrint = (filtered = false) => {
// //         const rowsToPrint = filtered ?
// //             document.querySelectorAll('.bill-row:not([style*="display: none"])') :
// //             document.querySelectorAll('.bill-row');
// //         const vatEnabled = data.company?.vatEnabled || false;
// //         const isVatExempt = data.company?.isVatExempt || false;
// //         const showVatColumns = vatEnabled && !isVatExempt;

// //         if (rowsToPrint.length === 0) {
// //             alert("No bills to print");
// //             return;
// //         }

// //         const printWindow = window.open("", "_blank");
// //         const printHeader = `
// //         <div class="print-header">
// //             <h1>${data.currentCompanyName || 'Company Name'}</h1>
// //             <p>
// //                 ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''},
// //                 TPIN: ${data.currentCompany?.pan || ''}<br>
// //             </p>
// //             <hr>
// //         </div>
// //         `;

// //         let tableContent = `
// //         <style>
// //             @page {
// //                 size: A4 landscape;
// //                 margin: 10mm;
// //             }
// //             body { 
// //                 font-family: Arial, sans-serif; 
// //                 font-size: 10px; 
// //                 margin: 0;
// //                 padding: 10mm;
// //             }
// //             table { 
// //                 width: 100%; 
// //                 border-collapse: collapse; 
// //                 page-break-inside: auto;
// //             }
// //             tr { 
// //                 page-break-inside: avoid; 
// //                 page-break-after: auto; 
// //             }
// //             th, td { 
// //                 border: 1px solid #000; 
// //                 padding: 4px; 
// //                 text-align: left; 
// //                 white-space: nowrap;
// //             }
// //             th { 
// //                 background-color: 'N/A'f2f2f2 !important; 
// //                 -webkit-print-color-adjust: exact; 
// //             }
// //             .print-header { 
// //                 text-align: center; 
// //                 margin-bottom: 15px; 
// //             }
// //             .nowrap {
// //                 white-space: nowrap;
// //             }
// //         </style>
// //         ${printHeader}
// //         <h1 style="text-align:center;text-decoration:underline;">Purchase Voucher's Register</h1>
// //         <table>
// //             <thead>
// //                 <tr>
// //                     <th class="nowrap">Date</th>
// //                     <th class="nowrap">Vch. No.</th>
// //                     <th class="nowrap">Inv No.</th>
// //                     <th class="nowrap">Suppliers Name</th>
// //                     <th class="nowrap">Pay Mode</th>
// //                     <th class="nowrap">Sub Total</th>
// //                     <th class="nowrap">Discount</th>
// //                     ${showVatColumns ? `
// //                     <th class="nowrap">Taxable</th>
// //                     <th class="nowrap">VAT</th>
// //                     ` : ''}
// //                     <th class="nowrap">Round Off</th>
// //                     <th class="nowrap">Total</th>
// //                     <th class="nowrap">User</th>
// //                 </tr>
// //             </thead>
// //             <tbody>
// //         `;

// //         let totals = {
// //             subTotal: 0,
// //             discount: 0,
// //             taxable: 0,
// //             vat: 0,
// //             roundOff: 0,
// //             amount: 0
// //         };

// //         filteredBills.forEach(bill => {
// //             tableContent += `
// //             <tr>
// //                 <td class="nowrap">${new Date(bill.date).toLocaleDateString()}</td>
// //                 <td class="nowrap">${bill.billNumber}</td>
// //                 <td class="nowrap">${bill.partyBillNumber || 'N/A'}</td>
// //                 <td class="nowrap">${bill.account?.name || 'N/A'}</td>
// //                 <td class="nowrap">${bill.paymentMode}</td>
// //                 <td class="nowrap">${bill.subTotal?.toFixed(2)}</td>
// //                 <td class="nowrap">${bill.discountPercentage?.toFixed(2)}% - ${bill.discountAmount?.toFixed(2)}</td>
// //                 ${showVatColumns ? `
// //                 <td class="nowrap">${bill.taxableAmount?.toFixed(2)}</td>
// //                 <td class="nowrap">${bill.vatAmount?.toFixed(2)}</td>
// //                 ` : ''}
// //                 <td class="nowrap">${bill.roundOffAmount?.toFixed(2)}</td>
// //                 <td class="nowrap">${bill.totalAmount?.toFixed(2)}</td>
// //                 <td class="nowrap">${bill.user?.name || 'N/A'}</td>
// //             </tr>
// //             `;

// //             totals.subTotal += parseFloat(bill.subTotal || 0);
// //             totals.discount += parseFloat(bill.discountAmount || 0);
// //             totals.taxable += parseFloat(bill.taxableAmount || 0);
// //             totals.vat += parseFloat(bill.vatAmount || 0);
// //             totals.roundOff += parseFloat(bill.roundOffAmount || 0);
// //             totals.amount += parseFloat(bill.totalAmount || 0);
// //         });

// //         // Add final totals row
// //         tableContent += `
// //             <tr style="font-weight:bold; border-top: 2px solid #000;">
// //                 <td colspan="5">Grand Totals</td>
// //                 <td>${totals.subTotal.toFixed(2)}</td>
// //                 <td>${totals.discount.toFixed(2)}</td>
// //                 ${showVatColumns ? `
// //                 <td>${totals.taxable.toFixed(2)}</td>
// //                 <td>${totals.vat.toFixed(2)}</td>
// //                 ` : ''}
// //                 <td>${totals.roundOff.toFixed(2)}</td>
// //                 <td>${totals.amount.toFixed(2)}</td>
// //                 <td></td>
// //             </tr>
// //             </tbody>
// //         </table>
// //         `;

// //         printWindow.document.write(`
// //         <html>
// //             <head>
// //                 <title>Purchase Voucher's Register</title>
// //             </head>
// //             <body>
// //                 ${tableContent}
// //                 <script>
// //                     window.onload = function() {
// //                         setTimeout(function() {
// //                             window.print();
// //                         }, 200);
// //                     };
// //                 <\/script>
// //             </body>
// //         </html>
// //         `);
// //         printWindow.document.close();
// //     };

// //     const formatCurrency = (num) => {
// //         const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
// //         if (company.dateFormat === 'nepali') {
// //             // Indian grouping, two decimals, English digits
// //             return number.toLocaleString('en-IN', {
// //                 minimumFractionDigits: 2,
// //                 maximumFractionDigits: 2
// //             });
// //         }
// //         // English (US) grouping by default
// //         return number.toLocaleString('en-US', {
// //             minimumFractionDigits: 2,
// //             maximumFractionDigits: 2
// //         });
// //     };

// //     const handleRowClick = (index) => {
// //         setSelectedRowIndex(index);
// //     };

// //     const handleRowDoubleClick = (billId) => {
// //         navigate(`/retailer/purchase/${filteredBills[selectedRowIndex]._id}/print`);
// //     };

// //     const handleKeyDown = (e, nextFieldId) => {
// //         if (e.key === 'Enter') {
// //             e.preventDefault();
// //             if (nextFieldId) {
// //                 const nextField = document.getElementById(nextFieldId);
// //                 if (nextField) {
// //                     nextField.focus();
// //                 }
// //             } else {
// //                 // If no nextFieldId provided, try to find the next focusable element
// //                 const focusableElements = Array.from(
// //                     document.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
// //                 ).filter(el => !el.disabled && el.offsetParent !== null);

// //                 const currentIndex = focusableElements.findIndex(el => el === e.target);

// //                 if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
// //                     focusableElements[currentIndex + 1].focus();
// //                 }
// //             }
// //         }
// //     };

// //     if (error) {
// //         return <div className="alert alert-danger text-center py-5">{error}</div>;
// //     }

// //     if (loading) return <Loader />;

// //     return (
// //         <div className="container-fluid p-0" style={{ minHeight: '100vh' }}>
// //             <Header />
// //             <div className="container-fluid px-3 py-2">
// //                 <div className="card border-0 shadow-sm">
// //                     <div className="card-header bg-white py-2 px-3 border-0">
// //                         <h6 className="mb-0 text-primary fw-bold">
// //                             <i className="fas fa-file-invoice me-2"></i>
// //                             Purchase Voucher's Register
// //                         </h6>
// //                     </div>

// //                     <div className="card-body px-3 py-3">
// //                         {/* Search and Filter Section - Compact */}
// //                         <div className="row g-2 mb-3">
// //                             <div className="col-md-8">
// //                                 <div className="row g-2">
// //                                     {/* Date Range Row */}
// //                                     <div className="col-md-2">
// //                                         <label htmlFor="fromDate" className="form-label small mb-1 fw-semibold">From Date</label>
// //                                         <input
// //                                             type="text"
// //                                             name="fromDate"
// //                                             id="fromDate"
// //                                             ref={company.dateFormat === 'nepali' ? fromDateRef : null}
// //                                             className="form-control form-control-sm no-date-icon"
// //                                             value={data.fromDate}
// //                                             onChange={handleDateChange}
// //                                             required
// //                                             autoComplete='off'
// //                                             onKeyDown={(e) => handleKeyDown(e, 'toDate')}
// //                                         />
// //                                     </div>
// //                                     <div className="col-md-2">
// //                                         <label htmlFor="toDate" className="form-label small mb-1 fw-semibold">To Date</label>
// //                                         <input
// //                                             type="text"
// //                                             name="toDate"
// //                                             id="toDate"
// //                                             ref={toDateRef}
// //                                             className="form-control form-control-sm no-date-icon"
// //                                             value={data.toDate}
// //                                             onChange={handleDateChange}
// //                                             required
// //                                             autoComplete='off'
// //                                             onKeyDown={(e) => handleKeyDown(e, 'generateReport')}
// //                                         />
// //                                     </div>
// //                                     <div className="col-md-2 d-flex align-items-end">
// //                                         <button
// //                                             type="button"
// //                                             id="generateReport"
// //                                             ref={generateReportRef}
// //                                             className="btn btn-primary btn-sm w-100 py-2"
// //                                             onClick={handleGenerateReport}
// //                                         >
// //                                             <i className="fas fa-chart-line me-1"></i>Generate
// //                                         </button>
// //                                     </div>

// //                                     {/* Search Row */}
// //                                     <div className="col-md-3">
// //                                         <label htmlFor="searchInput" className="form-label small mb-1 fw-semibold">Search</label>
// //                                         <div className="input-group input-group-sm">
// //                                             <input
// //                                                 type="text"
// //                                                 className="form-control form-control-sm"
// //                                                 id="searchInput"
// //                                                 ref={searchInputRef}
// //                                                 placeholder="Search bills..."
// //                                                 value={searchQuery}
// //                                                 onChange={handleSearchChange}
// //                                                 disabled={data.bills.length === 0}
// //                                                 autoComplete='off'
// //                                             />
// //                                             <button
// //                                                 className="btn btn-outline-secondary btn-sm"
// //                                                 type="button"
// //                                                 onClick={() => setSearchQuery('')}
// //                                                 disabled={data.bills.length === 0}
// //                                             >
// //                                                 <i className="fas fa-times small"></i>
// //                                             </button>
// //                                         </div>
// //                                     </div>

// //                                     {/* Payment Mode Filter Row */}
// //                                     <div className="col-md-2">
// //                                         <label htmlFor="paymentModeFilter" className="form-label small mb-1 fw-semibold">Payment Mode</label>
// //                                         <select
// //                                             className="form-select form-select-sm"
// //                                             id="paymentModeFilter"
// //                                             ref={paymentModeFilterRef}
// //                                             value={paymentModeFilter}
// //                                             onChange={handlePaymentModeFilterChange}
// //                                             disabled={data.bills.length === 0}
// //                                         >
// //                                             <option value="">All</option>
// //                                             <option value="cash">Cash</option>
// //                                             <option value="credit">Credit</option>
// //                                         </select>
// //                                     </div>
// //                                 </div>
// //                             </div>

// //                             {/* Action Buttons */}
// //                             <div className="col-md-4 d-flex align-items-end justify-content-end gap-1">
// //                                 <button
// //                                     className="btn btn-primary btn-sm px-3 py-2"
// //                                     onClick={() => navigate('/retailer/purchase')}
// //                                 >
// //                                     <i className="fas fa-plus me-1"></i>New Voucher
// //                                 </button>
// //                                 <button
// //                                     className="btn btn-outline-secondary btn-sm px-3 py-2"
// //                                     onClick={() => handlePrint(false)}
// //                                     disabled={data.bills.length === 0}
// //                                 >
// //                                     <i className="fas fa-print me-1"></i>All
// //                                 </button>
// //                                 <button
// //                                     className="btn btn-outline-secondary btn-sm px-3 py-2"
// //                                     onClick={() => handlePrint(true)}
// //                                     disabled={data.bills.length === 0}
// //                                 >
// //                                     <i className="fas fa-filter me-1"></i>Filtered
// //                                 </button>
// //                             </div>
// //                         </div>

// //                         {data.bills.length === 0 ? (
// //                             <div className="alert alert-info text-center py-3 small">
// //                                 <i className="fas fa-info-circle me-2"></i>
// //                                 Please select date range and click "Generate Report" to view data
// //                             </div>
// //                         ) : (
// //                             <>
// //                                 {/* Compact Bills Table */}
// //                                 <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
// //                                     <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.75rem' }}>
// //                                         <thead className="sticky-top" style={{ top: 0 }}>
// //                                             <tr className="bg-light">
// //                                                 <th className="py-1 px-2 text-nowrap" style={{ width: '80px' }}>Date</th>
// //                                                 <th className="py-1 px-2 text-nowrap" style={{ width: '70px' }}>Vch No.</th>
// //                                                 <th className="py-1 px-2 text-nowrap" style={{ width: '80px' }}>Inv No.</th>
// //                                                 <th className="py-1 px-2 text-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>Suppliers Name</th>
// //                                                 <th className="py-1 px-2 text-nowrap" style={{ width: '70px' }}>Pay Mode</th>
// //                                                 <th className="py-1 px-2 text-nowrap text-end" style={{ width: '90px' }}>Sub Total</th>
// //                                                 <th className="py-1 px-2 text-nowrap text-end" style={{ width: '110px' }}>Discount</th>
// //                                                 {data.company?.vatEnabled && !data.company?.isVatExempt && (
// //                                                     <>
// //                                                         <th className="py-1 px-2 text-nowrap text-end" style={{ width: '90px' }}>Taxable</th>
// //                                                         <th className="py-1 px-2 text-nowrap text-end" style={{ width: '80px' }}>VAT</th>
// //                                                     </>
// //                                                 )}
// //                                                 <th className="py-1 px-2 text-nowrap text-end" style={{ width: '80px' }}>Round Off</th>
// //                                                 <th className="py-1 px-2 text-nowrap text-end" style={{ width: '90px' }}>Total</th>
// //                                                 <th className="py-1 px-2 text-nowrap" style={{ width: '80px' }}>User</th>
// //                                                 <th className="py-1 px-2 text-nowrap" style={{ width: '80px' }}>Actions</th>
// //                                             </tr>
// //                                         </thead>
// //                                         <tbody ref={tableBodyRef}>
// //                                             {filteredBills.map((bill, index) => (
// //                                                 <tr
// //                                                     key={bill._id}
// //                                                     className={`bill-row ${selectedRowIndex === index ? 'table-primary' : ''}`}
// //                                                     onClick={() => handleRowClick(index)}
// //                                                     onDoubleClick={() => handleRowDoubleClick(bill._id)}
// //                                                     style={{ cursor: 'pointer' }}
// //                                                 >
// //                                                     <td className="py-1 px-2 text-nowrap" style={{ width: '80px' }}>{new NepaliDate(bill.date).format('YYYY-MM-DD')}</td>
// //                                                     <td className="py-1 px-2 text-nowrap" style={{ width: '70px' }}>{bill.billNumber}</td>
// //                                                     <td className="py-1 px-2 text-nowrap" style={{ width: '80px' }}>{bill.partyBillNumber || '-'}</td>
// //                                                     <td className="py-1 px-2 text-truncate"
// //                                                         style={{
// //                                                             width: '120px',
// //                                                             minWidth: '120px',
// //                                                             maxWidth: '120px',
// //                                                             overflow: 'hidden',
// //                                                             textOverflow: 'ellipsis',
// //                                                             whiteSpace: 'nowrap'
// //                                                         }}
// //                                                         title={bill.account?.name || 'N/A'}>
// //                                                         {bill.account?.name || 'N/A'}
// //                                                     </td>
// //                                                     <td className="py-1 px-2 text-nowrap" style={{ width: '70px' }}>
// //                                                         <span className={`badge ${bill.paymentMode === 'cash' ? 'bg-success' : 'bg-warning'} py-1 px-2`}>
// //                                                             {bill.paymentMode}
// //                                                         </span>
// //                                                     </td>
// //                                                     <td className="py-1 px-2 text-end text-nowrap font-monospace" style={{ width: '90px' }}>{formatCurrency(bill.subTotal)}</td>
// //                                                     <td className="py-1 px-2 text-end text-nowrap font-monospace" style={{ width: '110px' }}>
// //                                                         {formatCurrency(bill.discountPercentage)}% - {formatCurrency(bill.discountAmount)}
// //                                                     </td>
// //                                                     {data.company?.vatEnabled && !data.company?.isVatExempt && (
// //                                                         <>
// //                                                             <td className="py-1 px-2 text-end text-nowrap font-monospace" style={{ width: '90px' }}>{formatCurrency(bill.taxableAmount)}</td>
// //                                                             <td className="py-1 px-2 text-end text-nowrap font-monospace" style={{ width: '80px' }}>
// //                                                                 {formatCurrency(bill.vatAmount)}
// //                                                             </td>
// //                                                         </>
// //                                                     )}
// //                                                     <td className="py-1 px-2 text-end text-nowrap font-monospace" style={{ width: '80px' }}>{formatCurrency(bill.roundOffAmount)}</td>
// //                                                     <td className="py-1 px-2 text-end text-nowrap font-monospace fw-bold" style={{ width: '90px' }}>{formatCurrency(bill.totalAmount)}</td>
// //                                                     <td className="py-1 px-2 text-truncate"
// //                                                         style={{
// //                                                             width: '80px',
// //                                                             overflow: 'hidden',
// //                                                             textOverflow: 'ellipsis',
// //                                                             whiteSpace: 'nowrap'
// //                                                         }}
// //                                                         title={bill.user?.name || 'N/A'}>
// //                                                         {bill.user?.name || '-'}
// //                                                     </td>
// //                                                     <td className="py-1 px-2 text-nowrap" style={{ width: '80px' }}>
// //                                                         <div className="d-flex gap-1">
// //                                                             <button
// //                                                                 className="btn btn-sm btn-outline-info py-0 px-2"
// //                                                                 onClick={(e) => {
// //                                                                     e.stopPropagation();
// //                                                                     navigate(`/retailer/purchase/${bill._id}/print`);
// //                                                                 }}
// //                                                                 title="View"
// //                                                             >
// //                                                                 <i className="fas fa-eye fa-xs"></i>
// //                                                             </button>
// //                                                             <button
// //                                                                 className="btn btn-sm btn-outline-warning py-0 px-2"
// //                                                                 onClick={(e) => {
// //                                                                     e.stopPropagation();
// //                                                                     navigate(`/retailer/purchase/edit/${bill._id}`);
// //                                                                 }}
// //                                                                 title="Edit"
// //                                                             >
// //                                                                 <i className="fas fa-edit fa-xs"></i>
// //                                                             </button>
// //                                                         </div>
// //                                                     </td>
// //                                                 </tr>
// //                                             ))}
// //                                         </tbody>
// //                                         <tfoot className="sticky-bottom bg-light" style={{ bottom: 0 }}>
// //                                             <tr className="fw-bold border-top">
// //                                                 <td colSpan="5" className="py-1 px-2">Total:</td>
// //                                                 <td className="py-1 px-2 text-end font-monospace">{formatCurrency(totals.subTotal)}</td>
// //                                                 <td className="py-1 px-2 text-end font-monospace">{formatCurrency(totals.discount)}</td>
// //                                                 {data.company?.vatEnabled && !data.company?.isVatExempt && (
// //                                                     <>
// //                                                         <td className="py-1 px-2 text-end font-monospace">{formatCurrency(totals.taxable)}</td>
// //                                                         <td className="py-1 px-2 text-end font-monospace">{formatCurrency(totals.vat)}</td>
// //                                                     </>
// //                                                 )}
// //                                                 <td className="py-1 px-2 text-end font-monospace">{formatCurrency(totals.roundOff)}</td>
// //                                                 <td className="py-1 px-2 text-end font-monospace">{formatCurrency(totals.amount)}</td>
// //                                                 <td colSpan="2" className="py-1 px-2"></td>
// //                                             </tr>
// //                                         </tfoot>
// //                                     </table>
// //                                 </div>
// //                             </>
// //                         )}
// //                     </div>
// //                 </div>
// //             </div>

// //             {/* Product modal */}
// //             {showProductModal && (
// //                 <ProductModal onClose={() => setShowProductModal(false)} />
// //             )}
// //         </div>
// //     );
// // };

// // export default PurchaseBillsList;

//---------------------------------------------------------------------------
// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import '../../../stylesheet/retailer/purchase/List.css';
// import Header from '../Header';
// import NepaliDate from 'nepali-date-converter';
// import { usePageNotRefreshContext } from '../PageNotRefreshContext';
// import '../../../stylesheet/noDateIcon.css';
// import '../../../stylesheet/loader.css';
// import Loader from '../../Loader';
// import ProductModal from '../dashboard/modals/ProductModal';
// import { FixedSizeList as List } from 'react-window';
// import AutoSizer from 'react-virtualized-auto-sizer';
// import Badge from 'react-bootstrap/Badge';
// import Button from 'react-bootstrap/Button';
// import Form from 'react-bootstrap/Form';
// import Modal from 'react-bootstrap/Modal';
// import Spinner from 'react-bootstrap/Spinner';

// const PurchaseBillsList = () => {
//     const currentNepaliDate = new NepaliDate().format('YYYY-MM-DD');
//     const currentEnglishDate = new Date().toISOString().split('T')[0];
//     const [showProductModal, setShowProductModal] = useState(false);
//     const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();

//     const [company, setCompany] = useState({
//         dateFormat: 'nepali',
//         vatEnabled: true,
//         fiscalYear: {}
//     });

//     const [data, setData] = useState(() => {
//         if (draftSave && draftSave.purchaseBillsData) {
//             return draftSave.purchaseBillsData;
//         }
//         return {
//             company: null,
//             currentFiscalYear: null,
//             bills: [],
//             fromDate: '',
//             toDate: ''
//         };
//     });

//     // Add resizable column state
//     const [columnWidths, setColumnWidths] = useState(() => {
//         const savedWidths = localStorage.getItem('purchaseBillsColumnWidths');
//         if (savedWidths) {
//             try {
//                 return JSON.parse(savedWidths);
//             } catch (e) {
//                 console.error('Failed to load column widths:', e);
//             }
//         }
//         return {
//             date: 90,
//             voucherNo: 80,
//             invoiceNo: 80,
//             supplier: 150,
//             paymentMode: 80,
//             subTotal: 90,
//             discount: 110,
//             taxable: 90,
//             vat: 80,
//             roundOff: 80,
//             total: 90,
//             user: 100,
//             actions: 50
//         };
//     });

//     const [isResizing, setIsResizing] = useState(false);
//     const [resizingColumn, setResizingColumn] = useState(null);
//     const [startX, setStartX] = useState(0);
//     const [startWidth, setStartWidth] = useState(0);

//     const [searchQuery, setSearchQuery] = useState(() => {
//         if (draftSave && draftSave.purchaseBillsSearch) {
//             return draftSave.purchaseBillsSearch.searchQuery || '';
//         }
//         return '';
//     });

//     const [paymentModeFilter, setPaymentModeFilter] = useState(() => {
//         if (draftSave && draftSave.purchaseBillsSearch) {
//             return draftSave.purchaseBillsSearch.paymentModeFilter || '';
//         }
//         return '';
//     });

//     const [selectedRowIndex, setSelectedRowIndex] = useState(() => {
//         if (draftSave && draftSave.purchaseBillsSearch) {
//             return draftSave.purchaseBillsSearch.selectedRowIndex || 0;
//         }
//         return 0;
//     });

//     // Save column widths to localStorage
//     useEffect(() => {
//         localStorage.setItem('purchaseBillsColumnWidths', JSON.stringify(columnWidths));
//     }, [columnWidths]);

//     // Fetch company and fiscal year info when component mounts
//     useEffect(() => {
//         const fetchInitialData = async () => {
//             try {
//                 const response = await api.get('/api/my-company');
//                 if (response.data.success) {
//                     const { company: companyData, currentFiscalYear } = response.data;

//                     // Set company info
//                     const dateFormat = companyData.dateFormat || 'english';
//                     setCompany({
//                         dateFormat,
//                         isVatExempt: companyData.isVatExempt || false,
//                         vatEnabled: companyData.vatEnabled !== false,
//                         fiscalYear: currentFiscalYear || {}
//                     });

//                     // Check if we have draft dates
//                     const hasDraftDates = draftSave?.purchaseBillsData?.fromDate && draftSave?.purchaseBillsData?.toDate;

//                     if (!hasDraftDates && currentFiscalYear?.startDate) {
//                         // Only set default dates if we don't have draft dates
//                         setData(prev => ({
//                             ...prev,
//                             fromDate: dateFormat === 'nepali'
//                                 ? new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD')
//                                 : new NepaliDate(currentFiscalYear.startDate).format('YYYY-MM-DD'),
//                             toDate: dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
//                             company: companyData,
//                             currentFiscalYear
//                         }));
//                     } else {
//                         // If we have draft data, ensure company info is updated
//                         setData(prev => ({
//                             ...prev,
//                             company: companyData,
//                             currentFiscalYear
//                         }));
//                     }
//                 }
//             } catch (err) {
//                 console.error('Error fetching initial data:', err);
//             }
//         };

//         fetchInitialData();
//     }, []);

//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState(null);
//     const [totals, setTotals] = useState({
//         subTotal: 0,
//         discount: 0,
//         taxable: 0,
//         vat: 0,
//         roundOff: 0,
//         amount: 0
//     });
//     const [filteredBills, setFilteredBills] = useState([]);

//     const fromDateRef = useRef(null);
//     const toDateRef = useRef(null);
//     const searchInputRef = useRef(null);
//     const paymentModeFilterRef = useRef(null);
//     const generateReportRef = useRef(null);
//     const tableBodyRef = useRef(null);
//     const [shouldFetch, setShouldFetch] = useState(false);
//     const navigate = useNavigate();

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     // Save data and search state to draft context
//     useEffect(() => {
//         setDraftSave({
//             ...draftSave,
//             purchaseBillsData: data,
//             purchaseBillsSearch: {
//                 searchQuery,
//                 paymentModeFilter,
//                 selectedRowIndex,
//                 fromDate: data.fromDate,
//                 toDate: data.toDate
//             }
//         });
//     }, [data, searchQuery, paymentModeFilter, selectedRowIndex, data.fromDate, data.toDate]);

//     // Fetch data when generate report is clicked
//     useEffect(() => {
//         const fetchData = async () => {
//             if (!shouldFetch) return;

//             try {
//                 setLoading(true);
//                 const params = new URLSearchParams();
//                 if (data.fromDate) params.append('fromDate', data.fromDate);
//                 if (data.toDate) params.append('toDate', data.toDate);

//                 const response = await api.get(`/api/retailer/purchase-register?${params.toString()}`);
//                 setData(response.data.data);
//                 setError(null);
//                 // Don't reset selection when new data loads if we have a saved position
//                 if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
//                     setSelectedRowIndex(0);
//                 }
//             } catch (err) {
//                 setError(err.response?.data?.error || 'Failed to fetch purchase bills');
//             } finally {
//                 setLoading(false);
//                 setShouldFetch(false);
//             }
//         };

//         fetchData();
//     }, [shouldFetch, data.fromDate, data.toDate]);

//     // Filter bills based on search and payment mode
//     useEffect(() => {
//         const filtered = data.bills.filter(bill => {
//             const matchesSearch =
//                 bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 bill.partyBillNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 bill.account?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
//                 bill.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());

//             const matchesPaymentMode =
//                 paymentModeFilter === '' ||
//                 bill.paymentMode?.toLowerCase() === paymentModeFilter.toLowerCase();

//             return matchesSearch && matchesPaymentMode;
//         });

//         setFilteredBills(filtered);

//         // Reset selected row when filters change, but only if we don't have a saved position
//         if (!draftSave?.purchaseBillsSearch?.selectedRowIndex) {
//             setSelectedRowIndex(0);
//         }
//     }, [data.bills, searchQuery, paymentModeFilter]);

//     // Calculate totals when filtered bills change
//     useEffect(() => {
//         if (filteredBills.length === 0) {
//             setTotals({
//                 subTotal: 0,
//                 discount: 0,
//                 taxable: 0,
//                 vat: 0,
//                 roundOff: 0,
//                 amount: 0
//             });
//             return;
//         }

//         const newTotals = filteredBills.reduce((acc, bill) => {
//             return {
//                 subTotal: acc.subTotal + (bill.subTotal || 0),
//                 discount: acc.discount + (bill.discountAmount || 0),
//                 taxable: acc.taxable + (bill.taxableAmount || 0),
//                 vat: acc.vat + (bill.vatAmount || 0),
//                 roundOff: acc.roundOff + (bill.roundOffAmount || 0),
//                 amount: acc.amount + (bill.totalAmount || 0)
//             };
//         }, {
//             subTotal: 0,
//             discount: 0,
//             taxable: 0,
//             vat: 0,
//             roundOff: 0,
//             amount: 0
//         });

//         setTotals(newTotals);
//     }, [filteredBills]);

//     // Handle keyboard navigation
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (filteredBills.length === 0) return;

//             // Check if focus is inside an input or select element
//             const activeElement = document.activeElement;
//             if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
//                 return;
//             }

//             switch (e.key) {
//                 case 'ArrowUp':
//                     e.preventDefault();
//                     setSelectedRowIndex(prev => Math.max(0, prev - 1));
//                     break;
//                 case 'ArrowDown':
//                     e.preventDefault();
//                     setSelectedRowIndex(prev => Math.min(filteredBills.length - 1, prev + 1));
//                     break;
//                 case 'Enter':
//                     if (selectedRowIndex >= 0 && filteredBills[selectedRowIndex]) {
//                         navigate(`/retailer/purchase/${filteredBills[selectedRowIndex]._id}/print`);
//                     }
//                     break;
//                 default:
//                     break;
//             }
//         };

//         window.addEventListener('keydown', handleKeyDown);
//         return () => window.removeEventListener('keydown', handleKeyDown);
//     }, [filteredBills, selectedRowIndex, navigate]);

//     // Scroll to selected row
//     useEffect(() => {
//         if (tableBodyRef.current && filteredBills.length > 0) {
//             const rows = tableBodyRef.current.querySelectorAll('tr');
//             if (rows.length > selectedRowIndex) {
//                 rows[selectedRowIndex].scrollIntoView({
//                     behavior: 'smooth',
//                     block: 'nearest'
//                 });
//             }
//         }
//     }, [selectedRowIndex, filteredBills]);

//     useEffect(() => {
//         // Add F9 key handler here
//         const handF9leKeyDown = (e) => {
//             if (e.key === 'F9') {
//                 e.preventDefault();
//                 setShowProductModal(prev => !prev);
//             }
//         };
//         window.addEventListener('keydown', handF9leKeyDown);
//         return () => {
//             window.removeEventListener('keydown', handF9leKeyDown);
//         };
//     }, []);

//     // Resizable Table Header Component
//     const TableHeader = React.memo(() => {
//         const totalWidth = getTotalTableWidth();

//         const handleResizeStart = (e, columnName) => {
//             setIsResizing(true);
//             setResizingColumn(columnName);
//             setStartX(e.clientX);
//             setStartWidth(columnWidths[columnName]);
//             e.preventDefault();
//         };

//         const showVatColumns = data.company?.vatEnabled && !data.company?.isVatExempt;

//         return (
//             <div
//                 className="d-flex bg-primary text-white sticky-top align-items-center position-relative"
//                 style={{
//                     zIndex: 2,
//                     height: '35px',
//                     minWidth: `${totalWidth}px`,
//                     userSelect: isResizing ? 'none' : 'auto'
//                 }}
//                 onMouseMove={(e) => {
//                     if (isResizing && resizingColumn) {
//                         const diff = e.clientX - startX;
//                         const newWidth = Math.max(60, startWidth + diff);
//                         setColumnWidths(prev => ({
//                             ...prev,
//                             [resizingColumn]: newWidth
//                         }));
//                     }
//                 }}
//                 onMouseUp={() => {
//                     if (isResizing) {
//                         setIsResizing(false);
//                         setResizingColumn(null);
//                     }
//                 }}
//                 onMouseLeave={() => {
//                     if (isResizing) {
//                         setIsResizing(false);
//                         setResizingColumn(null);
//                     }
//                 }}
//             >
//                 {/* Date */}
//                 <div
//                     className="d-flex align-items-center ps-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.date}px`, flexShrink: 0, minWidth: '70px' }}
//                 >
//                     <strong>Date</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.date - 2} columnName="date" />
//                 </div>

//                 {/* Voucher No */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.voucherNo}px`, flexShrink: 0, minWidth: '70px' }}
//                 >
//                     <strong>Vch No</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.voucherNo - 2} columnName="voucherNo" />
//                 </div>

//                 {/* Invoice No */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.invoiceNo}px`, flexShrink: 0, minWidth: '70px' }}
//                 >
//                     <strong>Inv No</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.invoiceNo - 2} columnName="invoiceNo" />
//                 </div>

//                 {/* Supplier */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.supplier}px`, flexShrink: 0, minWidth: '100px' }}
//                 >
//                     <strong>Supplier</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.supplier - 2} columnName="supplier" />
//                 </div>

//                 {/* Payment Mode */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.paymentMode}px`, flexShrink: 0, minWidth: '70px' }}
//                 >
//                     <strong>Pay Mode</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.paymentMode - 2} columnName="paymentMode" />
//                 </div>

//                 {/* Sub Total */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.subTotal}px`, flexShrink: 0, minWidth: '80px' }}
//                 >
//                     <strong>Sub Total</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.subTotal - 2} columnName="subTotal" />
//                 </div>

//                 {/* Discount */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.discount}px`, flexShrink: 0, minWidth: '100px' }}
//                 >
//                     <strong>Discount</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.discount - 2} columnName="discount" />
//                 </div>

//                 {/* VAT Columns (conditionally shown) */}
//                 {showVatColumns && (
//                     <>
//                         <div
//                             className="d-flex align-items-center px-2 border-end border-white position-relative"
//                             style={{ width: `${columnWidths.taxable}px`, flexShrink: 0, minWidth: '80px' }}
//                         >
//                             <strong>Taxable</strong>
//                             <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.taxable - 2} columnName="taxable" />
//                         </div>
//                         <div
//                             className="d-flex align-items-center px-2 border-end border-white position-relative"
//                             style={{ width: `${columnWidths.vat}px`, flexShrink: 0, minWidth: '70px' }}
//                         >
//                             <strong>VAT</strong>
//                             <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.vat - 2} columnName="vat" />
//                         </div>
//                     </>
//                 )}

//                 {/* Round Off */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.roundOff}px`, flexShrink: 0, minWidth: '70px' }}
//                 >
//                     <strong>Round Off</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.roundOff - 2} columnName="roundOff" />
//                 </div>

//                 {/* Total */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.total}px`, flexShrink: 0, minWidth: '80px' }}
//                 >
//                     <strong>Total</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.total - 2} columnName="total" />
//                 </div>

//                 {/* User */}
//                 <div
//                     className="d-flex align-items-center px-2 border-end border-white position-relative"
//                     style={{ width: `${columnWidths.user}px`, flexShrink: 0, minWidth: '80px' }}
//                 >
//                     <strong>User</strong>
//                     <ResizeHandle onResizeStart={handleResizeStart} left={columnWidths.user - 2} columnName="user" />
//                 </div>

//                 {/* Actions */}
//                 <div
//                     className="d-flex align-items-center px-2"
//                     style={{ width: `${columnWidths.actions}px`, flexShrink: 0, minWidth: '80px' }}
//                 >
//                     <strong>Actions</strong>
//                 </div>

//                 {/* Resizing indicator overlay */}
//                 {isResizing && (
//                     <div
//                         style={{
//                             position: 'fixed',
//                             top: 0,
//                             left: 0,
//                             right: 0,
//                             bottom: 0,
//                             zIndex: 1000,
//                             cursor: 'col-resize'
//                         }}
//                     />
//                 )}
//             </div>
//         );
//     });

//     // Table Row Component for virtualized list
//     const TableRow = React.memo(({ index, style, data: { bills, selectedRowIndex, showVatColumns, formatCurrency, onRowClick } }) => {
//         const bill = bills[index];
//         const isSelected = selectedRowIndex === index;
//         const showVat = showVatColumns;

//         const handleRowClick = useCallback(() => {
//             onRowClick(index);
//         }, [index, onRowClick]);

//         const handleDoubleClick = useCallback(() => {
//             navigate(`/retailer/purchase/${bill._id}/print`);
//         }, [bill?._id]);

//         const handleViewClick = useCallback((e) => {
//             e.stopPropagation();
//             navigate(`/retailer/purchase/${bill._id}/print`);
//         }, [bill?._id]);

//         const handleEditClick = useCallback((e) => {
//             e.stopPropagation();
//             navigate(`/retailer/purchase/edit/${bill._id}`);
//         }, [bill?._id]);

//         if (!bill) return null;

//         const paymentModeBadge = bill.paymentMode === 'cash' ? 'success' : 'warning';

//         return (
//             <div
//                 style={{
//                     ...style,
//                     display: 'flex',
//                     alignItems: 'center',
//                     height: '35px',
//                     minHeight: '35px',
//                     padding: '0',
//                     borderBottom: '1px solid #dee2e6',
//                     backgroundColor: isSelected ? '#e7f5ff' : index % 2 === 0 ? '#f8f9fa' : '#ffffff',
//                     cursor: 'pointer'
//                 }}
//                 onClick={handleRowClick}
//                 onDoubleClick={handleDoubleClick}
//             >
//                 {/* Date */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center"
//                     style={{ width: `${columnWidths.date}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
//                         {new NepaliDate(bill.date).format('YYYY-MM-DD')}
//                     </span>
//                 </div>

//                 {/* Voucher No */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center"
//                     style={{ width: `${columnWidths.voucherNo}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
//                         {bill.billNumber}
//                     </span>
//                 </div>

//                 {/* Invoice No */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center"
//                     style={{ width: `${columnWidths.invoiceNo}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
//                         {bill.partyBillNumber || '-'}
//                     </span>
//                 </div>

//                 {/* Supplier */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center"
//                     style={{ width: `${columnWidths.supplier}px`, flexShrink: 0, height: '100%' }}
//                     title={bill.account?.name || 'N/A'}
//                 >
//                     <span style={{
//                         fontSize: '0.85rem',
//                         whiteSpace: 'nowrap',
//                         overflow: 'hidden',
//                         textOverflow: 'ellipsis',
//                         display: 'block',
//                         width: '100%'
//                     }}>
//                         {bill.account?.name || 'N/A'}
//                     </span>
//                 </div>

//                 {/* Payment Mode */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center"
//                     style={{ width: `${columnWidths.paymentMode}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <Badge bg={paymentModeBadge} pill style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
//                         {bill.paymentMode}
//                     </Badge>
//                 </div>

//                 {/* Sub Total */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center justify-content-end"
//                     style={{ width: `${columnWidths.subTotal}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
//                         {formatCurrency(bill.subTotal)}
//                     </span>
//                 </div>

//                 {/* Discount */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center justify-content-end"
//                     style={{ width: `${columnWidths.discount}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
//                         {formatCurrency(bill.discountPercentage)}% - {formatCurrency(bill.discountAmount)}
//                     </span>
//                 </div>

//                 {/* VAT Columns (conditionally rendered) */}
//                 {showVat && (
//                     <>
//                         <div
//                             className="px-2 border-end d-flex align-items-center justify-content-end"
//                             style={{ width: `${columnWidths.taxable}px`, flexShrink: 0, height: '100%' }}
//                         >
//                             <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
//                                 {formatCurrency(bill.taxableAmount)}
//                             </span>
//                         </div>
//                         <div
//                             className="px-2 border-end d-flex align-items-center justify-content-end"
//                             style={{ width: `${columnWidths.vat}px`, flexShrink: 0, height: '100%' }}
//                         >
//                             <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
//                                 {formatCurrency(bill.vatAmount)}
//                             </span>
//                         </div>
//                     </>
//                 )}

//                 {/* Round Off */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center justify-content-end"
//                     style={{ width: `${columnWidths.roundOff}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
//                         {formatCurrency(bill.roundOffAmount)}
//                     </span>
//                 </div>

//                 {/* Total */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center justify-content-end"
//                     style={{ width: `${columnWidths.total}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
//                         {formatCurrency(bill.totalAmount)}
//                     </span>
//                 </div>

//                 {/* User */}
//                 <div
//                     className="px-2 border-end d-flex align-items-center"
//                     style={{ width: `${columnWidths.user}px`, flexShrink: 0, height: '100%' }}
//                     title={bill.user?.name || 'N/A'}
//                 >
//                     <span style={{
//                         fontSize: '0.85rem',
//                         whiteSpace: 'nowrap',
//                         overflow: 'hidden',
//                         textOverflow: 'ellipsis',
//                         display: 'block',
//                         width: '100%'
//                     }}>
//                         {bill.user?.name || '-'}
//                     </span>
//                 </div>

//                 {/* Actions */}
//                 <div
//                     className="px-2 d-flex align-items-center justify-content-end gap-1"
//                     style={{ width: `${columnWidths.actions}px`, flexShrink: 0, height: '100%' }}
//                 >
//                     <Button
//                         variant="outline-info"
//                         size="sm"
//                         className="p-0 d-flex align-items-center justify-content-center"
//                         style={{ width: '24px', height: '24px', flexShrink: 0 }}
//                         onClick={handleViewClick}
//                         title="View"
//                     >
//                         <i className="fas fa-eye fa-xs"></i>
//                     </Button>
//                     <Button
//                         variant="outline-warning"
//                         size="sm"
//                         className="p-0 d-flex align-items-center justify-content-center"
//                         style={{ width: '24px', height: '24px', flexShrink: 0 }}
//                         onClick={handleEditClick}
//                         title="Edit"
//                     >
//                         <i className="fas fa-edit fa-xs"></i>
//                     </Button>
//                 </div>
//             </div>
//         );
//     });

//     // Resize Handle Component
//     const ResizeHandle = React.memo(({ onResizeStart, left, columnName }) => {
//         return (
//             <div
//                 className="resize-handle"
//                 style={{
//                     position: 'absolute',
//                     top: 0,
//                     left: `${left}px`,
//                     width: '5px',
//                     height: '100%',
//                     cursor: 'col-resize',
//                     backgroundColor: 'transparent',
//                     zIndex: 10,
//                     userSelect: 'none'
//                 }}
//                 onMouseDown={(e) => {
//                     e.preventDefault();
//                     onResizeStart(e, columnName);
//                 }}
//             />
//         );
//     });

//     // Reset column widths function
//     const resetColumnWidths = () => {
//         setColumnWidths({
//             date: 90,
//             voucherNo: 80,
//             invoiceNo: 80,
//             supplier: 150,
//             paymentMode: 80,
//             subTotal: 90,
//             discount: 110,
//             taxable: 90,
//             vat: 80,
//             roundOff: 80,
//             total: 90,
//             user: 100,
//             actions: 100
//         });
//     };

//     // Calculate total width for the table
//     const getTotalTableWidth = () => {
//         const showVatColumns = data.company?.vatEnabled && !data.company?.isVatExempt;
//         let totalWidth = 0;
        
//         totalWidth += columnWidths.date;
//         totalWidth += columnWidths.voucherNo;
//         totalWidth += columnWidths.invoiceNo;
//         totalWidth += columnWidths.supplier;
//         totalWidth += columnWidths.paymentMode;
//         totalWidth += columnWidths.subTotal;
//         totalWidth += columnWidths.discount;
        
//         if (showVatColumns) {
//             totalWidth += columnWidths.taxable;
//             totalWidth += columnWidths.vat;
//         }
        
//         totalWidth += columnWidths.roundOff;
//         totalWidth += columnWidths.total;
//         totalWidth += columnWidths.user;
//         totalWidth += columnWidths.actions;
        
//         return totalWidth;
//     };

//     // Format currency function
//     const formatCurrency = (num) => {
//         const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
//         if (company.dateFormat === 'nepali') {
//             return number.toLocaleString('en-IN', {
//                 minimumFractionDigits: 2,
//                 maximumFractionDigits: 2
//             });
//         }
//         return number.toLocaleString('en-US', {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2
//         });
//     };

//     const handleDateChange = (e) => {
//         const { name, value } = e.target;
//         setData(prev => ({ ...prev, [name]: value }));
//     };

//     const handleSearchChange = (e) => {
//         setSearchQuery(e.target.value);
//     };

//     const handlePaymentModeFilterChange = (e) => {
//         setPaymentModeFilter(e.target.value);
//     };

//     const handleGenerateReport = () => {
//         if (!data.fromDate || !data.toDate) {
//             setError('Please select both from and to dates');
//             return;
//         }
//         setShouldFetch(true);
//     };

//     const handlePrint = (filtered = false) => {
//         const vatEnabled = data.company?.vatEnabled || false;
//         const isVatExempt = data.company?.isVatExempt || false;
//         const showVatColumns = vatEnabled && !isVatExempt;

//         const billsToPrint = filtered ? filteredBills : data.bills;

//         if (billsToPrint.length === 0) {
//             alert("No bills to print");
//             return;
//         }

//         const printWindow = window.open("", "_blank");
//         const printHeader = `
//         <div class="print-header">
//             <h1>${data.currentCompanyName || 'Company Name'}</h1>
//             <p>
//                 ${data.currentCompany?.address || ''}-${data.currentCompany?.ward || ''}, ${data.currentCompany?.city || ''},
//                 TPIN: ${data.currentCompany?.pan || ''}<br>
//             </p>
//             <hr>
//         </div>
//         `;

//         let tableContent = `
//         <style>
//             @page {
//                 size: A4 landscape;
//                 margin: 10mm;
//             }
//             body { 
//                 font-family: Arial, sans-serif; 
//                 font-size: 10px; 
//                 margin: 0;
//                 padding: 10mm;
//             }
//             table { 
//                 width: 100%; 
//                 border-collapse: collapse; 
//                 page-break-inside: auto;
//             }
//             tr { 
//                 page-break-inside: avoid; 
//                 page-break-after: auto; 
//             }
//             th, td { 
//                 border: 1px solid #000; 
//                 padding: 4px; 
//                 text-align: left; 
//                 white-space: nowrap;
//             }
//             th { 
//                 background-color: #f2f2f2 !important; 
//                 -webkit-print-color-adjust: exact; 
//             }
//             .print-header { 
//                 text-align: center; 
//                 margin-bottom: 15px; 
//             }
//             .nowrap {
//                 white-space: nowrap;
//             }
//         </style>
//         ${printHeader}
//         <h1 style="text-align:center;text-decoration:underline;">Purchase Voucher's Register</h1>
//         <table>
//             <thead>
//                 <tr>
//                     <th class="nowrap">Date</th>
//                     <th class="nowrap">Vch. No.</th>
//                     <th class="nowrap">Inv No.</th>
//                     <th class="nowrap">Suppliers Name</th>
//                     <th class="nowrap">Pay Mode</th>
//                     <th class="nowrap">Sub Total</th>
//                     <th class="nowrap">Discount</th>
//                     ${showVatColumns ? `
//                     <th class="nowrap">Taxable</th>
//                     <th class="nowrap">VAT</th>
//                     ` : ''}
//                     <th class="nowrap">Round Off</th>
//                     <th class="nowrap">Total</th>
//                     <th class="nowrap">User</th>
//                 </tr>
//             </thead>
//             <tbody>
//         `;

//         let totals = {
//             subTotal: 0,
//             discount: 0,
//             taxable: 0,
//             vat: 0,
//             roundOff: 0,
//             amount: 0
//         };

//         billsToPrint.forEach(bill => {
//             tableContent += `
//             <tr>
//                 <td class="nowrap">${new Date(bill.date).toLocaleDateString()}</td>
//                 <td class="nowrap">${bill.billNumber}</td>
//                 <td class="nowrap">${bill.partyBillNumber || 'N/A'}</td>
//                 <td class="nowrap">${bill.account?.name || 'N/A'}</td>
//                 <td class="nowrap">${bill.paymentMode}</td>
//                 <td class="nowrap">${bill.subTotal?.toFixed(2)}</td>
//                 <td class="nowrap">${bill.discountPercentage?.toFixed(2)}% - ${bill.discountAmount?.toFixed(2)}</td>
//                 ${showVatColumns ? `
//                 <td class="nowrap">${bill.taxableAmount?.toFixed(2)}</td>
//                 <td class="nowrap">${bill.vatAmount?.toFixed(2)}</td>
//                 ` : ''}
//                 <td class="nowrap">${bill.roundOffAmount?.toFixed(2)}</td>
//                 <td class="nowrap">${bill.totalAmount?.toFixed(2)}</td>
//                 <td class="nowrap">${bill.user?.name || 'N/A'}</td>
//             </tr>
//             `;

//             totals.subTotal += parseFloat(bill.subTotal || 0);
//             totals.discount += parseFloat(bill.discountAmount || 0);
//             totals.taxable += parseFloat(bill.taxableAmount || 0);
//             totals.vat += parseFloat(bill.vatAmount || 0);
//             totals.roundOff += parseFloat(bill.roundOffAmount || 0);
//             totals.amount += parseFloat(bill.totalAmount || 0);
//         });

//         // Add final totals row
//         tableContent += `
//             <tr style="font-weight:bold; border-top: 2px solid #000;">
//                 <td colspan="5">Grand Totals</td>
//                 <td>${totals.subTotal.toFixed(2)}</td>
//                 <td>${totals.discount.toFixed(2)}</td>
//                 ${showVatColumns ? `
//                 <td>${totals.taxable.toFixed(2)}</td>
//                 <td>${totals.vat.toFixed(2)}</td>
//                 ` : ''}
//                 <td>${totals.roundOff.toFixed(2)}</td>
//                 <td>${totals.amount.toFixed(2)}</td>
//                 <td></td>
//             </tr>
//             </tbody>
//         </table>
//         `;

//         printWindow.document.write(`
//         <html>
//             <head>
//                 <title>Purchase Voucher's Register</title>
//             </head>
//             <body>
//                 ${tableContent}
//                 <script>
//                     window.onload = function() {
//                         setTimeout(function() {
//                             window.print();
//                         }, 200);
//                     };
//                 <\/script>
//             </body>
//         </html>
//         `);
//         printWindow.document.close();
//     };

//     const handleRowClick = (index) => {
//         setSelectedRowIndex(index);
//     };

//     const handleRowDoubleClick = (billId) => {
//         navigate(`/retailer/purchase/${billId}/print`);
//     };

//     const handleKeyDown = (e, nextFieldId) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             if (nextFieldId) {
//                 const nextField = document.getElementById(nextFieldId);
//                 if (nextField) {
//                     nextField.focus();
//                 }
//             } else {
//                 const focusableElements = Array.from(
//                     document.querySelectorAll('input, select, button, [tabindex]:not([tabindex="-1"])')
//                 ).filter(el => !el.disabled && el.offsetParent !== null);

//                 const currentIndex = focusableElements.findIndex(el => el === e.target);

//                 if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
//                     focusableElements[currentIndex + 1].focus();
//                 }
//             }
//         }
//     };

//     if (error) {
//         return <div className="alert alert-danger text-center py-5">{error}</div>;
//     }

//     if (loading) return <Loader />;

//     return (
//         <div className="container-fluid">
//             <Header />
//             <div className="card shadow">
//                 <div className="card-header bg-white py-3">
//                     <h1 className="h3 mb-0 text-center text-primary">Purchase Voucher's Register</h1>
//                 </div>

//                 <div className="card-body">
//                     {/* Search and Filter Section */}
//                     <div className="row mb-4">
//                         <div className="col-md-8">
//                             <div className="row g-3">
//                                 {/* Date Range Row */}
//                                 <div className="col">
//                                     <label htmlFor="fromDate" className="form-label">From Date</label>
//                                     <input
//                                         type="text"
//                                         name="fromDate"
//                                         id="fromDate"
//                                         ref={company.dateFormat === 'nepali' ? fromDateRef : null}
//                                         className="form-control no-date-icon"
//                                         value={data.fromDate}
//                                         onChange={handleDateChange}
//                                         required
//                                         autoComplete='off'
//                                         onKeyDown={(e) => handleKeyDown(e, 'toDate')}
//                                     />
//                                 </div>
//                                 <div className="col">
//                                     <label htmlFor="toDate" className="form-label">To Date</label>
//                                     <input
//                                         type="text"
//                                         name="toDate"
//                                         id="toDate"
//                                         ref={toDateRef}
//                                         className="form-control no-date-icon"
//                                         value={data.toDate}
//                                         onChange={handleDateChange}
//                                         required
//                                         autoComplete='off'
//                                         onKeyDown={(e) => handleKeyDown(e, 'generateReport')}
//                                     />
//                                 </div>
//                                 <div className="col-md-2 d-flex align-items-end">
//                                     <button
//                                         type="button"
//                                         id="generateReport"
//                                         ref={generateReportRef}
//                                         className="btn btn-primary w-100"
//                                         onClick={handleGenerateReport}
//                                     >
//                                         <i className="fas fa-chart-line me-2" id='generateReport'></i>Generate
//                                     </button>
//                                 </div>

//                                 {/* Search Row */}
//                                 <div className="col-md-4">
//                                     <label htmlFor="searchInput" className="form-label">Search</label>
//                                     <div className="input-group">
//                                         <input
//                                             type="text"
//                                             className="form-control"
//                                             id="searchInput"
//                                             ref={searchInputRef}
//                                             placeholder="Search bills..."
//                                             value={searchQuery}
//                                             onChange={handleSearchChange}
//                                             disabled={data.bills.length === 0}
//                                             autoComplete='off'
//                                         />
//                                         <button
//                                             className="btn btn-outline-secondary"
//                                             type="button"
//                                             onClick={() => setSearchQuery('')}
//                                             disabled={data.bills.length === 0}
//                                         >
//                                             <i className="fas fa-times"></i>
//                                         </button>
//                                     </div>
//                                 </div>

//                                 {/* Payment Mode Filter Row */}
//                                 <div className="col">
//                                     <label htmlFor="paymentModeFilter" className="form-label">Payment Mode</label>
//                                     <select
//                                         className="form-select"
//                                         id="paymentModeFilter"
//                                         ref={paymentModeFilterRef}
//                                         value={paymentModeFilter}
//                                         onChange={handlePaymentModeFilterChange}
//                                         disabled={data.bills.length === 0}
//                                     >
//                                         <option value="">All</option>
//                                         <option value="cash">Cash</option>
//                                         <option value="credit">Credit</option>
//                                     </select>
//                                 </div>
//                             </div>
//                         </div>

//                         {/* Action Buttons */}
//                         <div className="col-md-4 d-flex align-items-end justify-content-end gap-2">
//                             <button
//                                 className="btn btn-primary"
//                                 onClick={() => navigate('/retailer/purchase')}
//                             >
//                                 <i className="fas fa-receipt me-2"></i>New Voucher
//                             </button>
//                             <button
//                                 className="btn btn-secondary"
//                                 onClick={() => handlePrint(false)}
//                                 disabled={data.bills.length === 0}
//                             >
//                                 <i className="fas fa-print"></i>Print All
//                             </button>
//                             <button
//                                 className="btn btn-secondary"
//                                 onClick={() => handlePrint(true)}
//                                 disabled={data.bills.length === 0}
//                             >
//                                 <i className="fas fa-filter"></i>Print Filtered
//                             </button>
//                             <Button
//                                 variant="outline-secondary"
//                                 size="sm"
//                                 onClick={resetColumnWidths}
//                                 title="Reset column widths to default"
//                                 className="d-flex align-items-center"
//                             >
//                                 <i className="fas fa-redo me-1"></i> Reset
//                             </Button>
//                         </div>
//                     </div>

//                     {data.bills.length === 0 ? (
//                         <div className="alert alert-info text-center py-3">
//                             <i className="fas fa-info-circle me-2"></i>
//                             Please select date range and click "Generate Report" to view data
//                         </div>
//                     ) : (
//                         <>
//                             {/* Virtualized Table Container */}
//                             <div style={{ height: '500px', width: '100%', border: '1px solid #dee2e6' }}>
//                                 {loading ? (
//                                     <div className="text-center p-4">
//                                         <Spinner animation="border" variant="primary" />
//                                         <p className="mt-2">Loading bills...</p>
//                                     </div>
//                                 ) : filteredBills.length === 0 ? (
//                                     <div className="text-center p-4">No bills found</div>
//                                 ) : (
//                                     <AutoSizer>
//                                         {({ height, width }) => {
//                                             const totalWidth = getTotalTableWidth();
//                                             const showVatColumns = data.company?.vatEnabled && !data.company?.isVatExempt;

//                                             return (
//                                                 <div style={{
//                                                     position: 'relative',
//                                                     height: height,
//                                                     width: Math.max(width, totalWidth),
//                                                     overflowX: 'auto'
//                                                 }}>
//                                                     <TableHeader />
//                                                     <List
//                                                         height={height - 35}
//                                                         itemCount={filteredBills.length}
//                                                         itemSize={35}
//                                                         width={Math.max(width, totalWidth)}
//                                                         itemData={{
//                                                             bills: filteredBills,
//                                                             selectedRowIndex,
//                                                             showVatColumns,
//                                                             formatCurrency,
//                                                             onRowClick: handleRowClick
//                                                         }}
//                                                     >
//                                                         {TableRow}
//                                                     </List>
//                                                 </div>
//                                             );
//                                         }}
//                                     </AutoSizer>
//                                 )}
//                             </div>

//                             {/* Totals Footer */}
//                             <div className="mt-3 p-3 bg-light border rounded">
//                                 <div className="row align-items-center">
//                                     <div className="col-md-3">
//                                         <div className="fw-bold">Total Bills: {filteredBills.length}</div>
//                                     </div>
//                                     <div className="col-md-9">
//                                         <div className="d-flex justify-content-end gap-4">
//                                             <div className="text-end">
//                                                 <div className="text-muted small">Sub Total</div>
//                                                 <div className="fw-bold">{formatCurrency(totals.subTotal)}</div>
//                                             </div>
//                                             <div className="text-end">
//                                                 <div className="text-muted small">Discount</div>
//                                                 <div className="fw-bold">{formatCurrency(totals.discount)}</div>
//                                             </div>
//                                             {data.company?.vatEnabled && !data.company?.isVatExempt && (
//                                                 <>
//                                                     <div className="text-end">
//                                                         <div className="text-muted small">Taxable</div>
//                                                         <div className="fw-bold">{formatCurrency(totals.taxable)}</div>
//                                                     </div>
//                                                     <div className="text-end">
//                                                         <div className="text-muted small">VAT</div>
//                                                         <div className="fw-bold">{formatCurrency(totals.vat)}</div>
//                                                     </div>
//                                                 </>
//                                             )}
//                                             <div className="text-end">
//                                                 <div className="text-muted small">Round Off</div>
//                                                 <div className="fw-bold">{formatCurrency(totals.roundOff)}</div>
//                                             </div>
//                                             <div className="text-end">
//                                                 <div className="text-muted small">Total Amount</div>
//                                                 <div className="fw-bold text-primary">{formatCurrency(totals.amount)}</div>
//                                             </div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             </div>
//                         </>
//                     )}
//                 </div>
//             </div>

//             {/* Product modal */}
//             {showProductModal && (
//                 <ProductModal onClose={() => setShowProductModal(false)} />
//             )}
//         </div>
//     );
// };

// export default PurchaseBillsList;