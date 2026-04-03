// import React, { useState, useEffect } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import {
//     Container,
//     Card,
//     Row,
//     Col,
//     ListGroup,
//     Button,
//     Badge,
//     Modal,
//     Form,
//     Alert
// } from 'react-bootstrap';
// import { FaBarcode, FaArrowLeft } from 'react-icons/fa';
// import axios from 'axios';
// import NotificationToast from '../../NotificationToast';
// import ItemBarcode from './ItemBarcode';

// const ViewItems = () => {
//     const { id } = useParams();
//     const navigate = useNavigate();
//     const [item, setItem] = useState(null);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState(null);
//     const [toast, setToast] = useState({
//         show: false,
//         message: '',
//         type: 'success' // 'success' or 'error'
//     });
//     const [printSettings, setPrintSettings] = useState({
//         labelWidth: 70,
//         labelHeight: 40,
//         labelsPerRow: 3,
//         barcodeType: 'code128',
//         quantity: 1,
//         saveSettings: false
//     });
//     const [showPrintModal, setShowPrintModal] = useState(false);
//     const [currentPrintEntry, setCurrentPrintEntry] = useState(null);
//     // const [statusMessage, setStatusMessage] = useState('');

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     useEffect(() => {
//         const fetchItemData = async () => {
//             try {
//                 const itemResponse = await api.get(`/api/retailer/items/${id}`);
//                 if (!itemResponse.data || !itemResponse.data.data) {
//                     throw new Error('Item data not found in response');
//                 }

//                 const { data: responseData } = itemResponse.data;
//                 const { item, stockInfo } = responseData;

//                 // Use the already-processed stockInfo from the API
//                 const processedItem = {
//                     ...item,
//                     name: item.name || 'N/A',
//                     hscode: item.hscode || 'N/A',
//                     vatStatus: item.vatStatus || 'N/A',
//                     status: item.status || 'active',
//                     currentOpeningStock: {
//                         openingStock: stockInfo.openingStock || 0,
//                         openingStockValue: stockInfo.openingStockValue || '0.00',
//                         salesPrice: stockInfo.salesPrice || 0,
//                         purchasePrice: stockInfo.purchasePrice.toFixed(2) || '0.00'
//                     },
//                     stockEntries: item.stockEntries || [],
//                     printPreferences: responseData.printPreferences || {
//                         labelWidth: 70,
//                         labelHeight: 40,
//                         labelsPerRow: 3,
//                         barcodeType: 'code128',
//                         defaultQuantity: 1
//                     }
//                 };

//                 setItem(processedItem);
//                 setPrintSettings(prev => ({
//                     ...prev,
//                     ...processedItem.printPreferences
//                 }));
//             } catch (err) {
//                 setError(err.message || 'Failed to fetch item details');
//                 console.error('Fetch error:', err);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchItemData();
//     }, [id]);


//     const toggleItemStatus = async () => {
//         try {
//             const newStatus = item.status === 'active' ? 'inactive' : 'active';
//             const response = await api.post(`/api/retailer/items/${item._id}/status`, {
//                 status: newStatus
//             });

//             if (response.data.success) {
//                 setItem(prev => ({ ...prev, status: newStatus }));
//                 setToast({
//                     show: true,
//                     message: `Item status updated to ${newStatus}`,
//                     type: 'success'
//                 });
//             } else {
//                 throw new Error(response.data.error || 'Failed to update status');
//             }
//         } catch (err) {
//             // setError(err.response?.data?.error || err.message || 'Failed to update status');
//             // Show error toast
//             setToast({
//                 show: true,
//                 message: err.response?.data?.error || err.message || 'Failed to update status',
//                 type: 'error'
//             });
//         }
//     };

//     const handlePrintBarcode = (entry) => {
//         setCurrentPrintEntry(entry);
//         setShowPrintModal(true);
//     };

//     const confirmPrint = () => {
//         const { labelWidth, labelHeight, labelsPerRow, barcodeType, quantity } = printSettings;
//         const printWindow = window.open('', '_blank');

//         printWindow.document.write(`
//             <html>
//             <head>
//                 <title>Barcode Labels</title>
//                 <style>
//                     @page { size: A4; margin: 0; }
//                     .label-grid {
//                         display: grid;
//                         grid-template-columns: repeat(${labelsPerRow}, 1fr);
//                         gap: 0.1in;
//                         padding: 0.25in;
//                     }
//                     .barcode-container {
//                         display: flex;
//                         flex-direction: column;
//                         align-items: center;
//                         page-break-inside: avoid;
//                         height: ${labelHeight * 0.0393701}in;
//                         padding: 0.1in;
//                     }
//                     .barcode-image {
//                         width: 100%;
//                         height: 70%;
//                         object-fit: contain;
//                     }
//                 </style>
//             </head>
//             <body>
//                 <div class="label-grid">
//                     ${Array.from({ length: quantity }, (_, i) => `
//                         <div class="barcode-container">
//                             <img src="/api/item/${item._id}/barcode/${currentPrintEntry._id}/${labelWidth}/${labelHeight}/${barcodeType}"
//                                 class="barcode-image"
//                                 onload="window.imagesLoaded = (window.imagesLoaded || 0) + 1">
//                             <div>${item.name}</div>
//                             <div>Batch: ${currentPrintEntry.batchNumber}</div>
//                             <div>MRP: ${currentPrintEntry.mrp.toFixed(2)}</div>
//                             <div>Exp: ${new Date(currentPrintEntry.expiryDate).toLocaleDateString()}</div>
//                         </div>
//                     `).join('')}
//                 </div>
//                 <script>
//                     let checkInterval = setInterval(() => {
//                         if (window.imagesLoaded >= ${quantity}) {
//                             clearInterval(checkInterval);
//                             window.print();
//                             setTimeout(() => window.close(), 500);
//                         }
//                     }, 100);
//                 <\/script>
//             </body>
//             </html>
//         `);
//         printWindow.document.close();

//         if (printSettings.saveSettings) {
//             api.post('/api/retailer/user/print-preferences', printSettings);
//         }

//         setShowPrintModal(false);
//     };

//     if (loading) return (
//         <Container className="mt-4">
//             <div className="text-center">Loading item details...</div>
//         </Container>
//     );

//     if (error) return (
//         <Container className="mt-4">
//             <Alert variant="danger">{error}</Alert>
//             <Button variant="primary" onClick={() => navigate(-1)}>
//                 <FaArrowLeft /> Back
//             </Button>
//         </Container>
//     );

//     if (!item) return (
//         <Container className="mt-4">
//             <Alert variant="warning">Item not found</Alert>
//             <Button variant="primary" onClick={() => navigate(-1)}>
//                 <FaArrowLeft /> Back
//             </Button>
//         </Container>
//     );

//     return (
//         <Container className="mt-4">
//             <NotificationToast
//                 show={toast.show}
//                 message={toast.message}
//                 type={toast.type}
//                 onClose={() => setToast({ ...toast, show: false })}
//             />

//             <Card className="shadow-lg p-4">
//                 <Card.Header className="text-center">
//                     <h2 style={{ textDecoration: 'underline' }}>Item Details</h2>
//                 </Card.Header>

//                 <Card.Body>
//                     <Row>
//                         <Col md={4}>
//                             <h5 className="card-title">Details:</h5>
//                             <ListGroup variant="flush">
//                                 <ListGroup.Item>
//                                     <strong>Name:</strong> {item.name}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>HSN:</strong> {item.hscode || 'N/A'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>VAT Status:</strong> {item.vatStatus || 'N/A'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Main Unit:</strong> {item.mainUnit?.name || 'No Main Unit'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>WS Unit:</strong> {item.WSUnit || 'N/A'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Unit:</strong> {item.unit?.name || 'No Unit'}
//                                 </ListGroup.Item>
//                             </ListGroup>
//                         </Col>

//                         <Col md={4}>
//                             <h5 className="card-title">ID: {item._id}</h5>
//                             <ListGroup variant="flush">
//                                 <ListGroup.Item>
//                                     <strong>Sales Price:</strong> {item.currentOpeningStock?.salesPrice?.toFixed(2) || '0.00'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Purchase Price:</strong> {item.currentOpeningStock?.purchasePrice || '0.00'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Opening Stock:</strong> {item.currentOpeningStock?.openingStock || 0}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Opening Stock Value:</strong> {item.currentOpeningStock?.openingStockValue || '0.00'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Re-Order Level:</strong> {item.reorderLevel || 'N/A'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Category:</strong> {item.category?.name || 'No Category'}
//                                 </ListGroup.Item>
//                             </ListGroup>
//                         </Col>

//                         <Col md={4}>
//                             <Button
//                                 variant={item.status === 'active' ? 'danger' : 'success'}
//                                 onClick={toggleItemStatus}
//                                 className="status-btn mb-3"
//                             >
//                                 {item.status === 'active' ? 'Deactivate' : 'Activate'}
//                             </Button>

//                             <ListGroup variant="flush">
//                                 <ListGroup.Item>
//                                     <strong>Status:</strong>{' '}
//                                     <Badge bg={item.status === 'active' ? 'success' : 'danger'}>
//                                         {item.status?.toUpperCase() || 'UNKNOWN'}
//                                     </Badge>
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Barcode:</strong> {item.barcodeNumber || 'N/A'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Unique ID:</strong> {item.uniqueNumber || 'N/A'}
//                                 </ListGroup.Item>
//                                 <ListGroup.Item>
//                                     <strong>Created:</strong> {new Date(item.createdAt).toLocaleDateString()}
//                                 </ListGroup.Item>
//                             </ListGroup>
//                         </Col>
//                     </Row>

//                     <hr />

//                     <Row>
//                         <h5 className="card-title"><strong>Composition: </strong></h5>
//                         <ListGroup variant="flush">
//                             {item.composition?.length > 0 ? (
//                                 item.composition.map(comp => (
//                                     <ListGroup.Item key={comp._id}>
//                                         {comp.uniqueNumber} - {comp.name}
//                                     </ListGroup.Item>
//                                 ))
//                             ) : (
//                                 <ListGroup.Item>No Composition</ListGroup.Item>
//                             )}
//                         </ListGroup>
//                     </Row>
//                 </Card.Body>

//                 <Col className="mb-3">
//                     <Button variant="primary" onClick={() => navigate(-1)}>
//                         <FaArrowLeft /> Back
//                     </Button>
//                 </Col>
//             </Card>
//         </Container>
//     );
// };

// export default ViewItems;

//----------------------------------------------------------------end

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    Card,
    Row,
    Col,
    ListGroup,
    Button,
    Badge,
    Modal,
    Form,
    Alert
} from 'react-bootstrap';
import { FaBarcode, FaArrowLeft } from 'react-icons/fa';
import axios from 'axios';
import NotificationToast from '../../NotificationToast';

const ViewItems = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [printSettings, setPrintSettings] = useState({
        labelWidth: 70,
        labelHeight: 40,
        labelsPerRow: 3,
        barcodeType: 'code128',
        quantity: 1,
        saveSettings: false
    });
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [currentPrintEntry, setCurrentPrintEntry] = useState(null);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchItemData = async () => {
            try {
                const itemResponse = await api.get(`/api/retailer/items/${id}`);
                if (!itemResponse.data?.data) throw new Error('Item data not found');

                const { data: responseData } = itemResponse.data;
                const { item, stockInfo } = responseData;

                const processedItem = {
                    ...item,
                    name: item.name || 'N/A',
                    hscode: item.hscode || 'N/A',
                    vatStatus: item.vatStatus || 'N/A',
                    status: item.status || 'active',
                    currentOpeningStock: {
                        openingStock: stockInfo.openingStock || 0,
                        openingStockValue: stockInfo.openingStockValue || '0.00',
                        salesPrice: stockInfo.salesPrice || 0,
                        purchasePrice: stockInfo.purchasePrice?.toFixed(2) || '0.00'
                    },
                    stockEntries: item.stockEntries || [],
                    printPreferences: responseData.printPreferences || {
                        labelWidth: 70,
                        labelHeight: 40,
                        labelsPerRow: 3,
                        barcodeType: 'code128',
                        defaultQuantity: 1
                    }
                };

                setItem(processedItem);
                setPrintSettings(prev => ({ ...prev, ...processedItem.printPreferences }));
            } catch (err) {
                setError(err.message || 'Failed to fetch item details');
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchItemData();
    }, [id]);

    const toggleItemStatus = async () => {
        try {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const response = await api.post(`/api/retailer/items/${item._id}/status`, { status: newStatus });

            if (response.data.success) {
                setItem(prev => ({ ...prev, status: newStatus }));
                setToast({ show: true, message: `Status updated to ${newStatus}`, type: 'success' });
            } else {
                throw new Error(response.data.error || 'Failed to update status');
            }
        } catch (err) {
            setToast({
                show: true,
                message: err.response?.data?.error || err.message || 'Failed to update status',
                type: 'error'
            });
        }
    };

    const handlePrintBarcode = (entry) => {
        setCurrentPrintEntry(entry);
        setShowPrintModal(true);
    };

    const confirmPrint = () => {
        const { labelWidth, labelHeight, labelsPerRow, barcodeType, quantity } = printSettings;
        const printWindow = window.open('', '_blank');

        printWindow.document.write(`
            <html>
            <head>
                <title>Barcode Labels</title>
                <style>
                    @page { size: A4; margin: 0; }
                    .label-grid { display: grid; grid-template-columns: repeat(${labelsPerRow}, 1fr); gap: 0.1in; padding: 0.25in; }
                    .barcode-container { display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; height: ${labelHeight * 0.0393701}in; padding: 0.1in; }
                    .barcode-image { width: 100%; height: 70%; object-fit: contain; }
                </style>
            </head>
            <body>
                <div class="label-grid">
                    ${Array.from({ length: quantity }, (_, i) => `
                        <div class="barcode-container">
                            <img src="/api/item/${item._id}/barcode/${currentPrintEntry._id}/${labelWidth}/${labelHeight}/${barcodeType}" class="barcode-image">
                            <div style="font-size:10px">${item.name}</div>
                            <div style="font-size:9px">Batch: ${currentPrintEntry.batchNumber}</div>
                            <div style="font-size:9px">MRP: ${currentPrintEntry.mrp?.toFixed(2)}</div>
                            <div style="font-size:9px">Exp: ${new Date(currentPrintEntry.expiryDate).toLocaleDateString()}</div>
                        </div>
                    `).join('')}
                </div>
                <script>
                    setTimeout(() => { window.print(); setTimeout(() => window.close(), 500); }, 500);
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();

        if (printSettings.saveSettings) {
            api.post('/api/retailer/user/print-preferences', printSettings);
        }

        setShowPrintModal(false);
    };

    if (loading) return (
        <Container className="mt-3">
            <div className="text-center small">Loading...</div>
        </Container>
    );

    if (error) return (
        <Container className="mt-3">
            <Alert variant="danger" className="small p-2">{error}</Alert>
            <Button variant="primary" size="sm" onClick={() => navigate(-1)}>
                <FaArrowLeft size={12} /> Back
            </Button>
        </Container>
    );

    if (!item) return (
        <Container className="mt-3">
            <Alert variant="warning" className="small p-2">Item not found</Alert>
            <Button variant="primary" size="sm" onClick={() => navigate(-1)}>
                <FaArrowLeft size={12} /> Back
            </Button>
        </Container>
    );

    return (
        <Container className="mt-3">
            <NotificationToast
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast({ ...toast, show: false })}
            />

            <Card className="shadow-sm">
                <Card.Header className="text-center py-2 bg-light">
                    <h5 className="mb-0" style={{ fontSize: '1rem', textDecoration: 'underline' }}>Item Details</h5>
                </Card.Header>

                <Card.Body className="p-3">
                    <Row className="g-2">
                        {/* Left Column */}
                        <Col md={4}>
                            <h6 className="mb-2" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Details:</h6>
                            <ListGroup variant="flush" className="small">
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Name:</strong> {item.name}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>HSN:</strong> {item.hscode}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>VAT:</strong> {item.vatStatus}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Main Unit:</strong> {item.mainUnit?.name || 'N/A'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>WS Unit:</strong> {item.WSUnit || 'N/A'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Unit:</strong> {item.unit?.name || 'N/A'}</ListGroup.Item>
                            </ListGroup>
                        </Col>

                        {/* Middle Column */}
                        <Col md={4}>
                            <h6 className="mb-2" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Pricing & Stock:</h6>
                            <ListGroup variant="flush" className="small">
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Sales Price:</strong> {item.currentOpeningStock?.salesPrice?.toFixed(2) || '0.00'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Purchase Price:</strong> {item.currentOpeningStock?.purchasePrice || '0.00'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Opening Stock:</strong> {item.currentOpeningStock?.openingStock || 0}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Stock Value:</strong> {item.currentOpeningStock?.openingStockValue || '0.00'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Re-order Level:</strong> {item.reorderLevel || 'N/A'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Category:</strong> {item.category?.name || 'N/A'}</ListGroup.Item>
                            </ListGroup>
                        </Col>

                        {/* Right Column */}
                        <Col md={4}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <Button
                                    variant={item.status === 'active' ? 'danger' : 'success'}
                                    size="sm"
                                    onClick={toggleItemStatus}
                                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                                >
                                    {item.status === 'active' ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Badge bg={item.status === 'active' ? 'success' : 'danger'} style={{ fontSize: '0.7rem' }}>
                                    {item.status?.toUpperCase()}
                                </Badge>
                            </div>

                            <ListGroup variant="flush" className="small">
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Barcode:</strong> {item.barcodeNumber || 'N/A'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Unique ID:</strong> {item.uniqueNumber || 'N/A'}</ListGroup.Item>
                                <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.8rem' }}><strong>Created:</strong> {new Date(item.createdAt).toLocaleDateString()}</ListGroup.Item>
                            </ListGroup>
                        </Col>
                    </Row>

                    {/* Composition Section */}
                    <hr className="my-2" />
                    <Row>
                        <Col>
                            <h6 className="mb-1" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Composition:</h6>
                            <ListGroup variant="flush" className="small">
                                {item.composition?.length > 0 ? (
                                    item.composition.map(comp => (
                                        <ListGroup.Item key={comp._id} className="py-1 px-2" style={{ fontSize: '0.75rem' }}>
                                            {comp.uniqueNumber} - {comp.name}
                                        </ListGroup.Item>
                                    ))
                                ) : (
                                    <ListGroup.Item className="py-1 px-2" style={{ fontSize: '0.75rem' }}>No Composition</ListGroup.Item>
                                )}
                            </ListGroup>
                        </Col>
                    </Row>

                    {/* Stock Entries Section */}
                    {item.stockEntries?.length > 0 && (
                        <>
                            <hr className="my-2" />
                            <Row>
                                <Col>
                                    <h6 className="mb-1" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Stock Batches:</h6>
                                    <div className="table-responsive">
                                        <table className="table table-sm table-bordered small" style={{ fontSize: '0.7rem' }}>
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Batch</th>
                                                    <th>Quantity</th>
                                                    <th>MRP</th>
                                                    <th>Expiry</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {item.stockEntries.map(entry => (
                                                    <tr key={entry._id}>
                                                        <td>{entry.batchNumber || 'N/A'}</td>
                                                        <td>{entry.quantity || 0}</td>
                                                        <td>{entry.mrp?.toFixed(2) || '0.00'}</td>
                                                        <td>{entry.expiryDate ? new Date(entry.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                                        <td>
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                onClick={() => handlePrintBarcode(entry)}
                                                                style={{ padding: '0px 4px', fontSize: '0.65rem' }}
                                                            >
                                                                <FaBarcode size={10} /> Print
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Col>
                            </Row>
                        </>
                    )}

                    <hr className="my-2" />
                    <div className="d-flex justify-content-between align-items-center">
                        <Button variant="primary" size="sm" onClick={() => navigate(-1)} style={{ fontSize: '0.75rem' }}>
                            <FaArrowLeft size={10} className="me-1" />Back
                        </Button>
                    </div>
                </Card.Body>
            </Card>

            {/* Print Modal */}
            <Modal show={showPrintModal} onHide={() => setShowPrintModal(false)} size="sm" centered>
                <Modal.Header closeButton className="py-2">
                    <Modal.Title style={{ fontSize: '1rem' }}>Print Barcode Labels</Modal.Title>
                </Modal.Header>
                <Modal.Body className="py-2">
                    <Form>
                        <Form.Group className="mb-2">
                            <Form.Label style={{ fontSize: '0.8rem' }}>Quantity:</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                max="100"
                                value={printSettings.quantity}
                                onChange={(e) => setPrintSettings({ ...printSettings, quantity: parseInt(e.target.value) })}
                                size="sm"
                                style={{ fontSize: '0.8rem' }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Check
                                type="checkbox"
                                label="Save as default"
                                checked={printSettings.saveSettings}
                                onChange={(e) => setPrintSettings({ ...printSettings, saveSettings: e.target.checked })}
                                style={{ fontSize: '0.75rem' }}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="py-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowPrintModal(false)} style={{ fontSize: '0.75rem' }}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={confirmPrint} style={{ fontSize: '0.75rem' }}>Print</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default ViewItems;