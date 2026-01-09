const express = require('express');
const router = express.Router();
const DutySchedule = require('../models/DutySchedule');
const Company = require('../models/Company');
const { ensureAuthenticated, authorize } = require('../middleware/auth');
const User = require('../models/User');
const FiscalYear = require('../models/FiscalYear');

// Create duty schedule
router.post('/create', ensureAuthenticated, authorize('admin'), async (req, res) => {
    try {
        const {
            userId,
            companyId,
            scheduleType,
            specificDates,
            recurringPattern,
            weekDays,
            monthDays,
            startDate,
            endDate,
            dutyHours,
            officeLocationId,
            notes
        } = req.body;

        console.log('📝 Creating duty schedule with:', { userId, companyId, scheduleType });

        // Validate required fields
        if (!userId || !companyId || !dutyHours || !dutyHours.startTime || !dutyHours.endTime) {
            return res.status(400).json({
                success: false,
                message: 'User ID, company ID, and duty hours are required'
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if company exists
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Check if admin/supervisor has access
        const admin = await User.findById(req.user._id);
        const isAdmin = admin.isAdmin || admin.role === 'Admin' || admin.role === 'ADMINISTRATOR' || admin.role === 'Supervisor';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only admins and supervisors can create duty schedules'
            });
        }

        // Parse dates
        const parsedStartDate = startDate ? new Date(startDate) : undefined;
        const parsedEndDate = endDate ? new Date(endDate) : undefined;

        let parsedSpecificDates = undefined;
        if (scheduleType === 'specific' && specificDates) {
            parsedSpecificDates = specificDates.map(date => new Date(date));
        }

        // Get office location if provided
        let officeLocationData = null;
        if (officeLocationId && company.attendanceSettings && company.attendanceSettings.officeLocations) {
            const location = company.attendanceSettings.officeLocations.find(
                loc => loc._id.toString() === officeLocationId
            );
            if (location) {
                officeLocationData = {
                    _id: location._id.toString(),
                    name: location.name,
                    coordinates: location.coordinates,
                    radius: location.radius,
                    address: location.address
                };
            }
        }

        // Create duty schedule
        const dutySchedule = new DutySchedule({
            user: userId,
            company: companyId,
            scheduleType: scheduleType || 'recurring',
            specificDates: parsedSpecificDates,
            recurringPattern: scheduleType === 'recurring' ? (recurringPattern || 'daily') : undefined,
            weekDays: scheduleType === 'recurring' && recurringPattern === 'weekly' ? weekDays : undefined,
            monthDays: scheduleType === 'recurring' && recurringPattern === 'monthly' ? monthDays : undefined,
            startDate: scheduleType === 'recurring' ? parsedStartDate : undefined,
            endDate: scheduleType === 'recurring' ? parsedEndDate : undefined,
            dutyHours: {
                startTime: dutyHours.startTime,
                endTime: dutyHours.endTime,
                gracePeriod: dutyHours.gracePeriod || 15,
                breakDuration: dutyHours.breakDuration || 60
            },
            officeLocation: officeLocationData,
            isActive: true,
            createdBy: req.user._id,
            notes: notes
        });

        await dutySchedule.save();

        // Populate the created schedule
        const populatedSchedule = await DutySchedule.findById(dutySchedule._id)
            .populate('user', 'name email');

        console.log('✅ Schedule created successfully:', dutySchedule._id);

        res.status(201).json({
            success: true,
            message: 'Duty schedule created successfully',
            data: populatedSchedule
        });

    } catch (error) {
        console.error('Create duty schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// // Create manual schedules (multiple individual schedules)
// router.post('/create-manual', ensureAuthenticated, authorize('admin'), async (req, res) => {
//     try {
//         const {
//             userId,
//             companyId,
//             schedules, // Array of schedule objects
//             createdBy
//         } = req.body;

//         console.log('📝 Creating manual schedules:', { 
//             userId, 
//             companyId,
//             scheduleCount: schedules?.length || 0 
//         });

//         // Validate required fields
//         if (!userId || !companyId || !schedules || schedules.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'User ID, company ID, and schedules are required'
//             });
//         }

//         // Check if user exists
//         const userExists = await User.findById(userId);
//         if (!userExists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'User not found'
//             });
//         }

//         // Check if company exists
//         const company = await Company.findById(companyId);
//         if (!company) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Company not found'
//             });
//         }

//         // Get office locations for reference
//         const officeLocations = company.attendanceSettings?.officeLocations || [];

//         // Create individual schedules for each date
//         const createdSchedules = [];

//         for (const scheduleData of schedules) {
//             // Get office location if provided
//             let officeLocationData = null;
//             if (scheduleData.officeLocationId && officeLocations.length > 0) {
//                 const location = officeLocations.find(
//                     loc => loc._id.toString() === scheduleData.officeLocationId
//                 );
//                 if (location) {
//                     officeLocationData = {
//                         _id: location._id.toString(),
//                         name: location.name,
//                         coordinates: location.coordinates,
//                         radius: location.radius,
//                         address: location.address
//                     };
//                 }
//             }

//             // Create individual duty schedule
//             const dutySchedule = new DutySchedule({
//                 user: userId,
//                 company: companyId,
//                 scheduleType: 'specific',
//                 specificDates: [new Date(scheduleData.date)], // Single specific date
//                 dutyHours: {
//                     startTime: scheduleData.dutyHours.startTime,
//                     endTime: scheduleData.dutyHours.endTime,
//                     gracePeriod: scheduleData.dutyHours.gracePeriod || 15,
//                     breakDuration: scheduleData.dutyHours.breakDuration || 60
//                 },
//                 officeLocation: officeLocationData,
//                 isActive: true,
//                 createdBy: createdBy || req.user._id,
//                 notes: scheduleData.notes || ''
//             });

//             await dutySchedule.save();
//             createdSchedules.push(dutySchedule._id);

//             console.log(`✅ Created schedule for ${scheduleData.date}`);
//         }

//         console.log(`✅ Successfully created ${createdSchedules.length} manual schedules`);

//         res.status(201).json({
//             success: true,
//             message: `Successfully created ${createdSchedules.length} schedule(s)`,
//             data: {
//                 count: createdSchedules.length,
//                 scheduleIds: createdSchedules,
//                 dateRange: {
//                     start: schedules[0].date,
//                     end: schedules[schedules.length - 1].date
//                 }
//             }
//         });

//     } catch (error) {
//         console.error('Create manual schedules error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });

// router.post('/create-manual', ensureAuthenticated, authorize('admin'), async (req, res) => {
//     try {
//         const {
//             userId,
//             companyId,
//             schedules, // Array of schedule objects with date ranges
//             createdBy
//         } = req.body;

//         console.log('📝 Creating manual schedules with date ranges:', {
//             userId,
//             companyId,
//             scheduleCount: schedules?.length || 0,
//             schedulesData: schedules
//         });

//         // Validate required fields
//         if (!userId || !companyId || !schedules || schedules.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'User ID, company ID, and schedules are required'
//             });
//         }

//         // Check if user exists
//         const userExists = await User.findById(userId);
//         if (!userExists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'User not found'
//             });
//         }

//         // Check if company exists
//         const company = await Company.findById(companyId);
//         if (!company) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Company not found'
//             });
//         }

//         // Get office locations for reference
//         const officeLocations = company.attendanceSettings?.officeLocations || [];

//         // Create individual schedules for each date range
//         const createdSchedules = [];
//         const allDates = [];

//         for (const scheduleData of schedules) {
//             // Validate schedule data
//             if (!scheduleData.date) {
//                 console.error('Missing date in schedule data:', scheduleData);
//                 continue;
//             }

//             // Get office location if provided
//             let officeLocationData = null;
//             if (scheduleData.officeLocationId && officeLocations.length > 0) {
//                 const location = officeLocations.find(
//                     loc => loc._id.toString() === scheduleData.officeLocationId
//                 );
//                 if (location) {
//                     officeLocationData = {
//                         _id: location._id.toString(),
//                         name: location.name,
//                         coordinates: location.coordinates,
//                         radius: location.radius,
//                         address: location.address
//                     };
//                 }
//             }

//             // Parse start and end dates
//             const startDate = new Date(scheduleData.date);
//             const endDate = scheduleData.endDate ? new Date(scheduleData.endDate) : new Date(scheduleData.date);

//             // Validate date range
//             if (endDate < startDate) {
//                 console.warn(`Invalid date range: end date ${endDate} is before start date ${startDate}`);
//                 continue;
//             }

//             // Generate all dates in the range
//             const datesInRange = [];
//             let currentDate = new Date(startDate);

//             while (currentDate <= endDate) {
//                 datesInRange.push(new Date(currentDate));
//                 currentDate.setDate(currentDate.getDate() + 1);
//             }

//             console.log(`📅 Processing date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
//             console.log(`📅 Dates in range: ${datesInRange.length} days`);

//             // Create a schedule for each date in the range
//             for (const date of datesInRange) {
//                 // Check if schedule already exists for this date
//                 const existingSchedule = await DutySchedule.findOne({
//                     user: userId,
//                     company: companyId,
//                     scheduleType: 'specific',
//                     specificDates: {
//                         $elemMatch: {
//                             $eq: date
//                         }
//                     },
//                     isActive: true
//                 });

//                 if (existingSchedule) {
//                     console.log(`⚠️ Schedule already exists for ${date.toISOString().split('T')[0]}, skipping...`);
//                     continue;
//                 }

//                 // Create individual duty schedule
//                 const dutySchedule = new DutySchedule({
//                     user: userId,
//                     company: companyId,
//                     scheduleType: 'specific',
//                     specificDates: [date],
//                     dutyHours: {
//                         startTime: scheduleData.dutyHours.startTime,
//                         endTime: scheduleData.dutyHours.endTime,
//                         gracePeriod: scheduleData.dutyHours.gracePeriod || 15,
//                         breakDuration: scheduleData.dutyHours.breakDuration || 60
//                     },
//                     officeLocation: officeLocationData,
//                     isActive: true,
//                     createdBy: createdBy || req.user._id,
//                     notes: scheduleData.notes || ''
//                 });

//                 await dutySchedule.save();
//                 createdSchedules.push(dutySchedule._id);
//                 allDates.push(date.toISOString().split('T')[0]);

//                 console.log(`✅ Created schedule for ${date.toISOString().split('T')[0]}`);
//             }
//         }

//         console.log(`✅ Successfully created ${createdSchedules.length} manual schedules`);

//         // Get date range for response
//         let dateRange = {};
//         if (allDates.length > 0) {
//             const sortedDates = allDates.sort();
//             dateRange = {
//                 start: sortedDates[0],
//                 end: sortedDates[sortedDates.length - 1]
//             };
//         }

//         res.status(201).json({
//             success: true,
//             message: `Successfully created ${createdSchedules.length} schedule(s)`,
//             data: {
//                 count: createdSchedules.length,
//                 scheduleIds: createdSchedules,
//                 dates: allDates,
//                 dateRange: dateRange
//             }
//         });

//     } catch (error) {
//         console.error('Create manual schedules error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });

router.get('/admin/users/list', ensureAuthenticated, async (req, res) => {
    try {
        // Authorization check
        if (!req.user.isAdmin && req.user.role !== 'Supervisor') {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to view this page'
            });
        }

        // Fetch the company ID from the authenticated user's data
        const companyId = req.session.currentCompany;

        // Validate company association
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'No company is associated with your account'
            });
        }

        // Fetch company data with necessary fields
        const company = await Company.findById(companyId)
            .select('renewalDate fiscalYear dateFormat owner')
            .populate('fiscalYear')
            .populate('owner');

        // Handle fiscal year data
        let fiscalYear = req.session.currentFiscalYear ? req.session.currentFiscalYear.id : null;
        let currentFiscalYear = null;

        if (fiscalYear) {
            currentFiscalYear = await FiscalYear.findById(fiscalYear);
        }

        if (!currentFiscalYear && company.fiscalYear) {
            currentFiscalYear = company.fiscalYear;
            req.session.currentFiscalYear = {
                id: currentFiscalYear._id.toString(),
                startDate: currentFiscalYear.startDate,
                endDate: currentFiscalYear.endDate,
                name: currentFiscalYear.name,
                dateFormat: currentFiscalYear.dateFormat,
                isActive: currentFiscalYear.isActive
            };
            fiscalYear = req.session.currentFiscalYear.id;
        }

        if (!fiscalYear) {
            return res.status(400).json({
                success: false,
                error: 'No fiscal year found in session or company'
            });
        }

        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        // Fetch ALL users for the company - include all roles
        const users = await User.find({
            company: companyId
        })
            .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires')
            .sort({ isAdmin: -1, role: 1, createdAt: 1 }); // Sort admins first, then by role

        // Handle ownership
        let processedUsers = [...users];

        if (company.owner) {
            const ownerExists = processedUsers.some(user =>
                user._id.toString() === company.owner._id.toString()
            );

            if (!ownerExists) {
                const ownerData = company.owner.toObject();
                ownerData.isOwner = true;
                processedUsers.push(ownerData);
            } else {
                processedUsers = processedUsers.map(user => {
                    if (user._id.toString() === company.owner._id.toString()) {
                        user = user.toObject ? user.toObject() : user;
                        user.isOwner = true;
                    }
                    return user;
                });
            }
        }

        // Sort users with owner first, then admins, then others
        processedUsers.sort((a, b) => {
            // Owner comes first
            if (a.isOwner && !b.isOwner) return -1;
            if (!a.isOwner && b.isOwner) return 1;

            // Then sort by admin status
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;

            // Then sort by role
            const roleOrder = ['Admin', 'ADMINISTRATOR', 'Supervisor', 'Account', 'Sales', 'Purchase', 'User'];
            const aIndex = roleOrder.indexOf(a.role);
            const bIndex = roleOrder.indexOf(b.role);

            if (aIndex !== bIndex) return aIndex - bIndex;

            // Finally sort by creation date
            return new Date(a.createdAt) - new Date(b.createdAt);
        });

        // Prepare response data
        const responseData = {
            success: true,
            data: {
                company: {
                    id: company._id,
                    renewalDate: company.renewalDate,
                    dateFormat: company.dateFormat,
                    owner: company.owner ? {
                        id: company.owner._id,
                        name: company.owner.name,
                        email: company.owner.email,
                        role: company.owner.role
                    } : null
                },
                currentFiscalYear: currentFiscalYear ? {
                    id: currentFiscalYear._id,
                    startDate: currentFiscalYear.startDate,
                    endDate: currentFiscalYear.endDate,
                    name: currentFiscalYear.name,
                    dateFormat: currentFiscalYear.dateFormat,
                    isActive: currentFiscalYear.isActive
                } : null,
                users: processedUsers.map(user => ({
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    isAdmin: user.isAdmin || user.role === 'Admin' || user.role === 'ADMINISTRATOR',
                    isEmailVerified: user.isEmailVerified,
                    isOwner: user.isOwner || false,
                    preferences: user.preferences,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt,
                    // Include menu permissions if needed
                    menuPermissions: user.menuPermissions ?
                        Object.fromEntries(user.menuPermissions) : {}
                })),
                currentCompanyName: req.session.currentCompanyName,
                currentUser: {
                    id: req.user._id,
                    name: req.user.name,
                    role: req.user.role,
                    isAdmin: req.user.isAdmin,
                    theme: req.user.preferences?.theme || 'light'
                },
                isAdminOrSupervisor: req.user.isAdmin || req.user.role === 'Supervisor'
            }
        };

        res.json(responseData);

    } catch (err) {
        console.error('Error in users list route:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while fetching users'
        });
    }
});

