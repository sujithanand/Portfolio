// JavaScript code
window.addEventListener('scroll', function() {
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollProgress = (scrollTop / scrollHeight) * 100;
    const progressBar = document.querySelector('.scroll-progress');
    progressBar.style.width = scrollProgress + '%';
  });
  
  // JavaScript code
// JavaScript code
window.addEventListener("DOMContentLoaded", function () {
    const services = [
      {
        icon: "fas fa-brush",
        title: "Graphic Design",
        description: "I have 6+ years of experience in Graphic Design section. ",
      },
      {
        icon: "fas fa-box",
        title: "Product Design",
        description: "I have 4+ years of experience in Product Design . ",
      },
      {
        icon: "fas fa-users",
        title: "User Research",
        description: "I have 4+ years of experience in User Research.",
      },
      {
        icon: "fas fa-camera",
        title: "Photography",
        description: "I have 5+ years of experience in Photography. ",
      },
    ];
    const aboutSection = document.getElementById("about");
    aboutSection.style.display = "none";

    const servicesContainer = document.getElementById("servicesContainer");
  
    services.forEach((service) => {
      const serviceCard = document.createElement("div");
      serviceCard.classList.add("service-card");
      serviceCard.innerHTML = `
        <span class="${service.icon} icon"></span>
        <h3>${service.title}</h3>
        <p>${service.description}</p>
      `;
      servicesContainer.appendChild(serviceCard);
    });
  });
  
  // JavaScript code
window.addEventListener("scroll", function () {
    const navbar = document.querySelector(".navbar");
    if (window.scrollY > 0) {
      navbar.classList.add("scroll");
    } else {
      navbar.classList.remove("scroll");
    }
  });
  
  // JavaScript code Adding recent works
window.addEventListener("DOMContentLoaded", function () {
  const cardsData = [
    {
      thumbnail: "thumbnail1.jpg",
      header: "Card 1",
      subtitle: "Subtitle 1",
    },
    {
      thumbnail: "thumbnail2.jpg",
      header: "Card 2",
      subtitle: "Subtitle 2",
    },
    {
      thumbnail: "thumbnail3.jpg",
      header: "Card 3",
      subtitle: "Subtitle 3",
    },
    // Add more card data objects as needed
  ];

  const cardsContainer = document.getElementById("cardsContainer");

  cardsData.forEach((card) => {
    const cardElement = document.createElement("div");
    cardElement.classList.add("card");
    cardElement.innerHTML = `
      <img src="${card.thumbnail}" alt="${card.header}">
      <h3>${card.header}</h3>
      <p>${card.subtitle}</p>
    `;
    cardsContainer.appendChild(cardElement);
  });
});
