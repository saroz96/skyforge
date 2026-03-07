// import React, { useState, useEffect, useRef } from 'react';

// import { Table, Badge, Button } from 'react-bootstrap';
// import { FaEye } from 'react-icons/fa';
// import { Link } from 'react-router-dom';

// const CompanyList = ({ companies, onCompanyClick, isAdminOrSupervisor }) => {
//   const [selectedIndex, setSelectedIndex] = useState(0);
//   const tableRef = useRef(null);

//   useEffect(() => {
//     if (companies.length > 0) {
//       // Focus the first row when data loads
//       focusRow(0);
//     }
//   }, [companies]);

//   const focusRow = (index) => {
//     setSelectedIndex(index);
//     if (tableRef.current) {
//       const rows = tableRef.current.querySelectorAll('tbody tr');
//       if (rows.length > index) {
//         rows[index].focus();
//       }
//     }
//   };

//   const handleKeyDown = (e, companyId, index) => {
//     if (companies.length === 0) return;

//     switch (e.key) {
//       case 'ArrowUp':
//         e.preventDefault();
//         if (selectedIndex > 0) {
//           focusRow(selectedIndex - 1);
//         }
//         break;
//       case 'ArrowDown':
//         e.preventDefault();
//         if (selectedIndex < companies.length - 1) {
//           focusRow(selectedIndex + 1);
//         }
//         break;
//       case 'Enter':
//         e.preventDefault();
//         onCompanyClick(companyId);
//         break;
//       default:
//         break;
//     }
//   };

//   // Empty state
//   if (companies.length === 0) {
//     return (
//       <div className="text-center py-5">
//         <i className="fas fa-building fa-3x text-muted mb-3"></i>
//         <h4>No Companies Available</h4>
//         <p className="text-muted">
//           {isAdminOrSupervisor
//             ? "You don't have any companies yet. Create your first company to get started."
//             : "You haven't been added to any companies yet."}
//         </p>
//         {isAdminOrSupervisor && (
//           <Button as={Link} to="/company/new" variant="primary" className="mt-3">
//             <i className="fas fa-plus-circle me-2"></i>Create Company
//           </Button>
//         )}
//       </div>
//     );
//   }

//   // Company list
//   return (
//     <div className="table-responsive" ref={tableRef}>
//       <Table hover>
//         <thead>
//           <tr>
//             <th>#</th>
//             <th>Company Name</th>
//             <th>Trade Type</th>
//             <th>Date Format</th>
//             <th className="text-end">Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           {companies.map((company, index) => (
//             <tr 
//               key={company._id}
//               tabIndex={0}
//               className={selectedIndex === index ? 'table-active' : ''}
//               onKeyDown={(e) => handleKeyDown(e, company._id, index)}
//               onClick={() => {
//                 setSelectedIndex(index);
//                 onCompanyClick(company._id);
//               }}
//               style={{ cursor: 'pointer' }}
//             >
//               <td>{index + 1}</td>
//               <td>
//                 <strong>{company.name}</strong>
//               </td>
//               <td>
//                 <Badge bg="primary">{company.tradeType}</Badge>
//               </td>
//               <td>
//                 <Badge bg="info" text="dark">
//                   {company.dateFormat?.charAt(0).toUpperCase() + company.dateFormat?.slice(1)}
//                 </Badge>
//               </td>
//               <td className="text-end">
//                 <div className="d-flex justify-content-end gap-2">
//                   <Button
//                     variant="primary"
//                     size="sm"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       onCompanyClick(company._id);
//                     }}
//                   >
//                     <i className="fas fa-door-open me-1"></i>Open
//                   </Button>
//                   <Button
//                     as={Link}
//                     to={`/company/${company._id}`}
//                     variant="info"
//                     size="md"
//                     onClick={(e) => e.stopPropagation()}
//                   >
//                     <FaEye />
//                   </Button>
//                 </div>
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </Table>
//     </div>
//   );
// };

// export default CompanyList;

//------------------------------------------------------------------------end


