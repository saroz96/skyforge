const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Attendance = require('../models/Attendance');
const Company = require('../models/Company');
const User = require('../models/User');
const { ensureAuthenticated, authorize } = require('../middleware/auth');
// const { authenticate, authorize } = require('../middleware/auth');

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// ==================== USER ROUTES ====================

router.post('/clock-in', async (req, res) => {
    try {
        const { location, companyId } = req.body;
        const userId = req.user._id;

        console.log('⏰ Clock-in request:', {
            userId,
            companyId,
            location: location ? {
                lat: location.lat,
                lng: location.lng,
                accuracy: location.accuracy
            } : 'No location'
        });

        if (!location || !location.lat || !location.lng) {
            return res.status(400).json({
                success: false,
                message: 'Location data is required'
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if already clocked in today
        const existingAttendance = await Attendance.findOne({
            user: userId,
            date: today,
            company: companyId
        });

        if (existingAttendance && existingAttendance.clockIn?.time) {
            return res.status(400).json({
                success: false,
                message: 'Already clocked in today'
            });
        }

        // Get company
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        console.log('🏢 Company attendance settings:', company.attendanceSettings);

        // Initialize attendance settings if not exists
        if (!company.attendanceSettings) {
            company.attendanceSettings = {
                geoFencingEnabled: true,
                officeLocations: [],
                workingHours: {
                    startTime: '09:00',
                    endTime: '17:00',
                    gracePeriod: 15
                }
            };
            await company.save();
            console.log('✅ Created new attendance settings');
        }

        // Check if geo-fencing is enabled
        if (!company.attendanceSettings.geoFencingEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Attendance geo-fencing is not enabled for this company'
            });
        }

        // Check if office locations exist
        const officeLocations = company.attendanceSettings.officeLocations || [];
        if (officeLocations.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No office locations configured'
            });
        }

        // ====== CHECK DUTY SCHEDULE ======
        console.log('📅 Checking duty schedule for user:', userId);
        const DutySchedule = require('../models/DutySchedule');
        const schedules = await DutySchedule.find({
            user: userId,
            company: companyId,
            isActive: true
        });

        console.log(`📋 Found ${schedules.length} active schedules for user`);

        const applicableSchedule = schedules.find(schedule =>
            schedule.appliesToDate(new Date())
        );

        if (!applicableSchedule) {
            console.log('❌ No duty schedule found for today');
            return res.status(400).json({
                success: false,
                message: 'No duty schedule assigned for today. Please contact your supervisor.',
                code: 'NO_DUTY_SCHEDULE'
            });
        }

        console.log('✅ Found applicable duty schedule:', {
            scheduleId: applicableSchedule._id,
            scheduleType: applicableSchedule.scheduleType,
            dutyHours: applicableSchedule.dutyHours,
            officeLocationId: applicableSchedule.officeLocationId
        });

        // Get duty hours from schedule
        const dutyHours = applicableSchedule.dutyHours;
        const startTimeStr = dutyHours.startTime || '09:00';
        const endTimeStr = dutyHours.endTime || '17:00';
        const gracePeriod = dutyHours.gracePeriod || 15;

        // ====== CHECK OFFICE LOCATION ======
        let nearestOffice = null;
        let minDistance = Infinity;
        let isAtCorrectOffice = false;

        // If schedule has specific office location, check that one first
        if (applicableSchedule.officeLocationId) {
            console.log('📍 Schedule has specific office location:', applicableSchedule.officeLocationId);

            const scheduledOffice = officeLocations.find(office =>
                office._id.toString() === applicableSchedule.officeLocationId.toString()
            );

            if (scheduledOffice && scheduledOffice.isActive) {
                const distance = calculateDistance(
                    location.lat,
                    location.lng,
                    scheduledOffice.coordinates.lat,
                    scheduledOffice.coordinates.lng
                );

                console.log(`📍 Distance to scheduled office "${scheduledOffice.name}": ${Math.round(distance)}m (radius: ${scheduledOffice.radius}m)`);

                if (distance <= scheduledOffice.radius) {
                    nearestOffice = scheduledOffice;
                    minDistance = distance;
                    isAtCorrectOffice = true;
                    console.log('✅ User is at scheduled office location');
                }
            }
        }

        // If not at scheduled office or no specific office, check all offices
        if (!isAtCorrectOffice) {
            console.log('📍 Checking all office locations...');
            for (const office of officeLocations) {
                if (!office.isActive) continue;

                const distance = calculateDistance(
                    location.lat,
                    location.lng,
                    office.coordinates.lat,
                    office.coordinates.lng
                );

                console.log(`📍 Distance to ${office.name}: ${Math.round(distance)}m (radius: ${office.radius}m)`);

                if (distance <= office.radius && distance < minDistance) {
                    minDistance = distance;
                    nearestOffice = office;
                }
            }

            if (!nearestOffice) {
                // Find the closest office even if not within radius
                let closestOffice = null;
                let closestDistance = Infinity;

                for (const office of officeLocations) {
                    if (!office.isActive) continue;

                    const distance = calculateDistance(
                        location.lat,
                        location.lng,
                        office.coordinates.lat,
                        office.coordinates.lng
                    );

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestOffice = office;
                    }
                }

                return res.status(400).json({
                    success: false,
                    message: 'You must be at an office location to clock in',
                    details: `Your current location is ${Math.round(closestDistance)}m away from ${closestOffice?.name || 'the nearest office'} (radius: ${closestOffice?.radius || 100}m)`
                });
            }
        }

        console.log('✅ User is at office:', nearestOffice.name, 'Distance:', Math.round(minDistance), 'm');

        // Check GPS accuracy
        if (location.accuracy && location.accuracy > 100) {
            console.warn('⚠️ GPS accuracy is low:', location.accuracy, 'meters');
            // Consider warning but don't block
        }

        // ====== CHECK DUTY TIMING ======
        const currentTime = new Date();
        let lateMinutes = 0;
        let status = 'present';

        console.log('🕒 Duty hours check:', {
            startTimeStr,
            endTimeStr,
            gracePeriod,
            currentTime: currentTime.toLocaleTimeString()
        });

        // Parse start time
        const [startHour, startMinute] = startTimeStr.split(':').map(num => parseInt(num) || 0);
        const startTime = new Date(today);
        startTime.setHours(startHour, startMinute, 0, 0);

        // // Check if too early to clock in (more than 30 minutes before duty)
        // const thirtyMinutesBefore = new Date(startTime.getTime() - 30 * 60000);
        // if (currentTime < thirtyMinutesBefore) {
        //     return res.status(400).json({
        //         success: false,
        //         message: `Too early to clock in. Your duty starts at ${startTimeStr}`,
        //         dutyStartTime: startTimeStr
        //     });
        // }

        const lateTime = new Date(startTime.getTime() + gracePeriod * 60000);

        console.log('🕒 Time calculation:', {
            currentTime: currentTime.toLocaleTimeString(),
            startTime: startTime.toLocaleTimeString(),
            lateTime: lateTime.toLocaleTimeString(),
            isLate: currentTime > lateTime
        });

        if (currentTime > lateTime) {
            lateMinutes = Math.round((currentTime - startTime) / 60000);
            console.log('⏰ User is late by:', lateMinutes, 'minutes');

            if (lateMinutes > 60) {
                status = 'half-day';
                console.log('📝 Marked as half-day due to excessive lateness');
            }
        }

        // ====== CREATE ATTENDANCE RECORD ======
        let attendance;
        if (existingAttendance) {
            attendance = existingAttendance;
        } else {
            attendance = new Attendance({
                user: userId,
                company: companyId,
                date: today,
                dutySchedule: applicableSchedule._id,
                scheduledDutyHours: {
                    startTime: startTimeStr,
                    endTime: endTimeStr,
                    gracePeriod: gracePeriod,
                    officeLocationId: applicableSchedule.officeLocationId || nearestOffice._id
                }
            });
        }

        attendance.clockIn = {
            time: currentTime,
            location: {
                lat: location.lat,
                lng: location.lng,
                accuracy: location.accuracy || 0
            },
            officeLocationId: nearestOffice._id
        };
        attendance.status = status;
        attendance.lateMinutes = lateMinutes;
        attendance.deviceInfo = {
            browser: req.headers['user-agent'],
            os: req.user.os || 'Unknown',
            ip: req.ip
        };
        attendance.source = 'geo-fence';

        if (applicableSchedule.officeLocationId &&
            applicableSchedule.officeLocationId.toString() !== nearestOffice._id.toString()) {
            attendance.notes = `Clocked in at ${nearestOffice.name} instead of scheduled office`;
        }

        await attendance.save();

        console.log('✅ Clock-in successful:', {
            userId,
            time: currentTime.toLocaleTimeString(),
            office: nearestOffice.name,
            dutyStart: startTimeStr,
            status,
            lateMinutes,
            scheduleId: applicableSchedule._id
        });

        res.status(200).json({
            success: true,
            message: 'Clocked in successfully',
            data: {
                time: currentTime,
                location: nearestOffice.name,
                dutyHours: {
                    startTime: startTimeStr,
                    endTime: endTimeStr
                },
                lateMinutes: lateMinutes,
                status: status,
                officeLocation: {
                    name: nearestOffice.name,
                    coordinates: nearestOffice.coordinates
                },
                hasDutySchedule: true,
                dutyScheduleId: applicableSchedule._id
            }
        });

    } catch (error) {
        console.error('❌ Clock in error:', {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).json({
            success: false,
            message: 'Server error during clock-in',
            error: error.message
        });
    }
});

