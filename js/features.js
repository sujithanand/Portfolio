// Function to fetch JSON data and render content
async function fetchAndRenderFeatures() {
    try {
        // Fetching the JSON data from the file
        const response = await fetch('js/json/features.json'); // Ensure the path is correct
        const featuresData = await response.json();

        // Get the container where content will be rendered
        const container = document.getElementById('features-container');

        // Loop through each feature in the data and create HTML elements
        featuresData.forEach(feature => {
            // Create the column div
            const colDiv = document.createElement('div');
            colDiv.className = 'col-lg-4 col-12';

            // Create the feature div
            const featureDiv = document.createElement('div');
            featureDiv.className = 'single-features';

            // Create the icon div
            const iconDiv = document.createElement('div');
            iconDiv.className = 'signle-icon';
            const icon = document.createElement('i');
            icon.className = `icofont ${feature.icon}`;
            iconDiv.appendChild(icon);

            // Create the title element
            const title = document.createElement('h3');
            title.textContent = feature.title;

            // Create the description paragraph
            const description = document.createElement('p');
            description.textContent = feature.description;

            // Append icon, title, and description to the feature div
            featureDiv.appendChild(iconDiv);
            featureDiv.appendChild(title);
            featureDiv.appendChild(description);

            // Append the feature div to the column div
            colDiv.appendChild(featureDiv);

            // Append the column div to the container
            container.appendChild(colDiv);
        });
    } catch (error) {
        console.error('Error fetching or rendering data:', error);
    }
}

// Call the function to fetch and render features
fetchAndRenderFeatures();
