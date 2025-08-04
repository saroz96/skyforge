// CompanyList.js
import React from 'react';
import { Table, Badge, Button } from 'react-bootstrap';
import {FaEye} from 'react-icons/fa';
import { Link } from 'react-router-dom';

const CompanyList = ({ companies, onCompanyClick, isAdminOrSupervisor }) => {
  if (companies.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-building fa-3x text-muted mb-3"></i>
        <h4>No Companies Available</h4>
        <p className="text-muted">
          {isAdminOrSupervisor 
            ? "You don't have any companies yet. Create your first company to get started."
            : "You haven't been added to any companies yet."}
        </p>
        {isAdminOrSupervisor && (
          <Button as={Link} to="/api/company/new" variant="primary" className="mt-3">
            <i className="fas fa-plus-circle me-2"></i>Create Company
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <Table hover>
        <thead>
          <tr>
            <th>#</th>
            <th>Company Name</th>
            <th>Trade Type</th>
            <th>Date Format</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company, index) => (
            <tr key={company._id}>
              <td>{index + 1}</td>
              <td>
                <strong>{company.name}</strong>
              </td>
              <td>
                <Badge bg="primary">{company.tradeType}</Badge>
              </td>
              <td>
                <Badge bg="info" text="dark">
                  {company.dateFormat?.charAt(0).toUpperCase() + company.dateFormat?.slice(1)}
                </Badge>
              </td>
              <td className="text-end">
                <div className="d-flex justify-content-end gap-2">
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => onCompanyClick(company._id)}
                  >
                    <i className="fas fa-door-open me-1"></i>Open
                  </Button>
                  <Button 
                    as={Link}
                    to={`/api/company/${company._id}`}
                    variant="info" 
                    size="md"
                  >
                    <FaEye/>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default CompanyList;