// Clock Out
router.post('/clock-out', async (req, res) => {
    try {
        const { location, companyId } = req.body;
        const userId = req.user._id;

        console.log('⏰ Clock-out request:', {
            userId,
            companyId,
            location: location ? {
                lat: location.lat,
                lng: location.lng,
                accuracy: location.accuracy
            } : 'No location'
        });

        if (!location || !location.lat || !location.lng) {
            return res.status(400).json({
                success: false,
                message: 'Location data is required'
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find today's attendance
        const attendance = await Attendance.findOne({
            user: userId,
            date: today,
            company: companyId,
            'clockIn.time': { $exists: true },
            'clockOut.time': { $exists: false }
        });

        if (!attendance) {
            return res.status(400).json({
                success: false,
                message: 'No active attendance found. Please clock in first or you may have already clocked out.'
            });
        }

        console.log('✅ Found attendance record:', {
            attendanceId: attendance._id,
            clockInTime: attendance.clockIn.time,
            hasClockOut: !!attendance.clockOut?.time
        });

        // Get company
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        console.log('🏢 Company attendance settings:', {
            hasAttendanceSettings: !!company.attendanceSettings,
            geoFencingEnabled: company.attendanceSettings?.geoFencingEnabled,
            officeLocationsCount: company.attendanceSettings?.officeLocations?.length || 0,
            workingHours: company.attendanceSettings?.workingHours
        });

        // Check location if geo-fencing is enabled
        let officeLocationId = attendance.clockIn.officeLocationId;
        let isAtOffice = true; // Default to true if geo-fencing is disabled

        if (company.attendanceSettings?.geoFencingEnabled) {
            isAtOffice = false;
            const officeLocations = company.attendanceSettings.officeLocations || [];

            for (const office of officeLocations) {
                if (!office.isActive) continue;

                const distance = calculateDistance(
                    location.lat,
                    location.lng,
                    office.coordinates.lat,
                    office.coordinates.lng
                );

                console.log(`📍 Distance to ${office.name}: ${Math.round(distance)}m (radius: ${office.radius}m)`);

                if (distance <= office.radius) {
                    isAtOffice = true;
                    officeLocationId = office._id;
                    console.log(`✅ User is at office: ${office.name}`);
                    break;
                }
            }

            if (!isAtOffice) {
                return res.status(400).json({
                    success: false,
                    message: 'You must be at an office location to clock out'
                });
            }
        }

        const clockOutTime = new Date();
        const clockInTime = attendance.clockIn.time;

        // Calculate total hours
        const totalMs = clockOutTime - clockInTime;
        const totalHours = totalMs / (1000 * 60 * 60);

        console.log('⏱️ Time calculations:', {
            clockInTime: clockInTime.toLocaleTimeString(),
            clockOutTime: clockOutTime.toLocaleTimeString(),
            totalMs: totalMs,
            totalHours: totalHours.toFixed(2)
        });

        // Calculate early departure and overtime
        let earlyDepartureMinutes = 0;
        let overtime = 0;

        // Safely get working hours with defaults
        const workingHours = company.attendanceSettings?.workingHours || {};
        const endTimeStr = workingHours.endTime || '17:00'; // Default to 5 PM
        const gracePeriod = workingHours.gracePeriod || 15;

        console.log('📅 Working hours check:', {
            workingHoursExists: !!company.attendanceSettings?.workingHours,
            endTimeStr,
            gracePeriod
        });

        // Only calculate if we have a valid end time string
        if (endTimeStr && typeof endTimeStr === 'string' && endTimeStr.includes(':')) {
            try {
                const [endHour, endMinute] = endTimeStr.split(':').map(num => parseInt(num) || 0);
                const endTime = new Date(today);
                endTime.setHours(endHour, endMinute, 0, 0);

                console.log('🕒 End time calculation:', {
                    endTimeStr,
                    parsedEndHour: endHour,
                    parsedEndMinute: endMinute,
                    calculatedEndTime: endTime.toLocaleTimeString(),
                    clockOutTime: clockOutTime.toLocaleTimeString(),
                    isEarly: clockOutTime < endTime,
                    isLate: clockOutTime > endTime
                });

                if (clockOutTime < endTime) {
                    earlyDepartureMinutes = Math.round((endTime - clockOutTime) / 60000);
                    console.log(`⚠️ Early departure: ${earlyDepartureMinutes} minutes`);

                    if (earlyDepartureMinutes > 60) {
                        attendance.status = 'half-day';
                        console.log('📝 Marked as half-day due to early departure > 60 minutes');
                    }
                } else if (clockOutTime > endTime) {
                    overtime = (clockOutTime - endTime) / (1000 * 60 * 60);
                    console.log(`⭐ Overtime: ${overtime.toFixed(2)} hours`);
                }
            } catch (timeError) {
                console.error('❌ Error parsing end time:', timeError);
                // Continue without overtime/early departure calculations
            }
        } else {
            console.log('ℹ️ No valid end time configured, skipping overtime calculations');
        }

        // Update attendance
        attendance.clockOut = {
            time: clockOutTime,
            location: {
                lat: location.lat,
                lng: location.lng,
                accuracy: location.accuracy || 0
            },
            officeLocationId: officeLocationId
        };
        attendance.totalHours = parseFloat(totalHours.toFixed(2));
        attendance.earlyDepartureMinutes = earlyDepartureMinutes;
        attendance.overtime = parseFloat(overtime.toFixed(2));

        // Update status based on hours worked (only if not already set)
        if (!attendance.status || attendance.status === 'absent') {
            if (totalHours < 4) {
                attendance.status = 'half-day';
                console.log('📝 Status updated to half-day (worked < 4 hours)');
            } else if (totalHours >= 8) {
                attendance.status = 'present';
                console.log('📝 Status updated to present (worked ≥ 8 hours)');
            } else {
                attendance.status = 'present'; // Default to present for 4-8 hours
                console.log('📝 Status set to present (worked 4-8 hours)');
            }
        }

        // Update device info
        attendance.deviceInfo = {
            browser: req.headers['user-agent'],
            os: req.user.os || 'Unknown',
            ip: req.ip
        };

        await attendance.save();

        console.log('✅ Clock-out saved successfully:', {
            userId,
            attendanceId: attendance._id,
            totalHours: attendance.totalHours,
            overtime: attendance.overtime,
            status: attendance.status,
            earlyDepartureMinutes: attendance.earlyDepartureMinutes
        });

        // Fetch the updated attendance
        const updatedAttendance = await Attendance.findById(attendance._id);

        res.status(200).json({
            success: true,
            message: 'Clocked out successfully',
            data: {
                time: clockOutTime,
                totalHours: updatedAttendance.totalHours,
                overtime: updatedAttendance.overtime,
                status: updatedAttendance.status,
                earlyDepartureMinutes: updatedAttendance.earlyDepartureMinutes,
                hasClockedIn: true,
                hasClockedOut: true,
                clockIn: updatedAttendance.clockIn.time,
                clockOut: updatedAttendance.clockOut.time
            }
        });

    } catch (error) {
        console.error('❌ Clock out error:', {
            message: error.message,
            stack: error.stack,
            body: req.body,
            line: error.stack?.split('\n')[1] // Get the line where error occurred
        });
        res.status(500).json({
            success: false,
            message: 'Server error during clock-out',
            error: error.message
        });
    }
});

// Get company data with attendance settings
router.get('/company-data', ensureAuthenticated, async (req, res) => {
    try {
        console.log('Fetching company data with attendance settings:', {
            userId: req.user._id,
            sessionCompany: req.session.currentCompany
        });

        if (!req.session.currentCompany) {
            return res.status(400).json({
                success: false,
                message: 'No company selected. Please select a company first.'
            });
        }

        const companyId = req.session.currentCompany;

        // Get company with ALL attendance settings
        const company = await Company.findById(companyId)
            .select('name attendanceSettings')
            .lean();

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        console.log('Company data fetched:', {
            companyId: company._id,
            companyName: company.name,
            hasAttendanceSettings: !!company.attendanceSettings,
            officeLocationsCount: company.attendanceSettings?.officeLocations?.length || 0,
            geoFencingEnabled: company.attendanceSettings?.geoFencingEnabled || false
        });

        res.status(200).json({
            success: true,
            data: {
                _id: company._id,
                name: company.name,
                attendanceSettings: company.attendanceSettings || {
                    geoFencingEnabled: false,
                    officeLocations: [],
                    workingHours: {
                        startTime: '09:00',
                        endTime: '17:00',
                        gracePeriod: 15
                    }
                }
            }
        });

    } catch (error) {
        console.error('Get company data error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get My Attendance
router.get('/my-attendance', async (req, res) => {
    try {
        const userId = req.user._id;
        const { month, year, page = 1, limit = 30, companyId } = req.query;

        let query = { user: userId };

        if (companyId) {
            query.company = companyId;
        }

        // Filter by month and year if provided
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query.date = { $gte: startDate, $lte: endDate };
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        const [attendance, total] = await Promise.all([
            Attendance.find(query)
                .populate('company', 'name')
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Attendance.countDocuments(query)
        ]);

        // Calculate statistics
        const presentCount = await Attendance.countDocuments({
            ...query,
            status: 'present'
        });
        const absentCount = await Attendance.countDocuments({
            ...query,
            status: 'absent'
        });
        const halfDayCount = await Attendance.countDocuments({
            ...query,
            status: 'half-day'
        });

        res.status(200).json({
            success: true,
            data: {
                attendance,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                },
                statistics: {
                    present: presentCount,
                    absent: absentCount,
                    halfDay: halfDayCount,
                    total: total
                }
            }
        });

    } catch (error) {
        console.error('Get my attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// // Get Today's Status
// router.get('/today-status', async (req, res) => {
//     try {
//         const userId = req.user._id;
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);

//         // Find all companies the user belongs to
//         const user = await User.findById(userId);
//         const companies = user.companies || [];

//         // Get attendance for each company
//         const attendancePromises = companies.map(companyId =>
//             Attendance.findOne({
//                 user: userId,
//                 date: today,
//                 company: companyId
//             }).populate('company', 'name attendanceSettings')
//         );

//         const attendanceRecords = await Promise.all(attendancePromises);

//         // Get company details for companies without attendance
//         const companiesWithoutAttendance = [];
//         for (const companyId of companies) {
//             const hasAttendance = attendanceRecords.some(record =>
//                 record && record.company && record.company._id.toString() === companyId.toString()
//             );

//             if (!hasAttendance) {
//                 const company = await Company.findById(companyId).select('name attendanceSettings');
//                 if (company) {
//                     companiesWithoutAttendance.push({
//                         company,
//                         attendance: null
//                     });
//                 }
//             }
//         }

//         // Format response
//         const response = attendanceRecords
//             .filter(record => record !== null)
//             .map(record => ({
//                 company: record.company,
//                 hasClockedIn: !!record.clockIn.time,
//                 hasClockedOut: !!record.clockOut.time,
//                 clockIn: record.clockIn.time,
//                 clockOut: record.clockOut.time,
//                 totalHours: record.totalHours,
//                 status: record.status,
//                 lateMinutes: record.lateMinutes,
//                 overtime: record.overtime
//             }));

//         // Add companies without attendance
//         companiesWithoutAttendance.forEach(item => {
//             response.push({
//                 company: item.company,
//                 hasClockedIn: false,
//                 hasClockedOut: false,
//                 status: 'absent'
//             });
//         });

//         res.status(200).json({
//             success: true,
//             data: response
//         });

//     } catch (error) {
//         console.error('Get today status error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });

// Update your /today-status endpoint to check both possibilities
router.get('/today-status', async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log('📅 Fetching today status for user:', userId, 'Date:', today);

        // Find user with ALL company fields
        const user = await User.findById(userId).select('companies company');

        console.log('👤 User data:', {
            userId: user._id,
            companiesField: user.companies,
            companyField: user.company,
            hasCompanies: user.companies && user.companies.length > 0,
            hasCompany: user.company && (Array.isArray(user.company) ? user.company.length > 0 : !!user.company)
        });

        // Get companies from different possible fields
        let companies = [];

        // Check if user has companies array
        if (user.companies && Array.isArray(user.companies)) {
            companies = user.companies;
        }
        // Check if user has company field (could be array or single)
        else if (user.company) {
            if (Array.isArray(user.company)) {
                companies = user.company;
            } else {
                companies = [user.company];
            }
        }

        console.log('🏢 Final companies array:', companies);

        // If still no companies, return current company from session
        if (companies.length === 0 && req.session.currentCompany) {
            console.log('🔄 Using session company:', req.session.currentCompany);
            companies = [req.session.currentCompany];
        }

        // Get attendance for each company
        const attendancePromises = companies.map(companyId =>
            Attendance.findOne({
                user: userId,
                date: today,
                company: companyId
            }).populate('company', 'name attendanceSettings')
        );

        const attendanceRecords = await Promise.all(attendancePromises);

        // Format response
        const response = [];

        // Add records with attendance
        attendanceRecords.forEach((record, index) => {
            if (record) {
                response.push({
                    company: record.company,
                    hasClockedIn: !!record.clockIn?.time,
                    hasClockedOut: !!record.clockOut?.time,
                    clockIn: record.clockIn?.time || null,
                    clockOut: record.clockOut?.time || null,
                    totalHours: record.totalHours || 0,
                    status: record.status || 'absent',
                    lateMinutes: record.lateMinutes || 0,
                    overtime: record.overtime || 0
                });
            } else if (companies[index]) {
                // Add company without attendance record
                response.push({
                    company: companies[index], // This might be just ID
                    hasClockedIn: false,
                    hasClockedOut: false,
                    clockIn: null,
                    clockOut: null,
                    totalHours: 0,
                    status: 'absent',
                    lateMinutes: 0,
                    overtime: 0
                });
            }
        });

        // Populate company details for responses that only have IDs
        for (let i = 0; i < response.length; i++) {
            if (typeof response[i].company === 'string' || mongoose.Types.ObjectId.isValid(response[i].company)) {
                const company = await Company.findById(response[i].company).select('name attendanceSettings');
                if (company) {
                    response[i].company = company;
                }
            }
        }

        console.log('📦 Final response:', response.map(r => ({
            companyName: r.company?.name || 'Unknown',
            hasClockedIn: r.hasClockedIn,
            hasClockedOut: r.hasClockedOut
        })));

        res.status(200).json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('❌ Get today status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// ==================== ADMIN ROUTES ====================


router.get('/company/:companyId', ensureAuthenticated, authorize('admin'), async (req, res) => {
    try {
        // Get companyId from params
        let companyId = req.params.companyId;

        console.log('Company attendance request:', {
            paramsCompanyId: req.params.companyId,
            finalCompanyId: companyId,
            userId: req.user._id,
            userName: req.user.name
        });

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required. Please select a company first.'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID'
            });
        }

        // Get user info
        const user = await User.findById(req.user._id).select('company role isAdmin name email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('User access check:', {
            userId: user._id,
            userName: user.name,
            userRole: user.role,
            userIsAdmin: user.isAdmin,
            userCompanies: user.company,
            userCompaniesLength: user.company?.length || 0,
            requestedCompanyId: companyId
        });

        // Convert to lowercase for case-insensitive comparison
        const userRoleLower = user.role?.toLowerCase();

        // Check if user is super admin (case-insensitive)
        const isSuperAdmin = userRoleLower === 'admin' ||
            userRoleLower === 'administrator' ||
            userRoleLower === 'supervisor' ||
            user.isAdmin === true;

        console.log('Super admin check:', {
            isSuperAdmin,
            userRoleLower,
            userIsAdmin: user.isAdmin
        });

        if (isSuperAdmin) {
            console.log('✅ Super admin access granted for:', user.name);
            // Super admins get access regardless of company assignment
        } else {
            // For non-admin users, check company access
            console.log('Checking company access for non-admin user');

            if (!user.company || !Array.isArray(user.company) || user.company.length === 0) {
                console.log('❌ User has no companies assigned');
                return res.status(403).json({
                    success: false,
                    message: 'Your account is not assigned to any company. Please contact your administrator.'
                });
            }

            // Check if user has access to this specific company
            const companyIdStr = companyId.toString();
            const hasCompanyAccess = user.company.some(compId =>
                compId && compId.toString() === companyIdStr
            );

            console.log('Company access result:', {
                hasCompanyAccess,
                userCompanies: user.company.map(c => c.toString()),
                requestedCompany: companyIdStr
            });

            if (!hasCompanyAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to this company. You do not have permission to view this company\'s attendance.'
                });
            }
        }

        let query = { company: companyId };

        // Get query parameters
        const { startDate, endDate, userId, status, page, limit } = req.query;

        // Date range filter
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            // Validate dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format'
                });
            }

            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        } else {
            // Default to current month
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            query.date = { $gte: firstDay, $lte: lastDay };
        }

        // User filter
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID'
                });
            }
            query.user = userId;
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        // Calculate pagination
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const skip = (pageNum - 1) * limitNum;

        console.log('Fetching attendance data with query:', {
            companyId,
            query,
            page: pageNum,
            limit: limitNum
        });

        const [attendance, total, users] = await Promise.all([
            Attendance.find(query)
                .populate('user', 'name email phone role')
                .populate('company', 'name')
                .sort({ date: -1, 'clockIn.time': -1 })
                .skip(skip)
                .limit(limitNum),
            Attendance.countDocuments(query),
            User.find({ company: companyId }).select('name email phone role').sort('name')
        ]);

        // Calculate summary statistics
        const summary = await Attendance.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgHours: { $avg: '$totalHours' }
                }
            }
        ]);

        console.log('Attendance data fetched:', {
            totalRecords: total,
            attendanceCount: attendance.length,
            usersCount: users.length
        });

        res.status(200).json({
            success: true,
            data: {
                attendance,
                users,
                summary,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
                }
            }
        });

    } catch (error) {
        console.error('Get company attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Adjust Attendance (Admin)
router.put('/adjust/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { clockIn, clockOut, status, notes } = req.body;

        const attendance = await Attendance.findById(id);
        if (!attendance) {
            return res.status(404).json({
                message: 'Attendance record not found'
            });
        }

        // Verify admin has access to this company
        const user = await User.findById(req.user._id);
        if (!user.companies.includes(attendance.company.toString())) {
            return res.status(403).json({
                message: 'Access denied to adjust this attendance'
            });
        }

        // Update attendance
        const updates = {};

        if (clockIn) {
            updates['clockIn.time'] = new Date(clockIn.time);
            if (clockIn.location) {
                updates['clockIn.location'] = clockIn.location;
            }
        }

        if (clockOut) {
            updates['clockOut.time'] = new Date(clockOut.time);
            if (clockOut.location) {
                updates['clockOut.location'] = clockOut.location;
            }
        }

        if (status) {
            updates.status = status;
        }

        // Recalculate total hours if both times are present
        if (clockIn || clockOut) {
            const clockInTime = clockIn ? new Date(clockIn.time) : attendance.clockIn.time;
            const clockOutTime = clockOut ? new Date(clockOut.time) : attendance.clockOut.time;

            if (clockInTime && clockOutTime) {
                const totalMs = clockOutTime - clockInTime;
                const totalHours = totalMs / (1000 * 60 * 60);
                updates.totalHours = parseFloat(totalHours.toFixed(2));
            }
        }

        updates.adjustedBy = req.user._id;
        updates.adjustedAt = new Date();
        if (notes) {
            updates.notes = notes;
        }
        updates.source = 'admin-adjusted';

        const updatedAttendance = await Attendance.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('user', 'name email').populate('adjustedBy', 'name');

        res.status(200).json({
            success: true,
            message: 'Attendance adjusted successfully',
            data: updatedAttendance
        });

    } catch (error) {
        console.error('Adjust attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get Reports
// router.get('/reports', async (req, res) => {
//     try {
//         const { companyId, startDate, endDate, reportType = 'daily' } = req.query;

//         if (!companyId) {
//             return res.status(400).json({
//                 message: 'Company ID is required'
//             });
//         }

//         // Verify admin has access to this company
//         const user = await User.findById(req.user._id);
//         if (!user.companies.includes(companyId)) {
//             return res.status(403).json({
//                 message: 'Access denied to this company'
//             });
//         }

//         const start = new Date(startDate || new Date().setMonth(new Date().getMonth() - 1));
//         const end = new Date(endDate || new Date());
//         start.setHours(0, 0, 0, 0);
//         end.setHours(23, 59, 59, 999);

//         let reportData;

//         switch (reportType) {
//             case 'daily':
//                 reportData = await Attendance.aggregate([
//                     {
//                         $match: {
//                             company: require('mongoose').Types.ObjectId(companyId),
//                             date: { $gte: start, $lte: end }
//                         }
//                     },
//                     {
//                         $group: {
//                             _id: {
//                                 date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
//                                 status: '$status'
//                             },
//                             count: { $sum: 1 },
//                             avgHours: { $avg: '$totalHours' },
//                             totalHours: { $sum: '$totalHours' },
//                             users: { $addToSet: '$user' }
//                         }
//                     },
//                     {
//                         $group: {
//                             _id: '$_id.date',
//                             statuses: {
//                                 $push: {
//                                     status: '$_id.status',
//                                     count: '$count',
//                                     avgHours: '$avgHours'
//                                 }
//                             },
//                             totalUsers: { $sum: { $size: '$users' } },
//                             totalHours: { $sum: '$totalHours' }
//                         }
//                     },
//                     { $sort: { _id: -1 } }
//                 ]);
//                 break;

//             case 'user':
//                 reportData = await Attendance.aggregate([
//                     {
//                         $match: {
//                             company: require('mongoose').Types.ObjectId(companyId),
//                             date: { $gte: start, $lte: end }
//                         }
//                     },
//                     {
//                         $lookup: {
//                             from: 'users',
//                             localField: 'user',
//                             foreignField: '_id',
//                             as: 'userDetails'
//                         }
//                     },
//                     { $unwind: '$userDetails' },
//                     {
//                         $group: {
//                             _id: '$user',
//                             name: { $first: '$userDetails.name' },
//                             email: { $first: '$userDetails.email' },
//                             present: {
//                                 $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
//                             },
//                             absent: {
//                                 $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
//                             },
//                             halfDay: {
//                                 $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] }
//                             },
//                             leave: {
//                                 $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] }
//                             },
//                             totalDays: { $sum: 1 },
//                             avgHours: { $avg: '$totalHours' },
//                             totalHours: { $sum: '$totalHours' },
//                             totalLateMinutes: { $sum: '$lateMinutes' },
//                             totalOvertime: { $sum: '$overtime' }
//                         }
//                     },
//                     { $sort: { name: 1 } }
//                 ]);
//                 break;

//             case 'summary':
//                 reportData = await Attendance.aggregate([
//                     {
//                         $match: {
//                             company: require('mongoose').Types.ObjectId(companyId),
//                             date: { $gte: start, $lte: end }
//                         }
//                     },
//                     {
//                         $group: {
//                             _id: null,
//                             totalRecords: { $sum: 1 },
//                             present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
//                             absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
//                             halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
//                             leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
//                             avgHours: { $avg: '$totalHours' },
//                             totalHours: { $sum: '$totalHours' },
//                             avgLate: { $avg: '$lateMinutes' },
//                             totalOvertime: { $sum: '$overtime' },
//                             uniqueUsers: { $addToSet: '$user' }
//                         }
//                     },
//                     {
//                         $project: {
//                             _id: 0,
//                             totalRecords: 1,
//                             present: 1,
//                             absent: 1,
//                             halfDay: 1,
//                             leave: 1,
//                             avgHours: { $round: ['$avgHours', 2] },
//                             totalHours: { $round: ['$totalHours', 2] },
//                             avgLate: { $round: ['$avgLate', 2] },
//                             totalOvertime: { $round: ['$totalOvertime', 2] },
//                             totalUsers: { $size: '$uniqueUsers' }
//                         }
//                     }
//                 ]);
//                 break;

//             default:
//                 return res.status(400).json({
//                     message: 'Invalid report type'
//                 });
//         }

//         // Get company info
//         const company = await Company.findById(companyId).select('name address');

//         res.status(200).json({
//             success: true,
//             data: {
//                 company,
//                 reportType,
//                 dateRange: { start, end },
//                 report: reportData[0] || reportData
//             }
//         });

//     } catch (error) {
//         console.error('Get reports error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });
router.get('/reports', async (req, res) => {
    try {
        const { companyId, startDate, endDate, reportType = 'daily' } = req.query;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        // Validate companyId
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID'
            });
        }

        // Verify admin has access to this company
        const user = await User.findById(req.user._id).select('company role isAdmin');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has access to the company
        const hasAccess = user.company &&
            Array.isArray(user.company) &&
            user.company.includes(companyId);

        // Also allow access if user is Admin or ADMINISTRATOR
        const isSuperAdmin = user.role === 'Admin' || user.role === 'ADMINISTRATOR' || user.isAdmin;

        if (!hasAccess && !isSuperAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this company'
            });
        }

        const start = new Date(startDate || new Date().setMonth(new Date().getMonth() - 1));
        const end = new Date(endDate || new Date());

        // Validate dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        let reportData;

        switch (reportType) {
            case 'daily':
                reportData = await Attendance.aggregate([
                    {
                        $match: {
                            company: new mongoose.Types.ObjectId(companyId),
                            date: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                                status: '$status'
                            },
                            count: { $sum: 1 },
                            avgHours: { $avg: '$totalHours' },
                            totalHours: { $sum: '$totalHours' },
                            users: { $addToSet: '$user' }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.date',
                            statuses: {
                                $push: {
                                    status: '$_id.status',
                                    count: '$count',
                                    avgHours: '$avgHours'
                                }
                            },
                            totalUsers: { $sum: { $size: '$users' } },
                            totalHours: { $sum: '$totalHours' }
                        }
                    },
                    { $sort: { _id: -1 } }
                ]);
                break;

            case 'user':
                reportData = await Attendance.aggregate([
                    {
                        $match: {
                            company: mongoose.Types.ObjectId(companyId),
                            date: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'user',
                            foreignField: '_id',
                            as: 'userDetails'
                        }
                    },
                    { $unwind: '$userDetails' },
                    {
                        $group: {
                            _id: '$user',
                            name: { $first: '$userDetails.name' },
                            email: { $first: '$userDetails.email' },
                            role: { $first: '$userDetails.role' },
                            present: {
                                $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                            },
                            absent: {
                                $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
                            },
                            halfDay: {
                                $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] }
                            },
                            leave: {
                                $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] }
                            },
                            totalDays: { $sum: 1 },
                            avgHours: { $avg: '$totalHours' },
                            totalHours: { $sum: '$totalHours' },
                            totalLateMinutes: { $sum: '$lateMinutes' },
                            totalOvertime: { $sum: '$overtime' }
                        }
                    },
                    { $sort: { name: 1 } }
                ]);
                break;

            case 'summary':
                reportData = await Attendance.aggregate([
                    {
                        $match: {
                            company: new mongoose.Types.ObjectId(companyId),
                            date: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRecords: { $sum: 1 },
                            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
                            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
                            halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
                            leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
                            avgHours: { $avg: '$totalHours' },
                            totalHours: { $sum: '$totalHours' },
                            avgLate: { $avg: '$lateMinutes' },
                            totalOvertime: { $sum: '$overtime' },
                            uniqueUsers: { $addToSet: '$user' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalRecords: 1,
                            present: 1,
                            absent: 1,
                            halfDay: 1,
                            leave: 1,
                            avgHours: { $round: ['$avgHours', 2] },
                            totalHours: { $round: ['$totalHours', 2] },
                            avgLate: { $round: ['$avgLate', 2] },
                            totalOvertime: { $round: ['$totalOvertime', 2] },
                            totalUsers: { $size: '$uniqueUsers' }
                        }
                    }
                ]);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type'
                });
        }

        // Get company info
        const company = await Company.findById(companyId).select('name address');

        // Format dates for response
        const formattedStart = start.toISOString().split('T')[0];
        const formattedEnd = end.toISOString().split('T')[0];

        res.status(200).json({
            success: true,
            data: {
                company,
                reportType,
                dateRange: {
                    start: formattedStart,
                    end: formattedEnd,
                    startDate: start,
                    endDate: end
                },
                report: reportData
            }
        });

    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Bulk Update Attendance