import React, { useState, useEffect, useRef } from 'react';
import { Table, Badge, Button } from 'react-bootstrap';
import { FaEye } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const CompanyList = ({ companies, onCompanyClick, isAdminOrSupervisor }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tableRef = useRef(null);

  useEffect(() => {
    if (companies.length > 0) {
      focusRow(0);
    }
  }, [companies]);

  const focusRow = (index) => {
    setSelectedIndex(index);
    if (tableRef.current) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      if (rows.length > index) {
        rows[index].focus();
      }
    }
  };

  const handleKeyDown = (e, companyId, index) => {
    if (companies.length === 0) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (selectedIndex > 0) {
          focusRow(selectedIndex - 1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (selectedIndex < companies.length - 1) {
          focusRow(selectedIndex + 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        onCompanyClick(companyId);
        break;
      default:
        break;
    }
  };

  if (companies.length === 0) {
    return (
      <div className="text-center py-3" style={{ minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <i className="fas fa-building fa-2x text-muted mb-2"></i>
        <h5 className="mb-1" style={{ fontSize: '1rem' }}>No Companies Available</h5>
        <p className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>
          {isAdminOrSupervisor
            ? "Create your first company to get started."
            : "You haven't been added to any companies yet."}
        </p>
        {isAdminOrSupervisor && (
          <Button 
            as={Link} 
            to="/company/new" 
            variant="primary" 
            size="sm"
            className="mt-1"
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
          >
            <i className="fas fa-plus-circle me-1"></i>Create Company
          </Button>
        )}
      </div>
    );
  }

  return (
    <div 
      className="table-responsive" 
      ref={tableRef} 
      style={{ 
        maxHeight: '320px', 
        overflowY: 'auto',
        border: '1px solid #dee2e6',
        borderRadius: '4px'
      }}
    >
      <Table hover size="sm" className="mb-0" style={{ marginBottom: '0' }}>
        <thead className="sticky-top" style={{ 
          backgroundColor: '#f8f9fa',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <tr>
            <th style={{ 
              width: '5%', 
              padding: '6px 8px', 
              fontSize: '0.85rem',
              fontWeight: '600',
              borderBottom: '2px solid #dee2e6'
            }}>#</th>
            <th style={{ 
              width: '35%', 
              padding: '6px 8px', 
              fontSize: '0.85rem',
              fontWeight: '600',
              borderBottom: '2px solid #dee2e6'
            }}>Company Name</th>
            <th style={{ 
              width: '20%', 
              padding: '6px 8px', 
              fontSize: '0.85rem',
              fontWeight: '600',
              borderBottom: '2px solid #dee2e6'
            }}>Trade Type</th>
            <th style={{ 
              width: '20%', 
              padding: '6px 8px', 
              fontSize: '0.85rem',
              fontWeight: '600',
              borderBottom: '2px solid #dee2e6'
            }}>Date Format</th>
            <th style={{ 
              width: '20%', 
              padding: '6px 8px', 
              fontSize: '0.85rem',
              fontWeight: '600',
              borderBottom: '2px solid #dee2e6'
            }} className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company, index) => (
            <tr 
              key={company._id}
              tabIndex={0}
              className={selectedIndex === index ? 'table-active' : ''}
              onKeyDown={(e) => handleKeyDown(e, company._id, index)}
              onClick={() => {
                setSelectedIndex(index);
                onCompanyClick(company._id);
              }}
              style={{ 
                cursor: 'pointer',
                height: '36px'
              }}
            >
              <td style={{ 
                padding: '4px 8px', 
                verticalAlign: 'middle',
                fontSize: '0.85rem'
              }}>{index + 1}</td>
              <td style={{ 
                padding: '4px 8px', 
                verticalAlign: 'middle'
              }}>
                <strong style={{ fontSize: '0.9rem' }}>{company.name}</strong>
              </td>
              <td style={{ 
                padding: '4px 8px', 
                verticalAlign: 'middle'
              }}>
                <Badge 
                  bg="primary" 
                  className="px-2 py-1" 
                  style={{ 
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}
                >
                  {company.tradeType}
                </Badge>
              </td>
              <td style={{ 
                padding: '4px 8px', 
                verticalAlign: 'middle'
              }}>
                <Badge 
                  bg="info" 
                  text="dark" 
                  className="px-2 py-1" 
                  style={{ 
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}
                >
                  {company.dateFormat?.charAt(0).toUpperCase() + company.dateFormat?.slice(1)}
                </Badge>
              </td>
              <td style={{ 
                padding: '4px 8px', 
                verticalAlign: 'middle'
              }} className="text-end">
                <div className="d-flex justify-content-end gap-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="py-0 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompanyClick(company._id);
                    }}
                    style={{ 
                      fontSize: '0.8rem',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <i className="fas fa-door-open me-1" style={{ fontSize: '0.75rem' }}></i>
                    <span>Open</span>
                  </Button>
                  <Button
                    as={Link}
                    to={`/company/${company._id}`}
                    variant="outline-info"
                    size="sm"
                    className="py-0 px-2"
                    onClick={(e) => e.stopPropagation()}
                    style={{ 
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0'
                    }}
                  >
                    <FaEye style={{ fontSize: '0.8rem' }} />
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