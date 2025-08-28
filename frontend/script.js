document.addEventListener('DOMContentLoaded', () => {
    console.log('Frontend script loaded!');

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent default jump to anchor

            const targetId = this.getAttribute('href'); // Get the ID from the href attribute (e.g., "#features-section")
            const targetElement = document.querySelector(targetId); // Find the element with that ID

            if (targetElement) {
                // Use scrollIntoView with 'smooth' behavior for a nice animation
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});