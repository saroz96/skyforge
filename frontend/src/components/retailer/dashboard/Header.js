import React from 'react';
import { Dropdown } from 'react-bootstrap';

const Header = ({ user }) => {
  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid">
        <ul className="navbar-nav">
          <li className="nav-item">
            <a className="nav-link" data-lte-toggle="sidebar" href="#" role="button">
              <i className="bi bi-list"></i>
            </a>
          </li>
          {/* Other nav items */}
        </ul>
        
        <ul className="navbar-nav ms-auto">
          <Dropdown as="li" className="nav-item dropdown user-menu">
            <Dropdown.Toggle as="a" className="nav-link dropdown-toggle">
              <img src="/assets/img/human_icon.jpg" className="user-image rounded-circle shadow" alt="User" />
              <span className="d-none d-md-inline">{user.name}</span>
            </Dropdown.Toggle>
            
            <Dropdown.Menu className="dropdown-menu-lg dropdown-menu-end">
              <div className="user-header text-bg-primary">
                <img src="/assets/img/human_icon.jpg" className="rounded-circle shadow" alt="User" />
                <p>
                  {user.name} - {user.role}
                  <small>Member since {new Date().toDateString()}</small>
                </p>
              </div>
              
              <div className="user-body">
                <div className="row">
                  <div className="col-6 text-center">
                    <Dropdown.Item href="/admin/users/list">Users</Dropdown.Item>
                  </div>
                  <div className="col-6 text-center">
                    <Dropdown.Item href={`/admin/users/view/${user._id}`}>Profile</Dropdown.Item>
                  </div>
                </div>
              </div>
              
              <div className="user-footer">
                <a href="/user/change-password" className="btn btn-default btn-flat">Change Password</a>
                <a href="/logout" className="btn btn-default btn-flat float-end">Sign out</a>
              </div>
            </Dropdown.Menu>
          </Dropdown>
        </ul>
      </div>
    </nav>
  );
};

export default Header;