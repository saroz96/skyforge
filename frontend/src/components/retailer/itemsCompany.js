// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import { useNavigate } from 'react-router-dom';
// import { FiEdit2, FiTrash2, FiPrinter, FiArrowLeft, FiX, FiCheck, FiPlus } from 'react-icons/fi';
// import Button from 'react-bootstrap/Button';
// import Form from 'react-bootstrap/Form';
// import Table from 'react-bootstrap/Table';
// import Spinner from 'react-bootstrap/Spinner';
// import Header from './Header';
// import NotificationToast from '../NotificationToast';
// import ProductModal from './dashboard/modals/ProductModal';
// import Modal from 'react-bootstrap/Modal'; // Import Modal

// const ItemsCompany = () => {
//     const navigate = useNavigate();
//     const [data, setData] = useState({
//         companies: [],
//         company: null,
//         currentFiscalYear: null,
//         companyId: '',
//         currentCompanyName: '',
//         user: null,
//         theme: 'light',
//         isAdminOrSupervisor: false
//     });
//     const [loading, setLoading] = useState(true);
//     const [searchTerm, setSearchTerm] = useState('');
//     const [currentCompany, setCurrentCompany] = useState(null);
//     const [formData, setFormData] = useState({
//         name: '',
//     });
//     const [isSaving, setIsSaving] = useState(false);
//     const [showNotification, setShowNotification] = useState(false);
//     const [notificationMessage, setNotificationMessage] = useState('');
//     const [notificationType, setNotificationType] = useState('');
//     const [showProductModal, setShowProductModal] = useState(false);
//     const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false); // Add state for save confirm modal

//     const api = axios.create({
//         baseURL: process.env.REACT_APP_API_BASE_URL,
//         withCredentials: true,
//     });

//     const showNotificationMessage = (message, type) => {
//         setNotificationMessage(message);
//         setNotificationType(type);
//         setShowNotification(true);
//     };

//     useEffect(() => {
//         fetchCompanies();
//     }, []);

//     const fetchCompanies = async () => {
//         try {
//             setLoading(true);
//             const response = await api.get('/api/retailer/items-company');

//             if (response.data.redirectTo) {
//                 navigate(response.data.redirectTo);
//                 return;
//             }

//             if (response.data.success) {
//                 setData({
//                     companies: response.data.data.itemsCompanies,
//                     company: response.data.data.company,
//                     currentFiscalYear: response.data.data.currentFiscalYear,
//                     companyId: response.data.data.companyId,
//                     currentCompanyName: response.data.data.currentCompanyName,
//                     user: response.data.data.user,
//                     theme: response.data.data.theme,
//                     isAdminOrSupervisor: response.data.data.isAdminOrSupervisor
//                 });
//             } else {
//                 throw new Error(response.data.error || 'Failed to fetch companies');
//             }
//         } catch (err) {
//             handleApiError(err);
//         } finally {
//             setLoading(false);
//         }
//     };

//     useEffect(() => {
//         // Add F9 key handler here
//         const handF9leKeyDown = (e) => {
//             if (e.key === 'F9') {
//                 e.preventDefault();
//                 setShowProductModal(prev => !prev); // Toggle modal visibility
//             }
//         };
//         window.addEventListener('keydown', handF9leKeyDown);
//         return () => {
//             window.removeEventListener('keydown', handF9leKeyDown);
//         };
//     }, []);

//     const handleApiError = (error) => {
//         let errorMessage = 'An error occurred';

//         if (error.response) {
//             switch (error.response.status) {
//                 case 400:
//                     errorMessage = error.response.data.error || 'Invalid request';
//                     break;
//                 case 401:
//                     navigate('/login');
//                     return;
//                 case 403:
//                     navigate('/dashboard');
//                     return;
//                 case 409:
//                     errorMessage = error.response.data.error || 'Company already exists';
//                     break;
//                 default:
//                     errorMessage = error.response.data.message || 'Request failed';
//             }
//         } else if (error.request) {
//             errorMessage = 'No response from server. Please check your connection.';
//         } else {
//             errorMessage = error.message || 'An error occurred';
//         }

//         showNotificationMessage(errorMessage, 'error');
//     };

//     const handleSearch = (e) => {
//         setSearchTerm(e.target.value.toLowerCase());
//     };

//     const filteredCompanies = data.companies.filter(company =>
//         company.name.toLowerCase().includes(searchTerm)
//     ).sort((a, b) => a.name.localeCompare(b.name));

//     const handleAdd = () => {
//         setCurrentCompany(null);
//         setFormData({
//             name: '',
//         });
//     };

//     const handleEdit = (company) => {
//         setCurrentCompany(company);
//         setFormData({
//             name: company.name,
//         });
//     };

//     const handleCancel = () => {
//         setCurrentCompany(null);
//         setFormData({
//             name: '',
//         });
//     };

//     const handleDelete = async (id) => {
//         if (window.confirm('Are you sure you want to delete this company?')) {
//             try {
//                 const response = await api.delete(`/api/retailer/items-company/${id}`);

//                 if (response.data.success) {
//                     showNotificationMessage('Company deleted successfully', 'success');
//                     fetchCompanies();
//                 } else {
//                     showNotificationMessage(response.data.error || 'Failed to delete company', 'error');
//                 }
//             } catch (err) {
//                 if (err.response && err.response.status === 409) {
//                     showNotificationMessage(err.response.data.error || 'Company cannot be deleted as it has related items', 'error');
//                 } else {
//                     handleApiError(err);
//                 }
//             }
//         }
//     };

