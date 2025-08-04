import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../Header';

const StockStatus = () => {
    const [stockData, setStockData] = useState({
        company: null,
        fiscalYear: null,
        items: [],
        user: null,
        showPurchaseValue: false,
        showSalesValue: false
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const searchInputRef = useRef(null);

    useEffect(() => {
        const fetchStockStatus = async () => {
            try {
                const response = await axios.get('/api/retailer/stock-status', {
                    params: {
                        showPurchaseValue: stockData.showPurchaseValue,
                        showSalesValue: stockData.showSalesValue
                    }
                });
                setStockData(response.data);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to fetch stock status');
                setLoading(false);
            }
        };

        fetchStockStatus();
    }, [stockData.showPurchaseValue, stockData.showSalesValue]);

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setStockData(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const filteredItems = stockData.items.filter(item => {
        const query = searchQuery.toLowerCase();
        return (
            item.name.toLowerCase().includes(query) ||
            (item.category && item.category.toLowerCase().includes(query))
        );
    });

    const calculateTotals = () => {
        return filteredItems.reduce((acc, item) => {
            acc.totalStock += item.stock;
            acc.totalOpeningStock += item.openingStock;
            acc.totalQtyIn += item.totalQtyIn;
            acc.totalQtyOut += item.totalQtyOut;
            
            if (stockData.showPurchaseValue) {
                acc.totalPurchaseValue += item.totalStockValuePurchase;
            }
            
            if (stockData.showSalesValue) {
                acc.totalSalesValue += item.totalStockValueSales;
            }
            
            return acc;
        }, {
            totalStock: 0,
            totalOpeningStock: 0,
            totalQtyIn: 0,
            totalQtyOut: 0,
            totalPurchaseValue: 0,
            totalSalesValue: 0
        });
    };

    const totals = calculateTotals();

    const printStockStatus = (itemsToPrint) => {
        const printWindow = window.open('', '_blank');
        
        const printContent = `
            <html>
                <head>
                    <title>Stock Status Report</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @page { size: A4 landscape; margin: 10mm; }
                        body { font-size: 12px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 8px; text-align: left; border: 1px solid #dee2e6; }
                        th { background-color: #f8f9fa; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .compact-cell { white-space: nowrap; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="text-center mb-4">Stock Status</h1>
                        <div class="text-center mb-3">
                            <p>As on: ${new Date().toLocaleDateString()}</p>
                            <p>Fiscal Year: ${stockData.fiscalYear?.name || 'Not specified'}</p>
                        </div>
                        
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Item Name</th>
                                    <th>Category</th>
                                    <th>Unit</th>
                                    <th>Total Stock</th>
                                    <th>Op. Stock</th>
                                    <th>Qty. In</th>
                                    <th>Qty. Out</th>
                                    <th>Min Stock</th>
                                    <th>Max Stock</th>
                                    <th>C.P</th>
                                    <th>S.P</th>
                                    ${stockData.showPurchaseValue ? '<th>St.Val (C.P)</th>' : ''}
                                    ${stockData.showSalesValue ? '<th>St.Val (S.P)</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsToPrint.map((item, index) => `
                                    <tr>
                                        <td class="compact-cell">${index + 1}</td>
                                        <td class="compact-cell">${item.name}</td>
                                        <td class="compact-cell">${item.category || '-'}</td>
                                        <td class="compact-cell">${item.unit || '-'}</td>
                                        <td class="compact-cell">${item.stock.toFixed(2)}</td>
                                        <td class="compact-cell">${item.openingStock.toFixed(2)}</td>
                                        <td class="compact-cell">${item.totalQtyIn.toFixed(2)}</td>
                                        <td class="compact-cell">${item.totalQtyOut.toFixed(2)}</td>
                                        <td class="compact-cell">${item.minStock || '-'}</td>
                                        <td class="compact-cell">${item.maxStock || '-'}</td>
                                        <td class="compact-cell">${item.avgPuPrice.toFixed(2)}</td>
                                        <td class="compact-cell">${item.avgPrice.toFixed(2)}</td>
                                        ${stockData.showPurchaseValue ? `<td class="compact-cell">${item.totalStockValuePurchase.toFixed(2)}</td>` : ''}
                                        ${stockData.showSalesValue ? `<td class="compact-cell">${item.totalStockValueSales.toFixed(2)}</td>` : ''}
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="font-weight: bold;">
                                    <td colspan="4">Totals</td>
                                    <td class="compact-cell">${totals.totalStock.toFixed(2)}</td>
                                    <td class="compact-cell">${totals.totalOpeningStock.toFixed(2)}</td>
                                    <td class="compact-cell">${totals.totalQtyIn.toFixed(2)}</td>
                                    <td class="compact-cell">${totals.totalQtyOut.toFixed(2)}</td>
                                    <td colspan="2"></td>
                                    <td></td>
                                    <td></td>
                                    ${stockData.showPurchaseValue ? `<td class="compact-cell">${totals.totalPurchaseValue.toFixed(2)}</td>` : ''}
                                    ${stockData.showSalesValue ? `<td class="compact-cell">${totals.totalSalesValue.toFixed(2)}</td>` : ''}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    if (loading) return (
        <div className="container-fluid">
            <Header />
            <div className="alert alert-info text-center py-3">
                <i className="fas fa-spinner fa-spin me-2"></i>Loading stock status...
            </div>
        </div>
    );

    if (error) return (
        <div className="container-fluid">
            <Header />
            <div className="alert alert-danger text-center py-3">
                <i className="fas fa-exclamation-circle me-2"></i>{error}
            </div>
        </div>
    );

    return (
        <div className="container-fluid">
            <Header />
            <div className="card shadow">
                <div className="card-header bg-white py-3">
                    <h1 className="h3 mb-0 text-center text-primary">Stock Status</h1>
                    <div className="text-center">
                        <small>As on: {new Date().toLocaleDateString()} (F.Y: {stockData.fiscalYear?.name || 'Not specified'})</small>
                    </div>
                </div>

                <div className="card-body">
                    {/* Search and Filter Section */}
                    <div className="row mb-4">
                        <div className="col-md-8">
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="searchInput" className="form-label">Search</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="searchInput"
                                            ref={searchInputRef}
                                            placeholder="Search items..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            autoComplete="off"
                                            autoFocus
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label d-block">&nbsp;</label>
                                    <div className="form-check form-check-inline">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="showPurchaseValue"
                                            checked={stockData.showPurchaseValue}
                                            onChange={handleCheckboxChange}
                                            name="showPurchaseValue"
                                        />
                                        <label className="form-check-label" htmlFor="showPurchaseValue">
                                            St.Value On C.P
                                        </label>
                                    </div>
                                </div>

                                <div className="col-md-3">
                                    <label className="form-label d-block">&nbsp;</label>
                                    <div className="form-check form-check-inline">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="showSalesValue"
                                            checked={stockData.showSalesValue}
                                            onChange={handleCheckboxChange}
                                            name="showSalesValue"
                                        />
                                        <label className="form-check-label" htmlFor="showSalesValue">
                                            St.Value On S.P
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="col-md-4 d-flex align-items-end justify-content-end gap-2">
                            <button
                                className="btn btn-secondary"
                                onClick={() => printStockStatus(stockData.items)}
                                disabled={stockData.items.length === 0}
                            >
                                <i className="fas fa-print me-2"></i>Print All
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => printStockStatus(filteredItems)}
                                disabled={stockData.items.length === 0}
                            >
                                <i className="fas fa-filter me-2"></i>Print Filtered
                            </button>
                        </div>
                    </div>

                    {stockData.items.length === 0 ? (
                        <div className="alert alert-info text-center py-3">
                            <i className="fas fa-info-circle me-2"></i>
                            No stock items found
                        </div>
                    ) : (
                        <>
                            {/* Stock Items Table */}
                            <div className="table-responsive">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Item Name</th>
                                            <th>Category</th>
                                            <th>Unit</th>
                                            <th className="text-end">Total Stock</th>
                                            <th className="text-end">Op. Stock</th>
                                            <th className="text-end">Qty. In</th>
                                            <th className="text-end">Qty. Out</th>
                                            <th className="text-end">Min Stock</th>
                                            <th className="text-end">Max Stock</th>
                                            <th className="text-end">C.P</th>
                                            <th className="text-end">S.P</th>
                                            {stockData.showPurchaseValue && <th className="text-end">St.Val (C.P)</th>}
                                            {stockData.showSalesValue && <th className="text-end">St.Val (S.P)</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.map((item, index) => (
                                            <tr key={item._id}>
                                                <td className="compact-cell">{index + 1}</td>
                                                <td className="compact-cell">{item.name}</td>
                                                <td className="compact-cell">{item.category || '-'}</td>
                                                <td className="compact-cell">{item.unit || '-'}</td>
                                                <td className="compact-cell text-end">{item.stock.toFixed(2)}</td>
                                                <td className="compact-cell text-end">{item.openingStock.toFixed(2)}</td>
                                                <td className="compact-cell text-end">{item.totalQtyIn.toFixed(2)}</td>
                                                <td className="compact-cell text-end">{item.totalQtyOut.toFixed(2)}</td>
                                                <td className="compact-cell text-end">{item.minStock || '-'}</td>
                                                <td className="compact-cell text-end">{item.maxStock || '-'}</td>
                                                <td className="compact-cell text-end">{item.avgPuPrice.toFixed(2)}</td>
                                                <td className="compact-cell text-end">{item.avgPrice.toFixed(2)}</td>
                                                {stockData.showPurchaseValue && (
                                                    <td className="compact-cell text-end">{item.totalStockValuePurchase.toFixed(2)}</td>
                                                )}
                                                {stockData.showSalesValue && (
                                                    <td className="compact-cell text-end">{item.totalStockValueSales.toFixed(2)}</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="fw-bold">
                                            <td colSpan="4">Total:</td>
                                            <td className="text-end">{totals.totalStock.toFixed(2)}</td>
                                            <td className="text-end">{totals.totalOpeningStock.toFixed(2)}</td>
                                            <td className="text-end">{totals.totalQtyIn.toFixed(2)}</td>
                                            <td className="text-end">{totals.totalQtyOut.toFixed(2)}</td>
                                            <td colSpan="2"></td>
                                            <td></td>
                                            <td></td>
                                            {stockData.showPurchaseValue && (
                                                <td className="text-end">{totals.totalPurchaseValue.toFixed(2)}</td>
                                            )}
                                            {stockData.showSalesValue && (
                                                <td className="text-end">{totals.totalSalesValue.toFixed(2)}</td>
                                            )}
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

export default StockStatus;