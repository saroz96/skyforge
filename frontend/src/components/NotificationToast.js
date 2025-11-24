// import React, { useEffect } from 'react';
// import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
// import '../stylesheet/retailer/NotificationToast.css';

// const NotificationToast = ({ message, type, show, onClose }) => {
//     useEffect(() => {
//         if (show) {
//             const timer = setTimeout(() => {
//                 onClose();
//             }, 3000);
            
//             return () => clearTimeout(timer);
//         }
//     }, [show, onClose]);

//     if (!show) return null;

//     return (
//         <div className={`notification-toast notification-${type}`}>
//             <div className="notification-icon">
//                 {type === 'success' ? <FiCheckCircle /> : <FiAlertTriangle />}
//             </div>
//             <div className="notification-content">
//                 {message}
//             </div>
//             <div className="notification-progress"></div>
//         </div>
//     );
// };

// export default NotificationToast;

// import React, { useEffect } from 'react';
// import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
// import '../stylesheet/retailer/NotificationToast.css';

// const NotificationToast = ({ message, type, show, onClose }) => {
//     useEffect(() => {
//         if (show) {
//             const timer = setTimeout(() => {
//                 onClose();
//             }, 3000);
            
//             return () => clearTimeout(timer);
//         }
//     }, [show, onClose]);

//     if (!show) return null;

//     return (
//         <div className={`notification-toast notification-${type}`}>
//             <div className="notification-icon">
//                 {type === 'success' ? <FiCheckCircle /> : <FiAlertTriangle />}
//             </div>
//             <div className="notification-content">
//                 {message}
//             </div>
//             <button 
//                 className="notification-close" 
//                 onClick={onClose}
//                 aria-label="Close notification"
//             >
//                 ×
//             </button>
//             <div className="notification-progress"></div>
//         </div>
//     );
// };

// export default NotificationToast;

import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiX } from 'react-icons/fi';
import '../stylesheet/retailer/NotificationToast.css';

const NotificationToast = ({ message, type, show, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isHiding, setIsHiding] = useState(false);

    useEffect(() => {
        if (show) {
            setIsVisible(true);
            setIsHiding(false);
            
            const timer = setTimeout(() => {
                startHideAnimation();
            }, 3000);
            
            return () => clearTimeout(timer);
        }
    }, [show]);

    const startHideAnimation = () => {
        setIsHiding(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 300); // Match the CSS animation duration
    };

    const handleClose = () => {
        startHideAnimation();
    };

    if (!isVisible) return null;

    return (
        <div className={`notification-toast notification-${type} ${isHiding ? 'hiding' : ''}`}>
            <div className="notification-icon">
                {type === 'success' ? <FiCheckCircle /> : <FiAlertTriangle />}
            </div>
            <div className="notification-content">
                {message}
            </div>
            <button 
                className="notification-close" 
                onClick={handleClose}
                aria-label="Close notification"
            >
                <FiX />
            </button>
            {!isHiding && <div className="notification-progress"></div>}
        </div>
    );
};

export default NotificationToast;