//     const handleFormChange = (e) => {
//         const { name, value } = e.target;
//         setFormData(prev => ({
//             ...prev,
//             [name]: value
//         }));
//         // If the field being changed is the name field, also update the search term
//         if (name === 'name') {
//             setSearchTerm(value.toLowerCase());
//         }
//     };

//     const handleSubmit = async (e) => {
//         if (e) { // Only prevent default if event object exists (i.e., not called from modal)
//             e.preventDefault();
//         }
//         setIsSaving(true);
//         try {
//             if (currentCompany) {
//                 await api.put(`/api/retailer/items-company/${currentCompany._id}`, formData);
//                 showNotificationMessage('Company updated successfully!', 'success');
//             } else {
//                 await api.post('/api/retailer/items-company', formData);
//                 showNotificationMessage('Company created successfully!', 'success');
//             }
//             fetchCompanies();
//             handleCancel();
//         } catch (err) {
//             handleApiError(err);
//         } finally {
//             setIsSaving(false);
//         }
//     };

//     const printCompanies = () => {
//         const printWindow = window.open('', '_blank');
//         printWindow.document.write(`
//             <html>
//                 <head>
//                     <title>Companies Report</title>
//                     <style>
//                         table { width: 100%; border-collapse: collapse; }
//                         th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//                         th { background-color: #f2f2f2; }
//                     </style>
//                 </head>
//                 <body>
//                     <h2>Companies Report - ${data.currentCompanyName}</h2>
//                     <h3>Fiscal Year: ${data.currentFiscalYear?.name || 'N/A'}</h3>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>S.N.</th>
//                                 <th>Name</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             ${data.companies.map((company, index) => `
//                                 <tr>
//                                     <td>${index + 1}</td>
//                                     <td>${company.name}</td>
//                                 </tr>
//                             `).join('')}
//                         </tbody>
//                     </table>
//                     <p style="margin-top: 20px;">
//                         Printed on: ${new Date().toLocaleDateString()}
//                     </p>
//                 </body>
//             </html>
//         `);
//         printWindow.document.close();
//         printWindow.print();
//     };

//     // Handle keyboard shortcuts
//     useEffect(() => {
//         const handleKeyDown = (e) => {
//             if (e.altKey && e.key.toLowerCase() === 's') {
//                 e.preventDefault();
//                 setShowSaveConfirmModal(true); // Show confirmation modal on Alt+S
//             } else if (e.key === 'F6') {
//                 e.preventDefault();
//             } else if (e.key === 'Enter') {
//                 e.preventDefault();
//                 const form = e.target.form;
//                 if (form) {
//                     const index = Array.prototype.indexOf.call(form, e.target);
//                     if (index < form.length - 1) {
//                         form.elements[index + 1].focus();
//                     }
//                 }
//             }
//         };

//         document.addEventListener('keydown', handleKeyDown);
//         return () => document.removeEventListener('keydown', handleKeyDown);
//     }, []);

//     return (
//         <div className="container-fluid">
//             {/* Notification Toast */}
//             <NotificationToast
//                 message={notificationMessage}
//                 type={notificationType}
//                 show={showNotification}
//                 onClose={() => setShowNotification(false)}
//             />
//             <Header />
//             <div className="row g-3">
//                 {/* Left Column - Add/Edit Company Form */}
//                 <div className="col-lg-6">
//                     <div className="card h-100 shadow-lg">
//                         <h1 className="text-center" style={{ textDecoration: 'underline' }}>
//                             {currentCompany ? `Edit Company: ${currentCompany.name}` : 'Add New Company'}
//                         </h1>
//                         <div className="card-body">
//                             <Form onSubmit={handleSubmit} id="addCompanyForm"> {/* Added id for form */}
//                                 <Form.Group className="mb-3">
//                                     <Form.Label>Company Name <span className="text-danger">*</span></Form.Label>
//                                     <Form.Control
//                                         type="text"
//                                         name="name"
//                                         value={formData.name}
//                                         onChange={handleFormChange}
//                                         placeholder="Enter company name"
//                                         required
//                                         autoFocus
//                                         autoComplete='off'
//                                     />
//                                 </Form.Group>
//                                 <div className="d-flex justify-content-between">
//                                     {currentCompany ? (
//                                         <Button
//                                             variant="secondary"
//                                             onClick={handleCancel}
//                                             disabled={isSaving}
//                                         >
//                                             <FiX className="me-1" /> Cancel
//                                         </Button>
//                                     ) : (
//                                         <div></div>
//                                     )}
//                                     <Button variant="primary" type="submit" disabled={isSaving}
//                                         onKeyDown={(e) => {
//                                             if (e.key === 'Enter') {
//                                                 e.preventDefault();
//                                                 handleSubmit(e);
//                                             }
//                                         }}
//                                     >
//                                         {isSaving ? (
//                                             <>
//                                                 <Spinner
//                                                     as="span"
//                                                     animation="border"
//                                                     size="sm"
//                                                     role="status"
//                                                     aria-hidden="true"
//                                                     className="me-2"
//                                                 />
//                                                 Saving...
//                                             </>
//                                         ) : currentCompany ? (
//                                             'Save Changes'
//                                         ) : (
//                                             'Add Company'
//                                         )}
//                                     </Button>
//                                 </div>
//                                 <small className="ms-2">To Save Press Alt+S</small> {/* Added shortcut hint */}
//                             </Form>
//                         </div>
//                     </div>
//                 </div>

//                 {/* Right Column - Existing Companies */}
//                 <div className="col-lg-6">
//                     <div className="card h-100 shadow-lg" style={{ height: '600px' }}>
//                         <div className="card-body">
//                             <h1 className="text-center" style={{ textDecoration: 'underline' }}>Existing Companies</h1>

