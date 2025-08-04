import React from 'react';

const StatsCards = ({ cashBalance, netSales, bankBalance, totalStock }) => {
    // Format numbers with commas and 2 decimal places
    const formatNumber = (num) => {
        return (num || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    return (
        <div className="row">
            {/* Cash Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-primary border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Cash Balance</h6>
                                <h3 className="mb-0">{formatNumber(cashBalance)} <small className="text-muted fs-6">Rs.</small></h3>
                            </div>
                            <div className="bg-primary bg-opacity-10 p-3 rounded">
                                <i className="bi bi-cash-coin fs-4 text-primary"></i>
                            </div>
                        </div>
                        <div className="mt-3">
                            <a href="#" className="text-primary text-decoration-none small">
                                View details <i className="bi bi-arrow-right-short"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sales Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-success border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Net Sales</h6>
                                <h3 className="mb-0">{formatNumber(netSales)} <small className="text-muted fs-6">Rs.</small></h3>
                            </div>
                            <div className="bg-success bg-opacity-10 p-3 rounded">
                                <i className="bi bi-graph-up fs-4 text-success"></i>
                            </div>
                        </div>
                        <div className="mt-3">
                            <a href="#" className="text-success text-decoration-none small">
                                View details <i className="bi bi-arrow-right-short"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bank Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-info border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Bank Balance</h6>
                                <h3 className="mb-0">{formatNumber(bankBalance)} <small className="text-muted fs-6">Rs.</small></h3>
                            </div>
                            <div className="bg-info bg-opacity-10 p-3 rounded">
                                <i className="bi bi-bank fs-4 text-info"></i>
                            </div>
                        </div>
                        <div className="mt-3">
                            <a href="#" className="text-info text-decoration-none small">
                                View details <i className="bi bi-arrow-right-short"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inventory Card */}
            <div className="col-lg-3 col-md-6 col-12 mb-4">
                <div className="card border-start border-warning border-4">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="text-muted mb-1">Total Inventory</h6>
                                <h3 className="mb-0">{formatNumber(totalStock)} <small className="text-muted fs-6">Rs.</small></h3>
                            </div>
                            <div className="bg-warning bg-opacity-10 p-3 rounded">
                                <i className="bi bi-box-seam fs-4 text-warning"></i>
                            </div>
                        </div>
                        <div className="mt-3">
                            <a href="#" className="text-warning text-decoration-none small">
                                View details <i className="bi bi-arrow-right-short"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsCards;