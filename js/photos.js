document.addEventListener('DOMContentLoaded', function() {
    const galleryContainer = document.getElementById('gallery-container');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');

    // Fetch JSON data from photos.json
    fetch('js/json/photos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(images => {
            renderGallery(images);
        })
        .catch(error => {
            console.error('Error fetching or rendering data:', error);
        });

    // Function to render gallery items
    function renderGallery(images) {
        if (!galleryContainer) {
            console.error('Gallery container element not found');
            return;
        }

        images.forEach(image => {
            const colDiv = document.createElement('div');
            colDiv.classList.add('col-6', 'col-md-4', 'col-lg-3', 'mb-4');

            const galleryItemDiv = document.createElement('div');
            galleryItemDiv.classList.add('gallery-item');

            const img = document.createElement('img');
            img.src = image.src;
            img.classList.add('img-fluid');
            img.alt = image.alt;
            img.setAttribute('data-toggle', 'modal');
            img.setAttribute('data-target', '#imageModal');

            // Add click event listener to update modal image src and title
            img.addEventListener('click', function() {
                modalImage.src = image.src;
                modalImage.alt = image.alt; // Update alt text if needed
                modalTitle.textContent = image.title; // Update title or description
            });

            galleryItemDiv.appendChild(img);
            colDiv.appendChild(galleryItemDiv);
            galleryContainer.appendChild(colDiv);
        });
    }
});
