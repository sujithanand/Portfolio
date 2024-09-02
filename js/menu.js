document.addEventListener('DOMContentLoaded', function() {
    const menuItems = [
        { name: 'Home', url: 'index.html' },
        { name: 'Experience', url: 'experience.html' },
        { name: 'Photography', url: 'photos.html' },
        { name: 'Pet Projects', url: 'projects.html' },
        { name: 'About Me', url: 'about.html' }
    ];

    const menuList = document.getElementById('menu-list');

    // Function to render menu items
    function renderMenu() {
        if (menuList === null) {
            console.error('Menu list element not found');
            return;
        }

        // Clear existing menu items
        menuList.innerHTML = '';

        menuItems.forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = item.url;
            a.textContent = item.name;
            a.id = `menu-${item.name.toLowerCase().replace(/\s+/g, '-')}`;
            li.appendChild(a);
            menuList.appendChild(li);
        });

        // Set active class based on current URL
        setActiveMenuItem();
    }

    // Function to handle menu item clicks
    function handleMenuClick(event) {
        const menuLinks = document.querySelectorAll('.nav.menu li');
        menuLinks.forEach(link => link.classList.remove('active'));
        if (event.target.tagName === 'A') {
            event.target.parentElement.classList.add('active');
        }
    }

    // Function to set the active menu item based on the current URL
    function setActiveMenuItem() {
        const currentUrl = window.location.pathname.split('/').pop(); // Get the current page file name
        const menuLinks = document.querySelectorAll('.nav.menu a');
        menuLinks.forEach(link => {
            if (link.getAttribute('href') === currentUrl) {
                link.parentElement.classList.add('active');
            }
        });
    }

    // Render the menu and add event listener
    renderMenu();
    menuList.addEventListener('click', handleMenuClick);
});
