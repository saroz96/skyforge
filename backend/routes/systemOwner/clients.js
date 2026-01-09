const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isLoggedIn, ensureAuthenticated } = require('../../middleware/auth');
const ObjectId = mongoose.Types.ObjectId;
const Company = require('../../models/Company');


// Route to fetch and display all companies
router.get('/clients', isLoggedIn, ensureAuthenticated, async (req, res) => {
    try {
        const clients = await Company.find({});
        
        // Check if it's an API/JSON request (typically from React)
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                success: true,
                message: 'Clients fetched successfully',
                data: clients.map(client => ({
                    id: client._id,
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    address: client.address,
                    contactPerson: client.contactPerson,
                    status: client.status || 'active',
                    createdAt: client.createdAt,
                    updatedAt: client.updatedAt
                    // Add any other fields you need
                })),
                count: clients.length
            });
        }
        
        // If it's a regular request (for EJS templates)
        res.render('systemAdmin/clients', {
            title: '',
            body: '',
            user: req.user,
            clients
        });
    } catch (err) {
        console.error('Error fetching companies:', err);
        
        // JSON response for error
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(500).json({
                success: false,
                message: 'Could not fetch clients. Please try again.',
                error: err.message
            });
        }
        
        req.flash('error', 'Could not fetch clients. Please try again.');
        res.redirect('/admin/dashboard');
    }
});

module.exports = router;