router.post('/bulk-update', async (req, res) => {
    try {
        const { companyId, updates } = req.body;

        if (!companyId || !updates || !Array.isArray(updates)) {
            return res.status(400).json({
                message: 'Company ID and updates array are required'
            });
        }

        // Verify admin has access to this company
        const user = await User.findById(req.user._id);
        if (!user.companies.includes(companyId)) {
            return res.status(403).json({
                message: 'Access denied to this company'
            });
        }

        const results = {
            success: [],
            failed: []
        };

        // Process each update
        for (const update of updates) {
            try {
                const { userId, date, status, notes } = update;

                if (!userId || !date || !status) {
                    results.failed.push({
                        ...update,
                        error: 'Missing required fields'
                    });
                    continue;
                }

                // Check if user belongs to company
                const userToUpdate = await User.findOne({
                    _id: userId,
                    companies: companyId
                });

                if (!userToUpdate) {
                    results.failed.push({
                        ...update,
                        error: 'User not found or not in company'
                    });
                    continue;
                }

                const attendanceDate = new Date(date);
                attendanceDate.setHours(0, 0, 0, 0);

                // Find or create attendance record
                let attendance = await Attendance.findOne({
                    user: userId,
                    company: companyId,
                    date: attendanceDate
                });

                if (attendance) {
                    // Update existing
                    attendance.status = status;
                    attendance.adjustedBy = req.user._id;
                    attendance.adjustedAt = new Date();
                    if (notes) attendance.notes = notes;
                    attendance.source = 'admin-bulk-update';
                } else {
                    // Create new
                    attendance = new Attendance({
                        user: userId,
                        company: companyId,
                        date: attendanceDate,
                        status: status,
                        adjustedBy: req.user._id,
                        adjustedAt: new Date(),
                        notes: notes,
                        source: 'admin-bulk-update'
                    });
                }

                await attendance.save();
                results.success.push({
                    userId,
                    date: attendanceDate,
                    status,
                    attendanceId: attendance._id
                });

            } catch (error) {
                results.failed.push({
                    ...update,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Bulk update completed',
            data: {
                total: updates.length,
                success: results.success.length,
                failed: results.failed.length,
                results: results
            }
        });

    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// ==================== OFFICE LOCATION MANAGEMENT ====================

// Get office locations for a company
router.get('/office-locations', ensureAuthenticated, async (req, res) => {
    try {
        const { companyId } = req.query;

        console.log('Fetching office locations for company:', {
            companyId,
            userId: req.user._id
        });

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid company ID'
            });
        }

        // Get user info
        const user = await User.findById(req.user._id).select('company role isAdmin name email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has access (admin or company member)
        const isAdmin = user.isAdmin || user.role === 'Admin' || user.role === 'ADMINISTRATOR' || user.role === 'Supervisor';

        let hasAccess = false;

        if (isAdmin) {
            hasAccess = true;
        } else {
            // Check if user belongs to this company
            const company = await Company.findById(companyId);
            if (company && company.users) {
                hasAccess = company.users.some(userId =>
                    userId && userId.toString() === req.user._id.toString()
                );
            }
        }

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this company'
            });
        }

        // Find company and get office locations
        const company = await Company.findById(companyId)
            .select('name attendanceSettings');

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Get office locations from attendance settings
        const officeLocations = company.attendanceSettings?.officeLocations || [];

        console.log('Found office locations:', {
            companyId: company._id,
            companyName: company.name,
            locationsCount: officeLocations.length
        });

        res.status(200).json({
            success: true,
            data: {
                company: {
                    _id: company._id,
                    name: company.name,
                    attendanceSettings: company.attendanceSettings
                },
                officeLocations,
                geoFencingEnabled: company.attendanceSettings?.geoFencingEnabled || false
            }
        });

    } catch (error) {
        console.error('Get office locations error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Get specific office location
router.get('/office-location/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId } = req.query;

        if (!companyId || !id) {
            return res.status(400).json({
                success: false,
                message: 'Company ID and location ID are required'
            });
        }

        // Check access (same as above)
        const user = await User.findById(req.user._id);
        const isAdmin = user.isAdmin || user.role === 'Admin' || user.role === 'ADMINISTRATOR' || user.role === 'Supervisor';

        let hasAccess = false;

        if (isAdmin) {
            hasAccess = true;
        } else {
            const company = await Company.findById(companyId);
            if (company && company.users) {
                hasAccess = company.users.some(userId =>
                    userId.toString() === req.user._id.toString()
                );
            }
        }

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this company'
            });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Find the specific location
        const location = company.attendanceSettings?.officeLocations?.find(
            loc => loc._id.toString() === id
        );

        if (!location) {
            return res.status(404).json({
                success: false,
                message: 'Office location not found'
            });
        }

        res.status(200).json({
            success: true,
            data: location
        });

    } catch (error) {
        console.error('Get office location error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Toggle geo-fencing for company
router.put('/geo-fencing', ensureAuthenticated, async (req, res) => {
    try {
        const { companyId, enabled } = req.body;

        if (!companyId || typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Company ID and enabled status are required'
            });
        }

        // Check admin access
        const user = await User.findById(req.user._id);
        const isAdmin = user.isAdmin || user.role === 'Admin' || user.role === 'ADMINISTRATOR' || user.role === 'Supervisor';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can change geo-fencing settings'
            });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Initialize attendanceSettings if not exists
        if (!company.attendanceSettings) {
            company.attendanceSettings = {
                geoFencingEnabled: false,
                officeLocations: [],
                workingHours: {
                    startTime: '09:00',
                    endTime: '17:00',
                    gracePeriod: 15
                }
            };
        }

        // Update geo-fencing status
        company.attendanceSettings.geoFencingEnabled = enabled;

        await company.save();

        res.status(200).json({
            success: true,
            message: `Geo-fencing ${enabled ? 'enabled' : 'disabled'} successfully`,
            data: {
                geoFencingEnabled: enabled,
                officeLocationsCount: company.attendanceSettings.officeLocations?.length || 0
            }
        });

    } catch (error) {
        console.error('Update geo-fencing error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

router.post('/office-location', async (req, res) => {
    try {
        const { companyId, name, coordinates, radius, address } = req.body;

        if (!companyId || !name || !coordinates || !coordinates.lat || !coordinates.lng) {
            return res.status(400).json({
                success: false, // Add this
                message: 'Company ID, name, and coordinates are required'
            });
        }

        // Verify admin has access to this company
        const user = await User.findById(req.user._id);

        // Check if user is admin or has access to company
        const isAdmin = user.isAdmin || user.role === 'Admin' || user.role === 'ADMINISTRATOR';

        // Check company access - handle both singular and plural
        let hasCompanyAccess = false;

        if (isAdmin) {
            hasCompanyAccess = true; // Admins have access to all companies
        } else if (user.company) {
            // If user has company field (could be array or single value)
            if (Array.isArray(user.company)) {
                hasCompanyAccess = user.company.some(comp =>
                    comp && comp.toString() === companyId.toString()
                );
            } else {
                hasCompanyAccess = user.company.toString() === companyId.toString();
            }
        } else if (user.companies && Array.isArray(user.companies)) {
            hasCompanyAccess = user.companies.includes(companyId);
        }

        if (!hasCompanyAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this company'
            });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Initialize attendanceSettings if not exists
        if (!company.attendanceSettings) {
            company.attendanceSettings = {
                geoFencingEnabled: false,
                officeLocations: [],
                workingHours: {
                    startTime: '09:00',
                    endTime: '17:00',
                    gracePeriod: 15
                }
            };
        }

        // Generate ID for new location
        const locationId = new mongoose.Types.ObjectId();

        // Add new location
        const newLocation = {
            _id: locationId,
            name,
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            radius: radius || 100,
            address: address || '',
            isActive: true
        };

        company.attendanceSettings.officeLocations.push(newLocation);
        if (company.attendanceSettings.officeLocations.length === 1) {
            company.attendanceSettings.geoFencingEnabled = true;
            console.log('✅ Auto-enabled geo-fencing for company:', companyId);
        }
        await company.save();

        res.status(201).json({
            success: true,
            message: 'Office location added successfully',
            data: newLocation // Return the full location object
        });

    } catch (error) {
        console.error('Add office location error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

router.put('/office-location/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId, updates } = req.body;

        console.log('Updating office location:', {
            locationId: id,
            companyId,
            userId: req.user._id,
            updates
        });

        if (!companyId || !updates) {
            return res.status(400).json({
                success: false,
                message: 'Company ID and updates are required'
            });
        }

        // Verify admin has access to this company
        const user = await User.findById(req.user._id);

        // Check if user is admin or has access to company
        const isAdmin = user.isAdmin || user.role === 'Admin' || user.role === 'ADMINISTRATOR' || user.role === 'Supervisor';

        // Check company access - handle both singular and plural
        let hasCompanyAccess = false;

        if (isAdmin) {
            hasCompanyAccess = true; // Admins have access to all companies
        } else if (user.company) {
            // If user has company field (could be array or single value)
            if (Array.isArray(user.company)) {
                hasCompanyAccess = user.company.some(comp =>
                    comp && comp.toString() === companyId.toString()
                );
            } else {
                hasCompanyAccess = user.company.toString() === companyId.toString();
            }
        } else if (user.companies && Array.isArray(user.companies)) {
            hasCompanyAccess = user.companies.some(comp =>
                comp && comp.toString() === companyId.toString()
            );
        }

        if (!hasCompanyAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this company'
            });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Initialize attendanceSettings if not exists
        if (!company.attendanceSettings) {
            company.attendanceSettings = {
                geoFencingEnabled: false,
                officeLocations: [],
                workingHours: {
                    startTime: '09:00',
                    endTime: '17:00',
                    gracePeriod: 15
                }
            };
        }

        // Ensure officeLocations array exists
        if (!company.attendanceSettings.officeLocations) {
            company.attendanceSettings.officeLocations = [];
        }

        // Find and update the location
        const locationIndex = company.attendanceSettings.officeLocations.findIndex(
            loc => loc._id.toString() === id
        );

        console.log('Location search result:', {
            locationIndex,
            totalLocations: company.attendanceSettings.officeLocations.length,
            searchingForId: id,
            availableIds: company.attendanceSettings.officeLocations.map(loc => loc._id.toString())
        });

        if (locationIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Office location not found'
            });
        }

        // Update location fields
        const location = company.attendanceSettings.officeLocations[locationIndex];

        console.log('Updating location:', {
            oldLocation: location,
            updates: updates
        });

        Object.keys(updates).forEach(key => {
            if (key === 'coordinates') {
                if (updates.coordinates && updates.coordinates.lat && updates.coordinates.lng) {
                    location.coordinates = {
                        lat: parseFloat(updates.coordinates.lat),
                        lng: parseFloat(updates.coordinates.lng)
                    };
                }
            } else if (key === 'radius') {
                location.radius = parseInt(updates.radius) || 100;
            } else if (key === 'isActive') {
                location.isActive = Boolean(updates.isActive);
            } else if (key !== '_id') {
                location[key] = updates[key];
            }
        });

        // Update the updatedAt timestamp
        location.updatedAt = new Date();

        await company.save();

        console.log('Location updated successfully:', location);

        res.status(200).json({
            success: true,
            message: 'Office location updated successfully',
            data: location
        });

    } catch (error) {
        console.error('Update office location error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// Delete Office Location
// router.delete('/office-location/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { companyId } = req.query;

//         if (!companyId) {
//             return res.status(400).json({
//                 message: 'Company ID is required'
//             });
//         }

//         // Verify admin has access to this company
//         const user = await User.findById(req.user._id);
//         if (!user.companies.includes(companyId)) {
//             return res.status(403).json({
//                 message: 'Access denied to this company'
//             });
//         }

//         const company = await Company.findById(companyId);
//         if (!company || !company.attendanceSettings || !company.attendanceSettings.officeLocations) {
//             return res.status(404).json({
//                 message: 'Company or office locations not found'
//             });
//         }

//         // Remove the location
//         const initialLength = company.attendanceSettings.officeLocations.length;
//         company.attendanceSettings.officeLocations = company.attendanceSettings.officeLocations.filter(
//             loc => loc._id.toString() !== id
//         );

//         if (company.attendanceSettings.officeLocations.length === initialLength) {
//             return res.status(404).json({
//                 message: 'Office location not found'
//             });
//         }

//         // If no locations left, disable geo-fencing
//         if (company.attendanceSettings.officeLocations.length === 0) {
//             company.attendanceSettings.geoFencingEnabled = false;
//         }

//         await company.save();

//         res.status(200).json({
//             success: true,
//             message: 'Office location deleted successfully'
//         });

//     } catch (error) {
//         console.error('Delete office location error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });

router.delete('/office-location/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId } = req.query;

        console.log('Deleting office location:', {
            locationId: id,
            companyId,
            userId: req.user._id
        });

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        // Verify admin has access to this company
        const user = await User.findById(req.user._id);

        // Check if user is admin or has access to company
        const isAdmin = user.isAdmin || user.role === 'Admin' || user.role === 'ADMINISTRATOR' || user.role === 'Supervisor';

        // Check company access - handle both singular and plural
        let hasCompanyAccess = false;

        if (isAdmin) {
            hasCompanyAccess = true; // Admins have access to all companies
        } else if (user.company) {
            // If user has company field (could be array or single value)
            if (Array.isArray(user.company)) {
                hasCompanyAccess = user.company.some(comp =>
                    comp && comp.toString() === companyId.toString()
                );
            } else {
                hasCompanyAccess = user.company.toString() === companyId.toString();
            }
        } else if (user.companies && Array.isArray(user.companies)) {
            hasCompanyAccess = user.companies.some(comp =>
                comp && comp.toString() === companyId.toString()
            );
        }

        if (!hasCompanyAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this company'
            });
        }

        const company = await Company.findById(companyId);
        if (!company || !company.attendanceSettings || !company.attendanceSettings.officeLocations) {
            return res.status(404).json({
                success: false,
                message: 'Company or office locations not found'
            });
        }

        // Find the location index
        const locationIndex = company.attendanceSettings.officeLocations.findIndex(
            loc => loc._id.toString() === id
        );

        if (locationIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Office location not found'
            });
        }

        // Remove the location
        const removedLocation = company.attendanceSettings.officeLocations.splice(locationIndex, 1)[0];

        // If no locations left, disable geo-fencing
        if (company.attendanceSettings.officeLocations.length === 0) {
            company.attendanceSettings.geoFencingEnabled = false;
        }

        await company.save();

        console.log('Location deleted successfully:', removedLocation);

        res.status(200).json({
            success: true,
            message: 'Office location deleted successfully',
            data: {
                deletedLocationId: id,
                remainingLocations: company.attendanceSettings.officeLocations.length,
                geoFencingEnabled: company.attendanceSettings.geoFencingEnabled
            }
        });

    } catch (error) {
        console.error('Delete office location error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;