//                             {/* Header with buttons */}
//                             <div className="row mb-3">
//                                 <div className="col-2">
//                                     <Button variant="primary" onClick={() => navigate(-1)}>
//                                         <FiArrowLeft /> Back
//                                     </Button>
//                                 </div>
//                                 <div className="col-1">
//                                     <Button variant="primary" onClick={printCompanies}>
//                                         <FiPrinter />
//                                     </Button>
//                                 </div>
//                                 <div className="col">
//                                     <Form.Control
//                                         type="text"
//                                         placeholder="Search companies by name..."
//                                         value={searchTerm}
//                                         onChange={handleSearch}
//                                     />
//                                 </div>
//                             </div>

//                             {/* Companies Table */}
//                             <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
//                                 {loading ? (
//                                     <div className="text-center">
//                                         <Spinner animation="border" role="status">
//                                             <span className="visually-hidden">Loading...</span>
//                                         </Spinner>
//                                         <p>Loading companies...</p>
//                                     </div>
//                                 ) : filteredCompanies.length === 0 ? (
//                                     <div className="text-center">No companies found</div>
//                                 ) : (
//                                     <Table striped bordered hover>
//                                         <thead>
//                                             <tr>
//                                                 <th>Company Name</th>
//                                                 <th>Actions</th>
//                                             </tr>
//                                         </thead>
//                                         <tbody>
//                                             {filteredCompanies.map((company, index) => (
//                                                 <tr key={company._id}>
//                                                     <td>
//                                                         <strong>
//                                                             {index + 1}. {company.name}
//                                                         </strong>
//                                                     </td>
//                                                     <td>
//                                                         {data.isAdminOrSupervisor && (
//                                                             <>
//                                                                 <Button
//                                                                     variant="warning"
//                                                                     size="sm"
//                                                                     className="me-1"
//                                                                     onClick={() => handleEdit(company)}
//                                                                     disabled={!!currentCompany}
//                                                                 >
//                                                                     <FiEdit2 />
//                                                                 </Button>
//                                                                 {company.name !== 'General' && (
//                                                                     <Button
//                                                                         variant="danger"
//                                                                         size="sm"
//                                                                         className="me-1"
//                                                                         onClick={() => handleDelete(company._id)}
//                                                                         disabled={!!currentCompany}
//                                                                     >
//                                                                         <FiTrash2 />
//                                                                     </Button>
//                                                                 )}
//                                                             </>
//                                                         )}
//                                                     </td>
//                                                 </tr>
//                                             ))}
//                                         </tbody>
//                                     </Table>
//                                 )}
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//             {/* Save Confirmation Modal */}
//             <Modal show={showSaveConfirmModal} onHide={() => setShowSaveConfirmModal(false)} centered>
//                 <Modal.Header closeButton className="bg-warning text-dark">
//                     <Modal.Title>Confirm Save</Modal.Title>
//                 </Modal.Header>
//                 <Modal.Body>
//                     <p>Are you sure you want to save this company?</p>
//                 </Modal.Body>
//                 <Modal.Footer>
//                     <Button variant="secondary" onClick={() => setShowSaveConfirmModal(false)}>
//                         Cancel
//                     </Button>
//                     <Button variant="primary" onClick={() => {
//                         handleSubmit(); // Call handleSubmit directly
//                         setShowSaveConfirmModal(false);
//                     }}>
//                         Save
//                     </Button>
//                 </Modal.Footer>
//             </Modal>

//             {/* Product modal */}
//             {showProductModal && (
//                 <ProductModal onClose={() => setShowProductModal(false)} />
//             )}
//         </div>
//     );
// };

// export default ItemsCompany;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPrinter, FiArrowLeft, FiX, FiCheck, FiRefreshCw } from 'react-icons/fi';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Modal from 'react-bootstrap/Modal';
import Header from './Header';
import NotificationToast from '../NotificationToast';
import ProductModal from './dashboard/modals/ProductModal';
import * as XLSX from 'xlsx';

