const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-header nav');
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  navigation.classList.toggle('open', !expanded);
});
navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.intro-grid,.discipline-row,.profile-band,.experience-item,.education-strip,.work-heading,.skills-grid,.honors,.contact-email').forEach((element) => {
  element.classList.add('reveal');
  revealObserver.observe(element);
});

const projectCards = [...document.querySelectorAll('#projectStack .work-card')];
const projectDots = [...document.querySelectorAll('#carouselDots .dot')];
let activeProject = 0;

const showProject = (index) => {
  activeProject = (index + projectCards.length) % projectCards.length;
  projectCards.forEach((card, cardIndex) => {
    const position = (cardIndex - activeProject + projectCards.length) % projectCards.length;
    card.dataset.pos = position;
    card.setAttribute('aria-hidden', String(position > 2));
    card.querySelectorAll('a, button').forEach((control) => {
      control.tabIndex = position > 2 ? -1 : 0;
    });
  });
  projectDots.forEach((dot, dotIndex) => {
    const active = dotIndex === activeProject;
    dot.classList.toggle('active', active);
    dot.setAttribute('aria-pressed', String(active));
  });
};

document.querySelectorAll('[data-next-project]').forEach((button) => {
  button.addEventListener('click', () => showProject(activeProject + 1));
});
projectDots.forEach((dot) => {
  dot.addEventListener('click', () => showProject(Number(dot.dataset.slide)));
});
if (projectCards.length) showProject(0);

const certificateDialog = document.querySelector('.certificate-dialog');
const certificateImage = certificateDialog.querySelector('.certificate-full');
const certificateCaption = certificateDialog.querySelector('.certificate-caption');
const closeCertificate = certificateDialog.querySelector('.certificate-close');
document.querySelectorAll('[data-cert-src]').forEach((card) => {
  card.addEventListener('click', () => {
    certificateImage.src = card.dataset.certSrc;
    certificateImage.alt = card.dataset.certTitle;
    certificateCaption.textContent = card.dataset.certTitle;
    certificateDialog.showModal();
  });
});
closeCertificate.addEventListener('click', () => certificateDialog.close());
certificateDialog.addEventListener('click', (event) => {
  if (event.target === certificateDialog) certificateDialog.close();
});