router.get('/user/:userId', ensureAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;
        const { companyId } = req.query;

        console.log('📅 Fetching FUTURE schedules for user:', { userId, companyId });

        // Verify user can only access their own schedules
        // if (userId !== req.user._id.toString()) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'You can only view your own schedules'
        //     });
        // }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Query for ALL active schedules first
        let query = {
            user: userId,
            company: companyId,
            isActive: true
        };

        const allSchedules = await DutySchedule.find(query)
            .populate('company', 'name')
            .populate('createdBy', 'name email')
            .sort({ startDate: -1 }) // Changed from 1 (ascending) to -1 (descending)
            .lean();

        console.log(`📋 Found ${allSchedules.length} active schedules for user ${userId}`);

        // Filter to get ONLY schedules with TODAY or FUTURE occurrences
        const futureSchedules = allSchedules.filter(schedule => {
            const scheduleDoc = new DutySchedule(schedule);

            // For specific date schedules
            if (schedule.scheduleType === 'specific' && schedule.specificDates) {
                // Check if any specific date is today or in the future
                const hasFutureSpecificDate = schedule.specificDates.some(date => {
                    const specificDate = new Date(date);
                    specificDate.setHours(0, 0, 0, 0);
                    return specificDate >= today;
                });

                if (!hasFutureSpecificDate) {
                    console.log(`❌ Skipping specific schedule ${schedule._id} - no future specific dates`);
                    return false;
                }

                console.log(`✅ Keeping specific schedule ${schedule._id} - has future specific dates`);
                return true;
            }

            // For recurring schedules
            if (schedule.scheduleType === 'recurring') {
                // Check if schedule has ended
                if (schedule.endDate) {
                    const endDate = new Date(schedule.endDate);
                    endDate.setHours(23, 59, 59, 999);
                    if (endDate < today) {
                        console.log(`❌ Skipping recurring schedule ${schedule._id} - ended on ${schedule.endDate}`);
                        return false;
                    }
                }

                // Check if schedule has started yet
                const startDate = new Date(schedule.startDate);
                startDate.setHours(0, 0, 0, 0);

                // If schedule hasn't started yet, check if it starts in the future
                if (startDate >= today) {
                    console.log(`✅ Keeping recurring schedule ${schedule._id} - starts in future on ${schedule.startDate}`);
                    return true;
                }

                // If schedule has already started, check if there are any future occurrences
                // Check next 365 days for any occurrence
                for (let i = 0; i <= 365; i++) {
                    const futureDate = new Date(today);
                    futureDate.setDate(futureDate.getDate() + i);
                    futureDate.setHours(0, 0, 0, 0);

                    if (scheduleDoc.appliesToDate(futureDate)) {
                        console.log(`✅ Keeping recurring schedule ${schedule._id} - has future occurrence on ${futureDate.toISOString().split('T')[0]}`);
                        return true;
                    }
                }

                console.log(`❌ Skipping recurring schedule ${schedule._id} - no future occurrences in next 365 days`);
                return false;
            }

            console.log(`❌ Skipping schedule ${schedule._id} - unknown schedule type`);
            return false;
        });

        console.log(`✅ Found ${futureSchedules.length} schedules with TODAY or FUTURE occurrences for user ${userId}`);

        // Sort by next occurrence date (not just startDate) for better display
        const sortedSchedules = futureSchedules.sort((a, b) => {
            // Get the next occurrence date for each schedule
            const nextDateA = getNextOccurrenceDate(a, today);
            const nextDateB = getNextOccurrenceDate(b, today);

            // Sort in descending order (most recent first)
            return nextDateB - nextDateA; // Changed to descending
        });

        // Get company for office locations
        const company = await Company.findById(companyId).select('attendanceSettings');

        // Process schedules to include office location data
        const processedSchedules = sortedSchedules.map(schedule => {
            let officeLocationData = null;

            if (schedule.officeLocation) {
                officeLocationData = schedule.officeLocation;
            } else if (schedule.officeLocationId && company?.attendanceSettings?.officeLocations) {
                const location = company.attendanceSettings.officeLocations.find(
                    loc => loc._id.toString() === schedule.officeLocationId.toString()
                );
                if (location) {
                    officeLocationData = {
                        name: location.name,
                        coordinates: location.coordinates,
                        radius: location.radius,
                        address: location.address
                    };
                }
            }

            return {
                ...schedule,
                officeLocation: officeLocationData,
                nextOccurrence: getNextOccurrenceDate(schedule, today) // Add next occurrence date for frontend
            };
        });

        res.status(200).json({
            success: true,
            data: processedSchedules
        });

    } catch (error) {
        console.error('❌ Get user duty schedules error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Helper function to get next occurrence date
function getNextOccurrenceDate(schedule, fromDate) {
    const scheduleDoc = new DutySchedule(schedule);
    const today = new Date(fromDate);
    today.setHours(0, 0, 0, 0);

    // Check up to 365 days in the future
    for (let i = 0; i <= 365; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + i);
        futureDate.setHours(0, 0, 0, 0);

        if (scheduleDoc.appliesToDate(futureDate)) {
            return futureDate;
        }
    }

    // If no future occurrence found, return a far future date or null
    return new Date('9999-12-31');
}

// Check duty schedule for specific date
router.get('/check-date', ensureAuthenticated, async (req, res) => {
    try {
        const { userId, companyId, date } = req.query;

        console.log('📅 Checking duty schedule for date:', { userId, companyId, date });

        if (!userId || !companyId || !date) {
            return res.status(400).json({
                success: false,
                message: 'User ID, Company ID, and Date are required'
            });
        }

        // Verify user can only check their own schedule
        if (userId !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only check your own schedule'
            });
        }

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        console.log('📅 Checking date (processed):', checkDate);

        // Find active duty schedules for the user
        const schedules = await DutySchedule.find({
            user: userId,
            company: companyId,
            isActive: true
        }).lean();

        console.log(`📋 Found ${schedules.length} active schedules for user ${userId}`);

        // Check if any schedule applies to this date
        let applicableSchedule = null;
        for (const schedule of schedules) {
            const scheduleDoc = new DutySchedule(schedule);
            const applies = scheduleDoc.appliesToDate(checkDate);

            console.log(`Checking schedule ${schedule._id}: applies = ${applies}`);

            if (applies) {
                applicableSchedule = schedule;
                break;
            }
        }

        if (!applicableSchedule) {
            console.log('❌ No applicable schedule found for date:', date);
            return res.json({
                success: true,
                hasDuty: false,
                message: 'No duty schedule assigned for this date'
            });
        }

        console.log('✅ Found applicable schedule:', applicableSchedule._id);

        // Get company for office locations
        const company = await Company.findById(companyId).select('attendanceSettings');

        let officeLocationData = null;
        if (applicableSchedule.officeLocationId && company?.attendanceSettings?.officeLocations) {
            const location = company.attendanceSettings.officeLocations.find(
                loc => loc._id.toString() === applicableSchedule.officeLocationId.toString()
            );
            if (location) {
                officeLocationData = {
                    name: location.name,
                    coordinates: location.coordinates,
                    radius: location.radius,
                    address: location.address
                };
            }
        }

        return res.json({
            success: true,
            hasDuty: true,
            schedule: {
                _id: applicableSchedule._id,
                scheduleType: applicableSchedule.scheduleType,
                recurringPattern: applicableSchedule.recurringPattern,
                dutyHours: applicableSchedule.dutyHours,
                officeLocation: officeLocationData,
                officeLocationId: applicableSchedule.officeLocationId,
                startDate: applicableSchedule.startDate,
                endDate: applicableSchedule.endDate,
                notes: applicableSchedule.notes
            }
        });

    } catch (error) {
        console.error('❌ Error checking duty schedule for date:', error);
        res.status(500).json({
            success: false,
            message: 'Server error checking duty schedule',
            error: error.message
        });
    }
});

