document.addEventListener('DOMContentLoaded', function() {
    fetch('js/json/experience.json')
        .then(response => response.json())
        .then(data => {
            const container = document.querySelector('.blog-comments .comments-body');
            if (!container) {
                console.error('Container not found');
                return;
            }

            data.forEach(item => {
                if (item.type === 'company') {
                    // Create company div
                    const companyDiv = document.createElement('div');
                    companyDiv.className = 'single-comments experienceHeading';

                    const mainDiv = document.createElement('div');
                    mainDiv.className = 'main';

                    const headDiv = document.createElement('div');
                    headDiv.className = 'head';

                    const img = document.createElement('img');
                    img.src = item.logo;
                    img.alt = '#';
                    headDiv.appendChild(img);

                    const bodyDiv = document.createElement('div');
                    bodyDiv.className = 'body';

                    const companyName = document.createElement('h4');
                    companyName.textContent = item.companyName;
                    bodyDiv.appendChild(companyName);

                    const metaDiv = document.createElement('div');
                    metaDiv.className = 'comment-meta';
                    const metaSpan = document.createElement('span');
                    metaSpan.className = 'meta';
                    metaSpan.innerHTML = `<i class="fa fa-calendar"></i>${item.duration}`;
                    metaDiv.appendChild(metaSpan);
                    bodyDiv.appendChild(metaDiv);

                    const descriptionP = document.createElement('p');
                    descriptionP.textContent = item.description;
                    bodyDiv.appendChild(descriptionP);

                    mainDiv.appendChild(headDiv);
                    mainDiv.appendChild(bodyDiv);
                    companyDiv.appendChild(mainDiv);
                    container.appendChild(companyDiv);
                } else if (item.type === 'position') {
                    // Create position div
                    const positionDiv = document.createElement('div');
                    positionDiv.className = 'single-comments left';

                    const mainDiv = document.createElement('div');
                    mainDiv.className = 'main';

                    const bodyDiv = document.createElement('div');
                    bodyDiv.className = 'body';

                    const title = document.createElement('h4');
                    title.textContent = item.title;
                    bodyDiv.appendChild(title);

                    const metaDiv = document.createElement('div');
                    metaDiv.className = 'comment-meta';
                    const metaSpan = document.createElement('span');
                    metaSpan.className = 'meta';
                    metaSpan.innerHTML = `<i class="fa fa-calendar"></i>${item.dateRange}`;
                    metaDiv.appendChild(metaSpan);
                    bodyDiv.appendChild(metaDiv);

                    item.responsibilities.forEach(responsibility => {
                        const p = document.createElement('p');
                        p.textContent = responsibility;
                        bodyDiv.appendChild(p);
                    });

                    mainDiv.appendChild(bodyDiv);
                    positionDiv.appendChild(mainDiv);
                    container.appendChild(positionDiv);
                }
            });
        })
        .catch(error => console.error('Error fetching or rendering data:', error));
});
