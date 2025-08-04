import React from 'react';

import '../../../stylesheet/retailer/helper/QuickActions.css'
const QuickActions = () => {
  const actions = [
    { icon: 'bi-person-plus-fill', label: 'Create Party', link: '/companies', color: 'text-info' },
    { icon: 'bi-box-seam-fill', label: 'Create Items', link: '/create/items', color: 'text-success' },
    { icon: 'bi-receipt', label: 'New Invoice', link: '/invoices/create', color: 'text-warning' },
    { icon: 'bi-cash-stack', label: 'Receive Payment', link: '/payments/create', color: 'text-primary' },
    { icon: 'bi-file-earmark-text', label: 'Reports', link: '/reports', color: 'text-danger' },
    { icon: 'bi-gear-fill', label: 'Settings', link: '/settings', color: 'text-secondary' },
  ];

  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-header bg-white border-0 pb-0">
        <h5 className="card-title mb-0 d-flex align-items-center">
          <i className="bi bi-lightning-charge-fill fs-4 text-warning me-2"></i>
          <span className="fw-semibold">Quick Actions</span>
        </h5>
      </div>
      <div className="card-body p-3">
        <div className="row g-3">
          {actions.map((action, index) => (
            <div className="col-6 col-md-4 col-lg-3" key={index}>
              <a 
                href={action.link}
                className="text-decoration-none"
              >
                <div className="card h-100 border-0 shadow-sm hover-effect">
                  <div className="card-body text-center p-3 d-flex flex-column justify-content-center">
                    <div className={`${action.color} mb-2`}>
                      <i className={`bi ${action.icon} fs-3`}></i>
                    </div>
                    <h6 className="mb-0 text-dark fw-medium">{action.label}</h6>
                  </div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;