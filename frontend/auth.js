const API_BASE_URL = 'http://127.0.0.1:8000/api';
document.addEventListener('DOMContentLoaded', () => {
    // --- Get references to the forms and feedback areas ---
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // We'll create a single feedback element for messages for both forms
    const authContent = document.querySelector('.auth-content');
    let feedbackMessage = document.createElement('p');
    feedbackMessage.className = 'feedback-message'; // For basic styling
    if (authContent) {
        const introText = authContent.querySelector('.auth-intro-text');
        if (introText) {
            introText.after(feedbackMessage);
        } else {
            authContent.prepend(feedbackMessage);
        }
    }


    // --- Function to Display Feedback Messages ---
    function displayFeedback(message, type = 'error') {
        feedbackMessage.textContent = message;
        feedbackMessage.style.color = type === 'success' ? '#28a745' : '#dc3545';
        feedbackMessage.style.marginTop = '15px';
        feedbackMessage.style.marginBottom = '15px';
        feedbackMessage.style.fontWeight = 'bold';
        feedbackMessage.style.visibility = 'visible';
    }

    // --- Function to Handle SIGNUP Form Submission ---
if (signupForm) {
        signupForm.addEventListener('submit', async (e) => { 
            console.log('1. Signup form submission event fired!');
            e.preventDefault(); //should befirst executable line.
            console.log('2. Default form submission prevented.'); 

            // Clear previous feedback
            feedbackMessage.textContent = '';

            // 1. Collect form data
            const username = signupForm.username.value;
            const email = signupForm.email.value;
            const pwd = signupForm.pwd.value;
            const pwd2 = signupForm.pwd2.value;

            // 2. Client-side validation
            if (pwd !== pwd2) {
                displayFeedback('Passwords do not match.', 'error');
                console.log('3. Client-side validation failed: Passwords mismatch.');
                return; // Stop execution
            }
            console.log('4. Client-side validation passed.');

            // 3. Prepare data for the backend
            const userData = {
                username: username,
                email: email,
                pwd: pwd,
                pwd2: pwd2,
            };
            console.log('5. Sending signup data to backend:', userData); // DEBUG LOG

            // 4. Send data to Django backend's registration API
            try {
                const response = await fetch(`${API_BASE_URL}/register/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(userData),
                });

                // 5. Handle the backend response
                if (response.ok) { // HTTP status 200-299
                    const data = await response.json();
                    console.log('6. Registration successful (Backend response):', data); // DEBUG LOG
                    localStorage.setItem('username', username);
                    displayFeedback('Registration successful! Redirecting to login...', 'success'); // UPDATED MSG
                    signupForm.reset(); // Clear the form

                    // NEW: Direct redirect without setTimeout to eliminate potential race condition or setTimeout issue
                    window.location.href = 'login.html'; // Redirect immediately

                } else {
                    const errorData = await response.json();
                    console.error('6. Registration failed (Backend error):', errorData); // DEBUG LOG

                    if (errorData.username) {
                        displayFeedback(`Username: ${errorData.username[0]}`, 'error');
                    } else if (errorData.email) {
                        displayFeedback(`Email: ${errorData.email[0]}`, 'error');
                    } else if (errorData.pwd) {
                        displayFeedback(`Password: ${errorData.pwd[0]}`, 'error');
                    } else if (errorData.detail) {
                         displayFeedback(errorData.detail, 'error');
                    } else {
                        displayFeedback('Registration failed. Please try again.', 'error');
                    }
                }
            } catch (error) {
                console.error('6. Network error during registration (Fetch catch block):', error); // DEBUG LOG
                displayFeedback('Network error. Please check your connection or server status.', 'error'); // UPDATED MSG
            }
        });
    }


    // --- Function to Handle LOGIN Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form refresh

            // Clear previous feedback
            feedbackMessage.textContent = '';

            // 1. Collect form data
            const username = loginForm.username.value; // Now expecting 'username'
            const password = loginForm.password.value;

            // 2. Prepare data for the backend
            const loginData = {
                username: username,
                password: password,
            };

            // 3. Send data to Django backend's token generation API
            try {
                // console.log('Sending login data:', loginData); // For debugging
                const response = await fetch(`${API_BASE_URL}/token/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(loginData),
                });

                // 4. Handle the backend response
                if (response.ok) { // HTTP status 200-299
                    const data = await response.json();
                    console.log('Login successful:', data);

                    // Store JWT tokens securely
                    // For a college project, localStorage is acceptable for simplicity.
                    // In production, for refresh tokens, HttpOnly cookies are generally preferred for better XSS protection.
                    localStorage.setItem('username', username);
                    localStorage.setItem('accessToken', data.access);
                    localStorage.setItem('refreshToken', data.refresh);

                    displayFeedback('Login successful! Redirecting...', 'success');
                    loginForm.reset(); // Clear the form

                    // 5. Redirect to the main tasks page
                    setTimeout(() => {
                        window.location.href = 'tasks.html'; // Assuming your main task page is tasks.html
                    }, 1000);

                } else {
                    // Backend returned an error (e.g., 401 Unauthorized for bad credentials)
                    const errorData = await response.json();
                    console.error('Login failed:', errorData);

                    if (errorData.detail) {
                        displayFeedback(errorData.detail, 'error'); // Display specific error message
                    } else if (errorData.username || errorData.password) { // If specific field errors
                        displayFeedback('Invalid username or password.', 'error');
                    } else {
                        displayFeedback('Login failed. Please check your credentials.', 'error');
                    }
                }
            } catch (error) {
                // Network error or other unexpected issues
                console.error('Network error during login:', error);
                displayFeedback('Network error. Please check your connection.', 'error');
            }
        });
    }
});