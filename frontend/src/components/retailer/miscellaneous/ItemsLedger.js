import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import NepaliDate from 'nepali-date';
import { Modal, Button, Form, Table, InputGroup, FormControl, Badge } from 'react-bootstrap';
import { BiBox, BiSearch, BiPrinter } from 'react-icons/bi';
import '../../../stylesheet/retailer/Items/ItemsLedger.css'
import Header from '../Header';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';

const ItemsLedger = () => {

    const currentNepaliDate = new NepaliDate().format('YYYY/MM/DD');
    const currentEnglishDate = new Date().toISOString().split('T')[0];
    const { draftSave, setDraftSave, clearDraft } = usePageNotRefreshContext();
    const [company, setCompany] = useState({
        dateFormat: 'nepali',
        vatEnabled: true,
        fiscalYear: {}
    });

    const [data, setData] = useState(() => {
        if (draftSave && draftSave.itemsLedgerData) {
            return draftSave.itemsLedgerData;
        }
        return {
            company: null,
            currentFiscalYear: null,
            fromDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate,
            toDate: company.dateFormat === 'nepali' ? currentNepaliDate : currentEnglishDate
        };
    });

    const selectedItemRef = useRef(null);
    const fromDateRef = useRef(null);
    const toDateRef = useRef(null);

    const [showItemModal, setShowItemModal] = useState(false);
    const [items, setItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(draftSave?.itemsLedgerData?.selectedItem || null);
    const [ledgerData, setLedgerData] = useState(draftSave?.itemsLedgerData?.ledgerData || null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(draftSave?.itemsLedgerData?.searchTerm || '');
    const [typeFilter, setTypeFilter] = useState(draftSave?.itemsLedgerData?.typeFilter || '');
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const itemListRef = useRef(null);
    const tableRef = useRef(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    // Fetch items for modal
    const fetchItems = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/items/search/getFetched');

            setItems(response.data.data);
            setFilteredItems(response.data.data);
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            setLoading(false);
        }
    };

    // Add this useEffect to your component
    useEffect(() => {
        if (itemListRef.current && filteredItems.length > 0) {
            const selectedElement = itemListRef.current.querySelector(`.list-group-item:nth-child(${selectedRowIndex + 1})`);
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedRowIndex, filteredItems]);

    // Save to draft when data changes
    useEffect(() => {
        const draftData = {
            ...data,
            selectedItem,
            ledgerData,
            searchTerm,
            typeFilter
        };
        
        setDraftSave({
            ...draftSave,
            itemsLedgerData: draftData
        });
    }, [data, selectedItem, ledgerData, searchTerm, typeFilter]);
    
    // Filter items based on search term
    useEffect(() => {
        if (searchTerm === '') {
            setFilteredItems(items);
        } else {
            const filtered = items.filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setFilteredItems(filtered);
        }
    }, [searchTerm, items]);

    const fetchItemLedger = async () => {
        if (!selectedItem || !data.fromDate || !data.toDate) return;

        try {
            setLoading(true);
            const response = await api.get(`/api/retailer/items-ledger/${selectedItem.id}`, {
                params: {
                    fromDate: data.fromDate,
                    toDate: data.toDate
                }
            });

            if (response.data.success) {
                setLedgerData(response.data.data); // Access the data property
            } else {
                console.error('Error from server:', response.data.error);
                // Show error to user
            }
        } catch (error) {
            console.error('Error fetching ledger data:', error);
            if (error.response) {
                console.error('Server responded with:', error.response.data);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle item selection
    const handleSelectItem = (item) => {
        setSelectedItem({
            id: item._id,
            name: item.name,
            unit: item.unit?.name || 'N/A'
        });
        setShowItemModal(false);
        setSearchTerm('');
    };

    // Handle keyboard navigation in modal
    const handleModalKeyDown = (e) => {
        if (filteredItems.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedRowIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedRowIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredItems[selectedRowIndex]) {
                    handleSelectItem(filteredItems[selectedRowIndex]);
                }
                break;
            default:
                break;
        }
    };

    // Filter ledger entries
    const filteredEntries = ledgerData?.entries?.filter(entry => {
        const matchesSearch = entry.partyName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = !typeFilter || entry.type.toLowerCase() === typeFilter.toLowerCase();
        return matchesSearch && matchesType;
    }) || [];

    // Calculate totals
    const totals = filteredEntries.reduce((acc, entry) => {
        return {
            qtyIn: acc.qtyIn + (entry.qtyIn || 0),
            qtyOut: acc.qtyOut + (entry.qtyOut || 0),
            free: acc.free + (entry.bonus || 0),
            balance: entry.balance || 0
        };
    }, { qtyIn: 0, qtyOut: 0, free: 0, balance: 0 });

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="container-fluid">
            <Header />
            <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
                <div className="card-header">
                    <h2 className="card-title text-center">
                        <BiBox className="mr-2" />
                        {selectedItem ? `Items Ledger: ${selectedItem.name}` : 'Items Ledger'}
                    </h2>
                </div>

                <div className="card-body">
                    <div className="filter-section">
                        <div className="filter-group">
                            <label htmlFor="Items" className="font-weight-bold">Items</label>
                            <div className="input-group">
                                <FormControl
                                    type="text"
                                    placeholder="Select an item..."
                                    value={selectedItem?.name || ''}
                                    onClick={() => setShowItemModal(true)}
                                    readOnly
                                />
                            </div>
                        </div>

                        <Form id="ledgerFilterForm" onSubmit={(e) => {
                            e.preventDefault();
                            fetchItemLedger();
                        }}>
                            <div className="row g-3">
                                <div className="filter-group">
                                    <label htmlFor="fromDate">From Date</label>
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
                                        autoComplete='off'
                                    />
                                </div>
                                <div className="filter-group">
                                    <label htmlFor="toDate">To Date</label>
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
                                    />
                                </div>
                                <div className="filter-group">
                                    <label htmlFor=""></label>
                                    <div className="action-buttons">
                                        <Button variant="primary" type="submit">
                                            Generate Report
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Form>

                        <div className="filter-group">
                            <label htmlFor="searchInput" className="font-weight-bold">Search Party</label>
                            <InputGroup>
                                <InputGroup.Text>
                                    <BiSearch />
                                </InputGroup.Text>
                                <FormControl
                                    type="text"
                                    id="searchInput"
                                    placeholder="Search by party name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </InputGroup>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="adjustmentTypeFilter" className="font-weight-bold">Filter by Type</label>
                            <Form.Select
                                id="adjustmentTypeFilter"
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                            >
                                <option value="">All Transactions</option>
                                <option value="xcess">Xcess</option>
                                <option value="short">Short</option>
                                <option value="Sale">Sales</option>
                                <option value="SlRt">Sales Return</option>
                                <option value="Purc">Purchase</option>
                                <option value="PrRt">Purchase Return</option>
                            </Form.Select>
                        </div>
                    </div>

                    <div className="toolbar">
                        <Button
                            variant="secondary"
                            className="btn-action"
                            disabled={!ledgerData}
                            onClick={() => {
                                setSearchTerm('');
                                setTypeFilter('');
                            }}
                        >
                            <BiPrinter className="mr-1" /> Print All
                        </Button>
                        <Button
                            variant="secondary"
                            className="btn-action"
                            disabled={!ledgerData}
                            onClick={() => window.print()}
                        >
                            <BiPrinter className="mr-1" /> Print Filtered
                        </Button>
                    </div>

                    <div className="table-container">
                        <Table striped bordered hover className="ledger-table" ref={tableRef}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Vouch/Inv.</th>
                                    <th>Party Name</th>
                                    <th>Type</th>
                                    <th>Qty. In</th>
                                    <th>Qty. Out</th>
                                    <th>Free</th>
                                    <th>Unit</th>
                                    <th>Rate (Rs.)</th>
                                    <th>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan="10" className="text-center py-4">
                                            Loading ledger data...
                                        </td>
                                    </tr>
                                )}

                                {!loading && !ledgerData && (
                                    <tr>
                                        <td colSpan="10" className="text-center py-4 text-muted">
                                            Please select an item and date range to view its ledger
                                        </td>
                                    </tr>
                                )}

                                {!loading && ledgerData && (
                                    <>
                                        <tr className="opening-row">
                                            <td colSpan="3"><strong>Opening Stock</strong></td>
                                            <td colSpan="5"></td>
                                            <td><strong>{ledgerData.purchasePrice || ''}</strong></td>
                                            <td><strong>{ledgerData.openingStock || '0.00'}</strong></td>
                                        </tr>

                                        {filteredEntries.map((entry, index) => (
                                            <tr
                                                key={index}
                                                className={`searchClass ${index === selectedRowIndex ? 'selected-row' : ''}`}
                                                onClick={() => setSelectedRowIndex(index)}
                                            >
                                                <td>{new Date(entry.date).toLocaleDateString()}</td>
                                                <td>{entry.billNumber || ''}</td>
                                                <td>{entry.partyName}</td>
                                                <td className={`type-${entry.type}`}>{entry.type}</td>
                                                <td>{entry.qtyIn || '-'}</td>
                                                <td>{entry.qtyOut || '-'}</td>
                                                <td>{entry.bonus || 0}</td>
                                                <td>{entry.unit || ''}</td>
                                                <td>{entry.price || ''}</td>
                                                <td>{entry.balance?.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </>
                                )}
                            </tbody>

                            {ledgerData && filteredEntries.length > 0 && (
                                <tfoot>
                                    <tr className="bg-light">
                                        <td colSpan="4"><strong>Totals:</strong></td>
                                        <td><strong>{totals.qtyIn.toFixed(2)}</strong></td>
                                        <td><strong>{totals.qtyOut.toFixed(2)}</strong></td>
                                        <td><strong>{totals.free.toFixed(2)}</strong></td>
                                        <td></td>
                                        <td></td>
                                        <td><strong>{totals.balance.toFixed(2)}</strong></td>
                                    </tr>
                                </tfoot>
                            )}
                        </Table>
                    </div>
                </div>
            </div>

            {/* Item Selection Modal */}
            <Modal
                show={showItemModal}
                onHide={() => setShowItemModal(false)}
                onShow={fetchItems}
                size="xl"
                centered
                className="custom-items-modal"
            >
                <Modal.Header closeButton>
                    <Modal.Title>Select an Item</Modal.Title>
                </Modal.Header>
                <div className="p-3 bg-white sticky-top">
                    <FormControl
                        type="text"
                        placeholder="Search Item"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleModalKeyDown}
                        autoFocus
                    />
                </div>
                <Modal.Body className="p-0">
                    <div className="item-list-container" ref={itemListRef}>
                        {loading && (
                            <div className="list-group-item text-muted">Loading items...</div>
                        )}

                        {!loading && filteredItems.length === 0 && (
                            <div className="list-group-item text-muted">No items found</div>
                        )}

                        <div className="list-group">
                            {filteredItems.map((item, index) => (
                                <div
                                    key={item._id}
                                    className={`list-group-item item-item ${index === selectedRowIndex ? 'active' : ''}`}
                                    onClick={() => handleSelectItem(item)}
                                    ref={index === selectedRowIndex ? selectedItemRef : null}
                                >
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong>{item.name}</strong>
                                            <div className="text-muted small">
                                                {item.code && `Code: ${item.code}`}
                                            </div>
                                        </div>
                                        <Badge bg="primary" pill>{item.category || ''}</Badge>
                                        <strong>{item.stock?.toFixed(2) || '0.00'} {item.unit?.name || ''}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default ItemsLedger;