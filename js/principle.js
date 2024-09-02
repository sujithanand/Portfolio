document.addEventListener('DOMContentLoaded', function() {
    fetch('js/json/principle.json')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('services-container');
            container.innerHTML = data.map(service => `
                <div class="col-lg-4 col-md-6 col-12">
                    <!-- Start Single Principle -->
                    <div class="single-service">
                        <i class="icofont ${service.icon}"></i>
                        <h4>${service.title}</h4>
                        <p>${service.description}</p>
                    </div>
                    <!-- End Single Principle -->
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error fetching or rendering data:', error);
        });
});