// Get upcoming schedule overview
router.get('/upcoming-overview', ensureAuthenticated, async (req, res) => {
    try {
        const { userId, companyId, days = 7 } = req.query;

        if (!userId || !companyId) {
            return res.status(400).json({
                success: false,
                message: 'User ID and Company ID are required'
            });
        }

        // Verify user can only access their own schedules
        if (userId !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only view your own schedules'
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all active schedules
        const schedules = await DutySchedule.find({
            user: userId,
            company: companyId,
            isActive: true
        }).lean();

        // Filter to get only schedules with future occurrences
        const futureSchedules = schedules.filter(schedule => {
            const scheduleDoc = new DutySchedule(schedule);

            // Check if schedule has any future occurrences
            if (schedule.scheduleType === 'recurring') {
                if (schedule.endDate) {
                    const endDate = new Date(schedule.endDate);
                    endDate.setHours(23, 59, 59, 999);
                    return endDate >= today;
                } else {
                    return true; // No end date - ongoing
                }
            }

            if (schedule.scheduleType === 'specific' && schedule.specificDates) {
                return schedule.specificDates.some(date => {
                    const specificDate = new Date(date);
                    specificDate.setHours(0, 0, 0, 0);
                    return specificDate >= today;
                });
            }

            const startDate = new Date(schedule.startDate);
            startDate.setHours(0, 0, 0, 0);
            return startDate >= today;
        });

        console.log(`📅 Fetching upcoming schedules from ${today} for ${days} days. Found ${futureSchedules.length} schedules with future occurrences`);

        // Generate upcoming schedule days
        const upcomingDays = [];
        for (let i = 0; i < parseInt(days); i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);

            let scheduleForDay = null;
            for (const schedule of futureSchedules) {
                const scheduleDoc = new DutySchedule(schedule);
                if (scheduleDoc.appliesToDate(date)) {
                    scheduleForDay = schedule;
                    break;
                }
            }

            // Get office location data if schedule has one
            let officeLocationData = null;
            if (scheduleForDay?.officeLocationId) {
                const company = await Company.findById(companyId).select('attendanceSettings');
                if (company?.attendanceSettings?.officeLocations) {
                    const location = company.attendanceSettings.officeLocations.find(
                        loc => loc._id.toString() === scheduleForDay.officeLocationId.toString()
                    );
                    if (location) {
                        officeLocationData = {
                            name: location.name,
                            coordinates: location.coordinates,
                            radius: location.radius,
                            address: location.address
                        };
                    }
                }
            }

            upcomingDays.push({
                date: date.toISOString().split('T')[0],
                dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
                hasSchedule: !!scheduleForDay,
                schedule: scheduleForDay ? {
                    _id: scheduleForDay._id,
                    scheduleType: scheduleForDay.scheduleType,
                    recurringPattern: scheduleForDay.recurringPattern,
                    dutyHours: scheduleForDay.dutyHours,
                    officeLocation: officeLocationData,
                    notes: scheduleForDay.notes
                } : null
            });
        }

        // Get today's schedule if exists
        const todaySchedule = upcomingDays.find(day =>
            day.date === today.toISOString().split('T')[0] && day.hasSchedule
        )?.schedule;

        res.status(200).json({
            success: true,
            data: {
                todaySchedule,
                upcomingDays,
                upcomingDaysCount: upcomingDays.filter(day => day.hasSchedule).length,
                totalFutureSchedules: futureSchedules.length
            }
        });

    } catch (error) {
        console.error('Error fetching upcoming overview:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get duty schedule for a specific date
router.get('/check/:userId', ensureAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;
        const { companyId, date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required'
            });
        }

        const checkDate = new Date(date);

        // Find active duty schedules for the user
        const schedules = await DutySchedule.find({
            user: userId,
            company: companyId,
            isActive: true
        });

        // Find schedule that applies to this date
        const applicableSchedule = schedules.find(schedule =>
            schedule.appliesToDate(checkDate)
        );

        if (!applicableSchedule) {
            return res.status(200).json({
                success: true,
                hasDuty: false,
                message: 'No duty schedule found for this date'
            });
        }

        res.status(200).json({
            success: true,
            hasDuty: true,
            data: {
                schedule: applicableSchedule,
                dutyHours: applicableSchedule.dutyHours,
                officeLocation: applicableSchedule.officeLocationId
            }
        });

    } catch (error) {
        console.error('Check duty schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Update duty schedule
router.put('/:id', ensureAuthenticated, authorize(['admin', 'supervisor']), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const schedule = await DutySchedule.findById(id);
        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Duty schedule not found'
            });
        }

        // Update only allowed fields
        const allowedUpdates = [
            'scheduleType', 'specificDates', 'recurringPattern', 'weekDays', 'monthDays',
            'startDate', 'endDate', 'dutyHours', 'officeLocationId', 'isActive', 'notes'
        ];

        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                schedule[field] = updates[field];
            }
        });

        await schedule.save();

        res.status(200).json({
            success: true,
            message: 'Duty schedule updated successfully',
            data: schedule
        });

    } catch (error) {
        console.error('Update duty schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Delete duty schedule
router.delete('/:id', ensureAuthenticated, authorize(['admin', 'supervisor']), async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await DutySchedule.findById(id);
        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'Duty schedule not found'
            });
        }

        // Soft delete by marking as inactive
        schedule.isActive = false;
        await schedule.save();

        res.status(200).json({
            success: true,
            message: 'Duty schedule deleted successfully'
        });

    } catch (error) {
        console.error('Delete duty schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get all duty schedules for a company (admin view)
router.get('/company/:companyId', ensureAuthenticated, async (req, res) => {
    try {
        const { companyId } = req.params;

        // Validate companyId
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        // Fetch schedules
        const schedules = await DutySchedule.find({
            company: companyId,
            isActive: true
        })
            .populate('user', 'name email role')
            .populate('company', 'name')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        console.log(`✅ Found ${schedules.length} schedules for company ${companyId}`);

        res.status(200).json({
            success: true,
            message: 'Duty schedules fetched successfully',
            data: schedules
        });

    } catch (error) {
        console.error('Get company duty schedules error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

router.get('/check-today', async (req, res) => {
    try {
        const { userId, companyId } = req.query;

        console.log('🔍 Checking duty schedule for today:', { userId, companyId });

        if (!userId || !companyId) {
            return res.status(400).json({
                success: false,
                message: 'User ID and Company ID are required'
            });
        }

        // Get today's date (normalized to start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log('📅 Today (normalized):', today.toISOString());

        // Find active schedules for the user
        const schedules = await DutySchedule.find({
            user: userId,
            company: companyId,
            isActive: true
        }).lean();

        console.log(`📋 Found ${schedules.length} active schedules for user ${userId}`);

        // Check if any schedule applies to today
        let applicableSchedule = null;

        for (const schedule of schedules) {
            const scheduleStartDate = schedule.startDate ? new Date(schedule.startDate) : null;
            if (scheduleStartDate) {
                scheduleStartDate.setHours(0, 0, 0, 0);
            }

            console.log('\n--- Checking Schedule ---');
            console.log('Schedule ID:', schedule._id);
            console.log('Schedule Type:', schedule.scheduleType);
            console.log('Start Date:', scheduleStartDate ? scheduleStartDate.toISOString() : 'None');
            console.log('End Date:', schedule.endDate ? new Date(schedule.endDate).toISOString() : 'None');
            console.log('Today:', today.toISOString());

            // For specific schedules
            if (schedule.scheduleType === 'specific' && schedule.specificDates) {
                console.log('Specific Dates:', schedule.specificDates.map(d => {
                    const date = new Date(d);
                    date.setHours(0, 0, 0, 0);
                    return date.toISOString();
                }));

                const applies = schedule.specificDates.some(specificDate => {
                    const date = new Date(specificDate);
                    date.setHours(0, 0, 0, 0);
                    const matches = date.getTime() === today.getTime();
                    console.log(`Comparing ${date.toISOString()} with ${today.toISOString()}: ${matches}`);
                    return matches;
                });

                console.log(`✅ Specific schedule applies to today: ${applies}`);

                if (applies) {
                    applicableSchedule = schedule;
                    break;
                }
                continue;
            }

            // For recurring schedules
            if (schedule.scheduleType === 'recurring') {
                // Check if schedule has started
                if (scheduleStartDate && today < scheduleStartDate) {
                    console.log(`❌ Schedule hasn't started yet (starts on ${scheduleStartDate.toISOString()})`);
                    continue;
                }

                // Check if schedule has ended
                if (schedule.endDate) {
                    const endDate = new Date(schedule.endDate);
                    endDate.setHours(23, 59, 59, 999);
                    if (today > endDate) {
                        console.log(`❌ Schedule has ended (ended on ${endDate.toISOString()})`);
                        continue;
                    }
                }

                // Check recurring pattern
                let applies = false;

                if (schedule.recurringPattern === 'daily') {
                    applies = true;
                    console.log('✅ Daily schedule - always applies');
                }
                else if (schedule.recurringPattern === 'weekly' && schedule.weekDays) {
                    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
                    applies = schedule.weekDays.includes(dayOfWeek);
                    console.log(`📅 Day of week: ${dayOfWeek}, Week days: ${schedule.weekDays}, Applies: ${applies}`);
                }
                else if (schedule.recurringPattern === 'monthly' && schedule.monthDays) {
                    const dayOfMonth = today.getDate(); // 1-31
                    applies = schedule.monthDays.includes(dayOfMonth);
                    console.log(`📅 Day of month: ${dayOfMonth}, Month days: ${schedule.monthDays}, Applies: ${applies}`);
                } else {
                    console.log(`❌ No valid recurring pattern or days specified`);
                }

                if (applies) {
                    console.log(`✅ Schedule applies to today`);
                    applicableSchedule = schedule;
                    break;
                } else {
                    console.log(`❌ Schedule does not apply to today`);
                }
            }
        }

        if (!applicableSchedule) {
            console.log('❌ No applicable schedule found for today');
            return res.json({
                success: true,
                hasDuty: false,
                message: 'No duty schedule assigned for today'
            });
        }

        console.log('✅ Found applicable schedule for today:', applicableSchedule._id);

        // Get office location
        let officeLocationData = null;
        if (applicableSchedule.officeLocation) {
            officeLocationData = applicableSchedule.officeLocation;
        } else if (applicableSchedule.officeLocationId && companyId) {
            const company = await Company.findById(companyId).select('attendanceSettings');
            if (company?.attendanceSettings?.officeLocations) {
                const location = company.attendanceSettings.officeLocations.find(
                    loc => loc._id.toString() === applicableSchedule.officeLocationId.toString()
                );
                if (location) {
                    officeLocationData = {
                        name: location.name,
                        coordinates: location.coordinates,
                        radius: location.radius,
                        address: location.address
                    };
                }
            }
        }

        return res.json({
            success: true,
            hasDuty: true,
            schedule: {
                _id: applicableSchedule._id,
                scheduleType: applicableSchedule.scheduleType,
                recurringPattern: applicableSchedule.recurringPattern,
                dutyHours: applicableSchedule.dutyHours,
                officeLocation: officeLocationData,
                notes: applicableSchedule.notes,
                startDate: applicableSchedule.startDate,
                endDate: applicableSchedule.endDate
            }
        });

    } catch (error) {
        console.error('❌ Error checking duty schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Server error checking duty schedule',
            error: error.message
        });
    }
});

module.exports = router;