const ItemsCompany = () => {
    const [exporting, setExporting] = useState(false);
    const navigate = useNavigate();
    const [data, setData] = useState({
        companies: [],
        company: null,
        currentFiscalYear: null,
        companyId: '',
        currentCompanyName: '',
        user: null,
        theme: 'light',
        isAdminOrSupervisor: false
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentCompany, setCurrentCompany] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationType, setNotificationType] = useState('');
    const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [printOption, setPrintOption] = useState('all');

    // Column resizing state
    const [columnWidths, setColumnWidths] = useState({
        name: 200,
        actions: 140
    });

    const [isResizing, setIsResizing] = useState(false);
    const [resizingColumn, setResizingColumn] = useState(null);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    const showNotificationMessage = (message, type) => {
        setNotificationMessage(message);
        setNotificationType(type);
        setShowNotification(true);
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    // Save/load column widths
    useEffect(() => {
        const savedWidths = localStorage.getItem('companiesTableColumnWidths');
        if (savedWidths) {
            try {
                setColumnWidths(JSON.parse(savedWidths));
            } catch (e) {
                console.error('Failed to load column widths:', e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('companiesTableColumnWidths', JSON.stringify(columnWidths));
    }, [columnWidths]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                setShowSaveConfirmModal(true);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const form = e.target.form;
                if (form) {
                    const index = Array.prototype.indexOf.call(form, e.target);
                    if (index < form.length - 1) {
                        form.elements[index + 1].focus();
                    }
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                setShowProductModal(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Shallow equal function for memoization
    function shallowEqual(objA, objB) {
        if (objA === objB) return true;

        if (typeof objA !== 'object' || objA === null ||
            typeof objB !== 'object' || objB === null) {
            return false;
        }

        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);

        if (keysA.length !== keysB.length) return false;

        for (let i = 0; i < keysA.length; i++) {
            if (!objB.hasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
                return false;
            }
        }

        return true;
    }

    // Filtered companies with memoization
    const filteredCompanies = useMemo(() => {
        return data.companies
            .filter(company =>
                company.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [data.companies, searchTerm]);

    // Resizable Table Header Component
    const TableHeader = React.memo(() => {
        const totalWidth = 50 + columnWidths.name + columnWidths.actions;

        const handleResizeStart = (e, columnName) => {
            setIsResizing(true);
            setResizingColumn(columnName);
            setStartX(e.clientX);
            setStartWidth(columnWidths[columnName]);
            e.preventDefault();
        };

        return (
            <div
                className="d-flex bg-primary text-white sticky-top align-items-center position-relative"
                style={{
                    zIndex: 2,
                    height: '26px',
                    minWidth: `${totalWidth}px`,
                    userSelect: isResizing ? 'none' : 'auto'
                }}
                onMouseMove={(e) => {
                    if (isResizing && resizingColumn) {
                        const diff = e.clientX - startX;
                        const newWidth = Math.max(100, startWidth + diff);
                        setColumnWidths(prev => ({
                            ...prev,
                            [resizingColumn]: newWidth
                        }));
                    }
                }}
                onMouseUp={() => {
                    if (isResizing) {
                        setIsResizing(false);
                        setResizingColumn(null);
                    }
                }}
                onMouseLeave={() => {
                    if (isResizing) {
                        setIsResizing(false);
                        setResizingColumn(null);
                    }
                }}
            >
                {/* S.N. */}
                <div
                    className="d-flex align-items-center justify-content-center px-2 border-end border-white"
                    style={{
                        width: '50px',
                        flexShrink: 0
                    }}
                >
                    <strong style={{ fontSize: '0.8rem' }}>S.N.</strong>
                </div>

                {/* Company Name */}
                <div
                    className="d-flex align-items-center ps-2 border-end border-white position-relative"
                    style={{
                        width: `${columnWidths.name}px`,
                        flexShrink: 0,
                        minWidth: '100px'
                    }}
                >
                    <strong style={{ fontSize: '0.8rem' }}>Company Name</strong>
                    <ResizeHandle
                        onResizeStart={handleResizeStart}
                        left={columnWidths.name - 2}
                        columnName="name"
                    />
                </div>

                {/* Actions */}
                <div
                    className="d-flex align-items-center justify-content-end px-2"
                    style={{
                        width: `${columnWidths.actions}px`,
                        flexShrink: 0,
                        minWidth: '120px'
                    }}
                >
                    <strong style={{ fontSize: '0.8rem' }}>Actions</strong>
                </div>

                {/* Resizing indicator overlay */}
                {isResizing && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 1000,
                            cursor: 'col-resize'
                        }}
                    />
                )}
            </div>
        );
    });

    // Table Row Component
    const TableRow = React.memo(({ index, style, data }) => {
        const { companies, isAdminOrSupervisor } = data;
        const company = companies[index];

        const handleEditClick = useCallback(() => company && handleEdit(company), [company]);
        const handleDeleteClick = useCallback(() => company?._id && handleDelete(company._id), [company?._id]);
        const handleSelect = useCallback(() => company && handleSelectCompany(company), [company]);

        if (!company) return null;

        const companyName = company.name || 'N/A';
        const isGeneral = company.name === 'General';
        const isActive = company.status === 'active';

        return (
            <div
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    height: '26px',
                    minHeight: '26px',
                    padding: '0',
                    borderBottom: '1px solid #dee2e6',
                    cursor: 'pointer',
                }}
                className={index % 1 === 0 ? 'bg-light' : 'bg-white'}
            >
                {/* S.N. */}
                <div
                    className="d-flex align-items-center justify-content-center px-0 border-end"
                    style={{
                        width: '50px',
                        flexShrink: 0,
                        height: '100%'
                    }}
                >
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {index + 1}
                    </span>
                </div>

                {/* Company Name */}
                <div
                    className="d-flex align-items-center ps-2 border-end"
                    style={{
                        width: `${columnWidths.name}px`,
                        flexShrink: 0,
                        height: '100%',
                        overflow: 'hidden'
                    }}
                    title={`${companyName}`}
                >
                    <div className="d-flex flex-column justify-content-center" style={{ height: '100%', minWidth: 0 }}>
                        <div className="d-flex align-items-center">
                            <span
                                style={{
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: 'block',
                                    maxWidth: '100%'
                                }}
                            >
                                {companyName}
                            </span>
                            {isGeneral && (
                                <Badge bg="info" className="ms-2" style={{
                                    fontSize: '0.6rem',
                                    padding: '1px 4px'
                                }}>
                                    Default
                                </Badge>
                            )}
                            {isActive && (
                                <Badge bg="success" className="ms-2" style={{
                                    fontSize: '0.6rem',
                                    padding: '1px 4px'
                                }}>
                                    Active
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div
                    className="px-2 d-flex align-items-center justify-content-end gap-1"
                    style={{
                        width: `${columnWidths.actions}px`,
                        flexShrink: 0,
                        height: '100%'
                    }}
                >
                    {isAdminOrSupervisor && !isGeneral && (
                        <>
                            <Button
                                variant="outline-warning"
                                size="sm"
                                className="p-0 d-flex align-items-center justify-content-center"
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    minWidth: '24px'
                                }}
                                onClick={handleEditClick}
                                title={`Edit ${companyName}`}
                                disabled={!!currentCompany}
                            >
                                <FiEdit2 size={12} />
                            </Button>
                            <Button
                                variant="outline-danger"
                                size="sm"
                                className="p-0 d-flex align-items-center justify-content-center"
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    minWidth: '24px'
                                }}
                                onClick={handleDeleteClick}
                                title={`Delete ${companyName}`}
                                disabled={!!currentCompany}
                            >
                                <FiTrash2 size={12} />
                            </Button>
                        </>
                    )}

                    <Button
                        variant="outline-success"
                        size="sm"
                        className="p-0 d-flex align-items-center justify-content-center"
                        style={{
                            width: '24px',
                            height: '24px',
                            minWidth: '24px'
                        }}
                        onClick={handleSelect}
                        title={`Select ${companyName}`}
                    >
                        <FiCheck size={12} />
                    </Button>
                </div>
            </div>
        );
    }, (prevProps, nextProps) => {
        if (prevProps.index !== nextProps.index) return false;
        if (prevProps.style !== nextProps.style) return false;

        const prevCompany = prevProps.data.companies[prevProps.index];
        const nextCompany = nextProps.data.companies[nextProps.index];

        return (
            shallowEqual(prevCompany, nextCompany) &&
            prevProps.data.isAdminOrSupervisor === nextProps.data.isAdminOrSupervisor
        );
    });

    // Resize Handle Component
    const ResizeHandle = React.memo(({ onResizeStart, left, columnName }) => {
        return (
            <div
                className="resize-handle"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: `${left}px`,
                    width: '5px',
                    height: '100%',
                    cursor: 'col-resize',
                    backgroundColor: 'transparent',
                    zIndex: 10,
                    userSelect: 'none'
                }}
                onMouseDown={(e) => {
                    e.preventDefault();
                    onResizeStart(e, columnName);
                }}
            />
        );
    });

    // Reset column widths
    const resetColumnWidths = () => {
        setColumnWidths({
            name: 200,
            actions: 140
        });
        showNotificationMessage('Column widths reset to default', 'success');
    };

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/retailer/items-company');

            if (response.data.redirectTo) {
                navigate(response.data.redirectTo);
                return;
            }

            if (response.data.success) {
                setData({
                    companies: response.data.data.itemsCompanies,
                    company: response.data.data.company,
                    currentFiscalYear: response.data.data.currentFiscalYear,
                    companyId: response.data.data.companyId,
                    currentCompanyName: response.data.data.currentCompanyName,
                    user: response.data.data.user,
                    theme: response.data.data.theme,
                    isAdminOrSupervisor: response.data.data.isAdminOrSupervisor
                });
            } else {
                throw new Error(response.data.error || 'Failed to fetch companies');
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApiError = (error) => {
        let errorMessage = 'An error occurred';

        if (error.response) {
            switch (error.response.status) {
                case 400:
                    if (error.response.data.error === 'No fiscal year found in session or company.') {
                        navigate('/select-fiscal-year');
                        return;
                    }
                    errorMessage = error.response.data.error || 'Invalid request';
                    break;
                case 401:
                    navigate('/login');
                    return;
                case 403:
                    navigate('/dashboard');
                    return;
                case 409:
                    errorMessage = error.response.data.error || 'Company already exists';
                    break;
                default:
                    errorMessage = error.response.data.message || 'Request failed';
            }
        } else if (error.request) {
            errorMessage = 'No response from server. Please check your connection.';
        } else {
            errorMessage = error.message || 'An error occurred';
        }

        showNotificationMessage(errorMessage, 'error');
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value.toLowerCase());
    };

    const handleEdit = (company) => {
        setCurrentCompany(company);
        setFormData({
            name: company.name,
        });
    };

    const handleSelectCompany = (company) => {
        setFormData({
            name: company.name,
        });
    };

    const handleCancel = () => {
        setCurrentCompany(null);
        setFormData({
            name: '',
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this company?')) {
            try {
                const response = await api.delete(`/api/retailer/items-company/${id}`);

                if (response.data.success) {
                    showNotificationMessage('Company deleted successfully', 'success');
                    fetchCompanies();
                } else {
                    showNotificationMessage(response.data.error || 'Failed to delete company', 'error');
                }
            } catch (err) {
                if (err.response && err.response.status === 409) {
                    showNotificationMessage(err.response.data.error || 'Company cannot be deleted as it has related items', 'error');
                } else {
                    handleApiError(err);
                }
            }
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (name === 'name') {
            setSearchTerm(value.toLowerCase());
        }
    };

    const handleSubmit = async (e) => {
        if (e) {
            e.preventDefault();
        }
        setIsSaving(true);
        try {
            if (currentCompany) {
                await api.put(`/api/retailer/items-company/${currentCompany._id}`, formData);
                showNotificationMessage('Company updated successfully!', 'success');
                handleCancel();
            } else {
                await api.post('/api/retailer/items-company', formData);
                showNotificationMessage('Company created successfully!', 'success');
                setFormData({ name: '' });
            }
            fetchCompanies();
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsSaving(false);
        }
    };

    const printCompanies = () => {
        const companiesToPrint = printOption === 'all'
            ? data.companies
            : data.companies.filter(company => company.status === 'active');

        if (companiesToPrint.length === 0) {
            alert("No companies to print");
            return;
        }

        const printWindow = window.open("", "_blank");

        const printHeader = `
            <div class="print-header">
                <h1>${data.company?.companyName || data.currentCompanyName || 'Company Name'}</h1>
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
                .badge { 
                    padding: 3px 6px; 
                    border-radius: 3px; 
                    font-size: 10px; 
                    display: inline-block;
                }
                .badge-success { 
                    background-color: #28a745; 
                    color: white; 
                }
                .badge-danger { 
                    background-color: #dc3545; 
                    color: white; 
                }
                .badge-info { 
                    background-color: #17a2b8; 
                    color: white; 
                }
                .footer-note {
                    margin-top: 20px; 
                    font-size: 0.9em; 
                    color: #666;
                    text-align: center;
                }
                .header-info {
                    text-align: center;
                    margin-bottom: 10px;
                    font-size: 11px;
                }
                .report-title {
                    text-align: center;
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    text-decoration: underline;
                }
                .filter-info {
                    text-align: center;
                    font-size: 11px;
                    margin-bottom: 15px;
                    color: #666;
                }
            </style>
            ${printHeader}
            
            <div class="report-title">Items Companies Report</div>
            
            <div class="header-info">
                <strong>Fiscal Year:</strong> ${data.currentFiscalYear?.name || 'N/A'} | 
                <strong>Total Companies:</strong> ${companiesToPrint.length}
            </div>
            
            <div class="filter-info">
                ${printOption !== 'all' ?
                `<strong>Filter:</strong> ${printOption.charAt(0).toUpperCase() + printOption.slice(1)} | ` : ''
            }
                <strong>Printed on:</strong> ${new Date().toLocaleDateString()}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th class="nowrap">S.N.</th>
                        <th class="nowrap">Company Name</th>
                        <th class="nowrap">Status</th>
                        <th class="nowrap">Item Count</th>
                        <th class="nowrap">Type</th>
                    </tr>
                </thead>
                <tbody>
        `;

        companiesToPrint.forEach((company, index) => {
            const isGeneral = company.name === 'General';
            tableContent += `
                <tr>
                    <td class="nowrap">${index + 1}</td>
                    <td class="nowrap">${company.name || 'N/A'}</td>
                    <td class="nowrap">
                        <span class="nowrap badge ${company.status === 'active' ? 'badge-success' : 'badge-danger'}">
                            ${company.status || 'N/A'}
                        </span>
                    </td>
                    <td class="nowrap">
                        <span class="nowrap">
                            ${company.itemCount || 0}
                        </span>
                    </td>
                    <td class="nowrap">
                        <span class="nowrap badge ${isGeneral ? 'badge-info' : ''}">
                            ${isGeneral ? 'Default' : 'Regular'}
                        </span>
                    </td>
                </tr>
            `;
        });

        tableContent += `
                </tbody>
            </table>
            
            <div class="footer-note">
                <br>
                ${data.company?.companyName ? `© ${new Date().getFullYear()} ${data.company.companyName}` : ''}
            </div>
        `;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Companies Report - ${data.company?.companyName || data.currentCompanyName || 'Companies Report'}</title>
                </head>
                <body>
                    ${tableContent}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.onafterprint = function() {
                                    window.close();
                                };
                            }, 200);
                        };
                    <\/script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const exportToExcel = async (exportAll = false) => {
        setExporting(true);
        try {
            const companiesToExport = exportAll ? data.companies : filteredCompanies;

            if (companiesToExport.length === 0) {
                showNotificationMessage('No companies to export', 'warning');
                return;
            }

            const excelData = companiesToExport.map((company, index) => {
                return {
                    'S.N.': index + 1,
                    'Company Name': company.name || 'N/A',
                    'Status': company.status || 'N/A',
                    'Type': company.name === 'General' ? 'Default' : 'Regular',
                    'Total Items': company.itemCount || 0,
                    'Created': company.createdAt ? new Date(company.createdAt).toLocaleDateString() : '',
                    'Last Updated': company.updatedAt ? new Date(company.updatedAt).toLocaleDateString() : ''
                };
            });

            const summaryData = [
                {},
                {
                    'S.N.': 'SUMMARY',
                    'Company Name': 'Total Companies:',
                    'Status': companiesToExport.length
                },
                {
                    'S.N.': '',
                    'Company Name': 'Active Companies:',
                    'Status': companiesToExport.filter(company => company.status === 'active').length
                },
                {
                    'S.N.': '',
                    'Company Name': 'Default Companies:',
                    'Status': companiesToExport.filter(company => company.name === 'General').length
                }
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            ws['!cols'] = [
                { wch: 6 },
                { wch: Math.min(companiesToExport.reduce((w, r) => Math.max(w, r['Company Name']?.length || 0), 10), 50) },
                { wch: 10 },
                { wch: 10 },
                { wch: 12 },
                { wch: 12 },
                { wch: 12 }
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Companies');

            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            const date = new Date().toISOString().split('T')[0];
            const filterInfo = exportAll ? 'All' : 'Filtered';
            const fileName = `Companies_Report_${filterInfo}_${date}.xlsx`;

            XLSX.writeFile(wb, fileName);

            showNotificationMessage(
                `${exportAll ? 'All' : 'Filtered'} companies (${companiesToExport.length}) exported successfully!`,
                'success'
            );

        } catch (err) {
            console.error('Error exporting to Excel:', err);
            showNotificationMessage('Failed to export to Excel', 'error');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="container-fluid">
            <Header />
            <NotificationToast
                message={notificationMessage}
                type={notificationType}
                show={showNotification}
                onClose={() => setShowNotification(false)}
            />
            <div className="card mt-2">
                <div className="row g-3">
                    {/* Left Column - Add Company Form */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg">
                            <div className="card-body">
                                <h3 className="text-center" style={{ textDecoration: 'underline' }}>
                                    {currentCompany ? `Edit Company: ${currentCompany.name}` : 'Create Company'}
                                </h3>
                                <Form onSubmit={handleSubmit} id="addCompanyForm" style={{ marginTop: '5px' }}>
                                    <Form.Group style={{ marginBottom: '12px' }}>
                                        <div className="position-relative">
                                            <Form.Control
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleFormChange}
                                                placeholder=" "
                                                required
                                                autoFocus
                                                autoComplete="off"
                                                style={{
                                                    height: '30px',
                                                    fontSize: '0.875rem',
                                                    paddingTop: '0.75rem'
                                                }}
                                            />
                                            <label
                                                className="position-absolute"
                                                style={{
                                                    top: '-8px',
                                                    left: '0.75rem',
                                                    fontSize: '0.75rem',
                                                    backgroundColor: 'white',
                                                    padding: '0 0.25rem',
                                                    color: '#6c757d',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Company Name <span className="text-danger">*</span>
                                            </label>
                                        </div>
                                    </Form.Group>

                                    <div className="d-flex justify-content-between align-items-center">
                                        {currentCompany ? (
                                            <Button
                                                variant="secondary"
                                                onClick={handleCancel}
                                                disabled={isSaving}
                                                className="d-flex align-items-center"
                                                style={{
                                                    height: '28px',
                                                    padding: '0 12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                <FiX className="me-1" size={14} />
                                                Cancel
                                            </Button>
                                        ) : (
                                            <div></div>
                                        )}
                                        <div className="d-flex align-items-center">
                                            <Button
                                                variant="primary"
                                                type="submit"
                                                disabled={isSaving}
                                                className="d-flex align-items-center"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSubmit(e);
                                                    }
                                                }}
                                                style={{
                                                    height: '28px',
                                                    padding: '0 16px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <Spinner
                                                            as="span"
                                                            animation="border"
                                                            size="sm"
                                                            role="status"
                                                            aria-hidden="true"
                                                            className="me-2"
                                                        />
                                                        Saving...
                                                    </>
                                                ) : currentCompany ? (
                                                    <>
                                                        <FiCheck className="me-1" size={14} />
                                                        Save Changes
                                                    </>
                                                ) : (
                                                    'Add Company'
                                                )}
                                            </Button>
                                            <small className="ms-2 text-muted" style={{ fontSize: '0.7rem' }}>
                                                Alt+S to Save
                                            </small>
                                        </div>
                                    </div>
                                </Form>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Existing Companies */}
                    <div className="col-lg-6">
                        <div className="card h-100 shadow-lg">
                            <div className="card-body">
                                <h3 className="text-center" style={{ textDecoration: 'underline' }}>Existing Companies</h3>

                                <div className="row g-1 mb-2 align-items-center">
                                    <div className="col-auto">
                                        <Button
                                            variant="primary"
                                            onClick={() => navigate(-1)}
                                            className="d-flex align-items-center p-1"
                                            title="Go back"
                                            style={{
                                                height: '24px',
                                                minWidth: '24px',
                                                fontSize: '0.7rem'
                                            }}
                                        >
                                            <FiArrowLeft size={10} />
                                            <span className="ms-1 d-none d-sm-inline" style={{ fontSize: '0.7rem' }}>Back</span>
                                        </Button>
                                    </div>
                                    <div className="col-auto">
                                        <Button
                                            variant="primary"
                                            onClick={() => setShowPrintModal(true)}
                                            className="d-flex align-items-center p-1"
                                            title="Print report"
                                            style={{
                                                height: '24px',
                                                minWidth: '24px',
                                                fontSize: '0.7rem'
                                            }}
                                        >
                                            <FiPrinter size={10} />
                                            <span className="ms-1 d-none d-sm-inline" style={{ fontSize: '0.7rem' }}>Print</span>
                                        </Button>
                                    </div>
                                    <div className="col-auto">
                                        <Button
                                            variant="success"
                                            onClick={() => exportToExcel(true)}
                                            disabled={exporting || data.companies.length === 0}
                                            title="Export all companies to Excel"
                                            className="d-flex align-items-center p-1"
                                            style={{
                                                height: '24px',
                                                minWidth: '24px',
                                                fontSize: '0.7rem'
                                            }}
                                        >
                                            {exporting ? (
                                                <Spinner animation="border" size="sm" className="me-1" style={{ width: '10px', height: '10px' }} />
                                            ) : (
                                                <i className="fas fa-file-excel" style={{ fontSize: '0.7rem' }}></i>
                                            )}
                                            <span className="ms-1 d-none d-sm-inline" style={{ fontSize: '0.7rem' }}>Export</span>
                                        </Button>
                                    </div>
                                    <div className="col">
                                        <div style={{ position: 'relative' }}>
                                            <Form.Control
                                                type="text"
                                                placeholder=" "
                                                value={searchTerm}
                                                onChange={handleSearch}
                                                className="w-100"
                                                style={{
                                                    height: '24px',
                                                    fontSize: '0.75rem',
                                                    paddingTop: '0.6rem',
                                                    paddingLeft: '0.5rem'
                                                }}
                                            />
                                            <label
                                                className="position-absolute"
                                                style={{
                                                    top: '-6px',
                                                    left: '0.5rem',
                                                    fontSize: '0.65rem',
                                                    backgroundColor: 'white',
                                                    padding: '0 0.25rem',
                                                    color: '#6c757d',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Search companies...
                                            </label>
                                        </div>
                                    </div>
                                    <div className="col-auto">
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={resetColumnWidths}
                                            title="Reset column widths to default"
                                            className="d-flex align-items-center p-1"
                                            style={{
                                                height: '24px',
                                                minWidth: '24px',
                                                fontSize: '0.7rem'
                                            }}
                                        >
                                            <FiRefreshCw size={10} />
                                            <span className="ms-1 d-none d-sm-inline" style={{ fontSize: '0.7rem' }}>Reset</span>
                                        </Button>
                                    </div>
                                </div>
                                <div style={{ height: 'calc(100vh - 300px)', width: '100%' }}>
                                    {loading ? (
                                        <div className="d-flex flex-column justify-content-center align-items-center h-100">
                                            <Spinner
                                                animation="border"
                                                variant="primary"
                                                size="sm"
                                                style={{ width: '1.5rem', height: '1.5rem' }}
                                            />
                                            <p className="mt-2 small text-muted" style={{ fontSize: '0.8rem' }}>
                                                Loading companies...
                                            </p>
                                        </div>
                                    ) : filteredCompanies.length === 0 ? (
                                        <div className="d-flex flex-column justify-content-center align-items-center h-100">
                                            <i className="bi bi-building text-muted" style={{ fontSize: '1.5rem' }}></i>
                                            <h6 className="mt-2 text-muted" style={{ fontSize: '0.9rem' }}>
                                                No companies found
                                            </h6>
                                            <p className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                {searchTerm ? 'Try a different search term' : 'Create your first company using the form'}
                                            </p>
                                        </div>
                                    ) : (
                                        <AutoSizer>
                                            {({ height, width }) => {
                                                const totalWidth = 50 + columnWidths.name + columnWidths.actions;

                                                return (
                                                    <div style={{
                                                        position: 'relative',
                                                        height: height,
                                                        width: Math.max(width, totalWidth),
                                                        overflowX: 'auto'
                                                    }}>
                                                        <TableHeader />
                                                        <List
                                                            height={height - 60}
                                                            itemCount={filteredCompanies.length}
                                                            itemSize={26}
                                                            width={Math.max(width, totalWidth)}
                                                            itemData={{
                                                                companies: filteredCompanies,
                                                                isAdminOrSupervisor: data.isAdminOrSupervisor
                                                            }}
                                                        >
                                                            {TableRow}
                                                        </List>
                                                        <div className="mt-2 text-muted small">
                                                            Showing {filteredCompanies.length} of {data.companies.length} companies
                                                            {searchTerm && ` (filtered)`}
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </AutoSizer>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Options Modal */}
            <Modal
                show={showPrintModal}
                onHide={() => setShowPrintModal(false)}
                centered
                size="md"
            >
                <Modal.Header closeButton className="bg-primary text-white py-2">
                    <Modal.Title className="d-flex align-items-center">
                        <FiPrinter className="me-2" size={20} />
                        <div className="d-flex flex-column">
                            <span className="fw-bold fs-6">Print Companies Report</span>
                            <small className="opacity-75">Select filter options</small>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <div className="mb-3">
                        <h6 className="fw-bold mb-2 text-primary">Filter Options</h6>
                        <div className="d-flex gap-2 mb-3">
                            <Button
                                variant={printOption === 'all' ? 'primary' : 'outline-primary'}
                                onClick={() => setPrintOption('all')}
                                size="sm"
                            >
                                All Companies
                            </Button>
                            <Button
                                variant={printOption === 'active' ? 'success' : 'outline-success'}
                                onClick={() => setPrintOption('active')}
                                size="sm"
                            >
                                Active Only
                            </Button>
                        </div>

                        <div className="border-top pt-3 mt-3">
                            <h6 className="fw-bold mb-2 text-primary">Report Summary</h6>
                            <div className="row text-center">
                                <div className="col-4">
                                    <div className="text-muted small">Total Companies</div>
                                    <div className="fw-bold h5">{data.companies.length}</div>
                                </div>
                                <div className="col-4">
                                    <div className="text-muted small">Active</div>
                                    <div className="fw-bold h5 text-success">
                                        {data.companies.filter(company => company.status === 'active').length}
                                    </div>
                                </div>
                                <div className="col-4">
                                    <div className="text-muted small">Default</div>
                                    <div className="fw-bold h5 text-info">
                                        {data.companies.filter(company => company.name === 'General').length}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {printOption !== 'all' && (
                            <div className="alert alert-info border small mt-3 py-2">
                                <i className="bi bi-info-circle me-2"></i>
                                <span>
                                    Filtering by: <strong>{
                                        printOption === 'active'
                                            ? 'Active companies only'
                                            : 'All companies'
                                    }</strong>
                                </span>
                            </div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer className="py-2 border-top">
                    <div className="d-flex justify-content-between w-100 align-items-center">
                        <Button
                            variant="outline-secondary"
                            onClick={() => setShowPrintModal(false)}
                            size="sm"
                            className="px-3"
                        >
                            Cancel
                        </Button>
                        <div className="d-flex gap-2">
                            <Button
                                variant="outline-primary"
                                onClick={() => {
                                    setPrintOption('all');
                                }}
                                size="sm"
                                disabled={printOption === 'all'}
                            >
                                Reset
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    printCompanies();
                                    setShowPrintModal(false);
                                }}
                                size="sm"
                                className="px-4"
                            >
                                <FiPrinter className="me-1" />
                                Print Report
                            </Button>
                        </div>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* Save Confirmation Modal */}
            <Modal show={showSaveConfirmModal} onHide={() => setShowSaveConfirmModal(false)} centered>
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>Confirm Save</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to save this company?</p>
                    {currentCompany && (
                        <div className="alert alert-warning small">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            This will update the existing company: <strong>{currentCompany.name}</strong>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowSaveConfirmModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => {
                        handleSubmit();
                        setShowSaveConfirmModal(false);
                    }}>
                        {currentCompany ? 'Update Company' : 'Create Company'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Product Modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </div>
    );
};

export default ItemsCompany;