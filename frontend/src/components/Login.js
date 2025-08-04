import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginModal.css'; // You'll need to create this CSS file

const LoginForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalType, setModalType] = useState(''); // 'success' or 'error'
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                // Show error modal
                setModalMessage(data.message);
                setModalType('error');
                setShowModal(true);
                
                // Hide modal after 3 seconds
                setTimeout(() => setShowModal(false), 3000);
                
                // Handle email verification redirect if needed
                if (data.requiresEmailVerification) {
                    navigate('/verify-email', { state: { email: data.email } });
                }
                return;
            }

            // Show success modal
            setModalMessage('Login successful! Redirecting...');
            setModalType('success');
            setShowModal(true);
            
            // Hide modal after 3 seconds and redirect
            setTimeout(() => {
                setShowModal(false);
                navigate('/dashboard');
            }, 3000);

        } catch (error) {
            setModalMessage('An error occurred. Please try again.');
            setModalType('error');
            setShowModal(true);
            setTimeout(() => setShowModal(false), 3000);
            console.error('Login error:', error);
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleLogin}>
                {/* Your form inputs here */}
                <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Email" 
                    required 
                />
                <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Password" 
                    required 
                />
                <button type="submit">Login</button>
            </form>

            {/* Modal for displaying messages */}
            {showModal && (
                <div className={`modal ${modalType}`}>
                    <div className="modal-content">
                        <p>{modalMessage}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginForm;