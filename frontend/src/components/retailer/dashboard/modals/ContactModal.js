import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import axios from 'axios';
import '../../../../stylesheet/retailer/dashboard/modals/ContactModal.css'

const ContactModal = ({ show, onHide }) => {
    const [contacts, setContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentFocus, setCurrentFocus] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const listRef = useRef(null);
    const rowRefs = useRef([]);

    useEffect(() => {
        if (show) {
            fetchContacts();
        }
    }, [show]);

    useEffect(() => {
        const filtered = contacts.filter(contact =>
            (contact.name && contact.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (contact.address && contact.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (contact.phone && contact.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (contact.contactperson && contact.contactperson.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        setFilteredContacts(filtered);
        setCurrentFocus(0);
    }, [searchQuery, contacts]);

    useEffect(() => {
        // Scroll to the active item when currentFocus changes
        if (rowRefs.current[currentFocus] && listRef.current) {
            const activeItem = rowRefs.current[currentFocus];
            const container = listRef.current;
            
            // Calculate positions
            const containerTop = container.scrollTop;
            const containerBottom = containerTop + container.clientHeight;
            const activeItemTop = activeItem.offsetTop;
            const activeItemBottom = activeItemTop + activeItem.clientHeight;

            // Scroll if needed
            if (activeItemTop < containerTop) {
                // Item is above the visible area
                container.scrollTo({
                    top: activeItemTop,
                    behavior: 'smooth'
                });
            } else if (activeItemBottom > containerBottom) {
                // Item is below the visible area
                container.scrollTo({
                    top: activeItemBottom - container.clientHeight,
                    behavior: 'smooth'
                });
            }
        }
    }, [currentFocus]);

    const fetchContacts = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get('/api/retailer/contacts');
            setContacts(response.data);
            setFilteredContacts(response.data);
            setSearchQuery('');
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (filteredContacts.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCurrentFocus(prev => (prev + 1) % filteredContacts.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCurrentFocus(prev => (prev - 1 + filteredContacts.length) % filteredContacts.length);
        } else if (e.key === 'Enter' && filteredContacts[currentFocus]) {
            e.preventDefault();
            selectContact(filteredContacts[currentFocus]);
        } else if (e.key === 'Escape') {
            onHide();
        }
    };

    const selectContact = (contact) => {
        console.log('Selected contact:', contact);
        onHide();
    };

    return (
        <Modal 
            show={show} 
            onHide={onHide} 
            size="xl"
            onKeyDown={handleKeyDown}
            className="custom-modal"
            dialogClassName="modal-90w"
        >
            <Modal.Header closeButton className="modal-header-custom">
                <Modal.Title>Contact Details</Modal.Title>
            </Modal.Header>
            <Modal.Body className="modal-body-custom">
                <Form.Group className="mb-4">
                    <Form.Control
                        type="text"
                        placeholder="Search contacts by name, address, phone, email or contact person..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="search-input"
                        autoComplete='off'
                    />
                </Form.Group>

                {isLoading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                ) : (
                    <div className="contacts-container">
                        <div className="contacts-header">
                            <div className="contact-cell header-cell">Name</div>
                            <div className="contact-cell header-cell">Address</div>
                            <div className="contact-cell header-cell">Phone</div>
                            <div className="contact-cell header-cell">Email</div>
                            <div className="contact-cell header-cell">Contact Person</div>
                        </div>
                        <div
                            className="contacts-list"
                            ref={listRef}
                        >
                            {filteredContacts.length === 0 ? (
                                <div className="contact-row text-center py-4 text-muted">
                                    No matching contacts found
                                </div>
                            ) : (
                                filteredContacts.map((contact, index) => (
                                    <div
                                        key={index}
                                        ref={el => rowRefs.current[index] = el}
                                        className={`contact-row ${index === currentFocus ? 'active' : ''}`}
                                        onClick={() => selectContact(contact)}
                                    >
                                        <div className="contact-cell">{contact.name || 'N/A'}</div>
                                        <div className="contact-cell">{contact.address || 'N/A'}</div>
                                        <div className="contact-cell">{contact.phone || 'N/A'}</div>
                                        <div className="contact-cell">{contact.email || 'N/A'}</div>
                                        <div className="contact-cell">{contact.contactperson || 'N/A'}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer className="modal-footer-custom">
                <div className="text-muted small me-auto">
                    {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
                </div>
                <Button variant="danger" onClick={onHide}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ContactModal;