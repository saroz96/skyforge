import React, { useState, useEffect } from 'react';
import StatsCards from './StatsCards';
import SalesChart from './SalesChart';
import QuickActions from './QuickActions';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../../stylesheet/retailer/helper/compositionhelper.css';
import '../../../stylesheet/retailer/helper/helperCss.css';
import '../../../stylesheet/retailer/helper/loader.css';
import Header from '../Header';
import axios from 'axios';
import ProductModal from './modals/ProductModal';
import ContactModal from './modals/ContactModal';
import { Button } from 'react-bootstrap';

const DashboardV1 = () => {
    const [showProductModal, setShowProductModal] = useState(false);
    const [showContactsModal, setShowContactsModal] = useState(false);
    const [showButton, setShowButton] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);
    const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch user data - response contains { user: { ... } }
                const userRes = await axios.get('/api/auth/me');
                const userData = userRes.data.user; // Access the nested user object
                setUser(userData);
                setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to fetch data');
                setLoading(false);
            }
        };

        fetchData();

        // Add F9 key handler here
        const handleKeyDown = (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                setShowProductModal(prev => !prev); // Toggle modal visibility
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Handle F4 key press globally
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F4') {
                e.preventDefault();
                setShowContactsModal(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);


    return (
        <>
            <div className="app-content-header">
                <Header />
                <div className="container-fluid">
                    {/* Header content */}
                </div>
            </div>
            {showButton && (
                <button
                    className="btn btn-primary"
                    onClick={() => setShowProductModal(true)}
                >
                    View Products (F9)
                </button>
            )}

            <div>
                {showButton && (
                    <Button variant="primary" onClick={() => setShowContactsModal(true)}>
                        Open Contacts (F4)
                    </Button>
                )}

                <ContactModal
                    show={showContactsModal}
                    onHide={() => setShowContactsModal(false)}
                />
            </div>
            <div className="app-content">
                <div className="container-fluid">
                    <div className="row">
                        {isAdminOrSupervisor && (
                            <StatsCards />
                        )}

                        <div className="row mt-3">
                            <div className="col-lg-7 connectedSortable">
                                <SalesChart />
                            </div>

                            <div className="col-lg-5 connectedSortable">
                                <QuickActions />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Product modal */}
            {showProductModal && (
                <ProductModal onClose={() => setShowProductModal(false)} />
            )}
        </>
    );
};

export default DashboardV1;