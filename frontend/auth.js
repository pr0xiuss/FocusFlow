const API_BASE_URL = 'http://127.0.0.1:8000/api';
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    const authContent = document.querySelector('.auth-content');
    let feedbackMessage = document.createElement('p');
    feedbackMessage.className = 'feedback-message';
    if (authContent) {
        const introText = authContent.querySelector('.auth-intro-text');
        if (introText) {
            introText.after(feedbackMessage);
        } else {
            authContent.prepend(feedbackMessage);
        }
    }

    //Feedback
    function displayFeedback(message, type = 'error') {
        feedbackMessage.textContent = message;
        feedbackMessage.style.color = type === 'success' ? '#28a745' : '#dc3545';
        feedbackMessage.style.marginTop = '15px';
        feedbackMessage.style.marginBottom = '15px';
        feedbackMessage.style.fontWeight = 'bold';
        feedbackMessage.style.visibility = 'visible';
    }

    //SIGNUP
if (signupForm) {
        signupForm.addEventListener('submit', async (e) => { 
            console.log('Signup form submission event fired!');
            e.preventDefault(); 
            console.log(' Default form submission prevented.'); 

            feedbackMessage.textContent = '';

            // Collect form data
            const username = signupForm.username.value;
            const email = signupForm.email.value;
            const pwd = signupForm.pwd.value;
            const pwd2 = signupForm.pwd2.value;

            // Client-side validation
            if (pwd !== pwd2) {
                displayFeedback('Passwords do not match.', 'error');
                console.log('Client-side validation failed: Passwords mismatch.');
                return;
            }
            console.log('Client-side validation passed.');

            // data for the backend
            const userData = {
                username: username,
                email: email,
                pwd: pwd,
                pwd2: pwd2,
            };
            console.log('Sending signup data to backend:', userData);

            // Send data to DjangoAPI
            try {
                const response = await fetch(`${API_BASE_URL}/register/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(userData),
                });

                // Handle backend response
                if (response.ok) {
                    const data = await response.json();
                    console.log('Registration successful (Backend response):', data);
                    localStorage.setItem('username', username);
                    displayFeedback('Registration successful! Redirecting to login...', 'success'); 
                    signupForm.reset(); 

                    window.location.href = 'login.html';

                } else {
                    const errorData = await response.json();
                    console.error('Registration failed (Backend error):', errorData); 

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
                console.error('6. Network error during registration (Fetch catch block):', error);
                displayFeedback('Network error. Please check your connection or server status.', 'error');
            }
        });
    }


    //LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            feedbackMessage.textContent = '';

            //Collect data
            const username = loginForm.username.value;
            const password = loginForm.password.value;

            // data for backend
            const loginData = {
                username: username,
                password: password,
            };

            //Send data to Django API
            try {
                const response = await fetch(`${API_BASE_URL}/token/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(loginData),
                });

                //Handle response
                if (response.ok) {
                    const data = await response.json();
                    console.log('Login successful:', data);

                    // Store JWT
                    localStorage.setItem('username', username);
                    localStorage.setItem('accessToken', data.access);
                    localStorage.setItem('refreshToken', data.refresh);

                    displayFeedback('Login successful! Redirecting...', 'success');
                    loginForm.reset();

                    // Redirect totasks page
                    setTimeout(() => {
                        window.location.href = 'tasks.html';
                    }, 1000);

                } else {
                    const errorData=await response.json();
                    console.error('Login failed:',errorData);

                    if (errorData.detail){
                        displayFeedback(errorData.detail,'error');
                    } else if(errorData.username || errorData.password) {
                        displayFeedback('Invalid username or password.', 'error');
                    } else{
                        displayFeedback('Login failed. Please check your credentials.','error');
                    }
                }
            }catch (error){
                console.error('Network error during login:', error);
                displayFeedback('Network error. Please check your connection.', 'error');
            }
        });
    }
});