'use strict';

/* ----------------------------------------------------------
   EMAILJS — initialise with your Public Key
   Sign up free at https://www.emailjs.com
---------------------------------------------------------- */
emailjs.init({ publicKey: '2FBWdbmr9IeOWo4Ds' });

/* ----------------------------------------------------------
   PARTICLE CANVAS BACKGROUND
---------------------------------------------------------- */
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [], animId;
  const COUNT  = 90;
  const COLORS = ['rgba(0,212,255,', 'rgba(124,58,237,', 'rgba(236,72,153,'];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function createParticle() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:      rand(0, W),
      y:      rand(0, H),
      r:      rand(1, 2.5),
      vx:     rand(-.25, .25),
      vy:     rand(-.25, .25),
      alpha:  rand(.15, .55),
      color,
    };
  }

  function init() {
    particles = Array.from({ length: COUNT }, createParticle);
  }

  function drawLine(a, b, dist) {
    const alpha = (1 - dist / 130) * .12;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `${a.color}${alpha})`;
    ctx.lineWidth = .6;
    ctx.stroke();
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);

    // Connect nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) drawLine(particles[i], particles[j], dist);
      }
    }

    // Draw & move particles
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${p.alpha})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      // Wrap edges
      if (p.x < -10)  p.x = W + 10;
      if (p.x > W+10) p.x = -10;
      if (p.y < -10)  p.y = H + 10;
      if (p.y > H+10) p.y = -10;
    });

    animId = requestAnimationFrame(loop);
  }

  resize();
  init();
  loop();
  window.addEventListener('resize', () => { resize(); });
})();


/* ----------------------------------------------------------
   NAVIGATION — scroll state & active link
---------------------------------------------------------- */
const navbar   = document.getElementById('navbar');
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

function onScroll() {
  // Sticky style
  if (window.scrollY > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  // Highlight active nav link
  let current = '';
  sections.forEach(sec => {
    const top = sec.offsetTop - 100;
    if (window.scrollY >= top) current = sec.getAttribute('id');
  });
  navLinks.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
  });

  // Back-to-top visibility
  backTop.classList.toggle('visible', window.scrollY > 400);
}

window.addEventListener('scroll', onScroll, { passive: true });


/* ----------------------------------------------------------
   HAMBURGER MOBILE NAV
---------------------------------------------------------- */
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('nav-mobile');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navMobile.classList.toggle('open');
});

function closeMobileNav() {
  hamburger.classList.remove('open');
  navMobile.classList.remove('open');
}


/* ----------------------------------------------------------
   SCROLL REVEAL (Intersection Observer)
---------------------------------------------------------- */
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, idx) => {
    if (entry.isIntersecting) {
      // Stagger children of the same parent
      const delay = entry.target.dataset.delay || 0;
      entry.target.style.transitionDelay = delay + 'ms';
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

// Add staggered delays to grid children
document.querySelectorAll('.projects-grid, .services-grid').forEach(grid => {
  grid.querySelectorAll('.reveal').forEach((el, i) => {
    el.dataset.delay = i * 80;
  });
});

revealEls.forEach(el => revealObserver.observe(el));


/* ----------------------------------------------------------
   SKILL BAR ANIMATION
---------------------------------------------------------- */
const skillObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.skill-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width + '%';
      });
      skillObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

const skillSection = document.querySelector('.skill-bar-list');
if (skillSection) skillObserver.observe(skillSection);


/* ----------------------------------------------------------
   PROJECT FILTER
---------------------------------------------------------- */
const filterBtns   = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    projectCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.style.transition = 'opacity .3s, transform .3s';
      if (match) {
        card.style.opacity = '1';
        card.style.transform = '';
        card.style.pointerEvents = '';
      } else {
        card.style.opacity = '0.15';
        card.style.transform = 'scale(0.95)';
        card.style.pointerEvents = 'none';
      }
    });
  });
});


/* ----------------------------------------------------------
   CONTACT FORM — client-side validation & feedback
---------------------------------------------------------- */
const contactForm = document.getElementById('contact-form');
const formStatus  = document.getElementById('form-status');

contactForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const name    = this.name.value.trim();
  const email   = this.email.value.trim();
  const message = this.message.value.trim();

  // Simple validation
  if (!name || !email || !message) {
    formStatus.textContent = 'Please fill in all required fields.';
    formStatus.className   = 'form-status error';
    return;
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    formStatus.textContent = 'Please enter a valid email address.';
    formStatus.className   = 'form-status error';
    return;
  }

  // Send via EmailJS
  const submitBtn = this.querySelector('button[type="submit"]');
  submitBtn.disabled  = true;
  submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sending…';
  formStatus.textContent = '';
  formStatus.className   = 'form-status';

  emailjs.sendForm(
    'service_mmt4o7j',
    'template_gk7m6yn',
    contactForm
  )
  .then(() => {
    submitBtn.disabled  = false;
    submitBtn.innerHTML = '<i class="fa fa-paper-plane"></i> Send Message';
    formStatus.textContent = '✓ Message sent! I\'ll get back to you shortly.';
    formStatus.className   = 'form-status success';
    contactForm.reset();
    setTimeout(() => { formStatus.style.display = 'none'; }, 5000);
  })
  .catch((err) => {
    submitBtn.disabled  = false;
    submitBtn.innerHTML = '<i class="fa fa-paper-plane"></i> Send Message';
    formStatus.textContent = '✗ Something went wrong. Please try again.';
    formStatus.className   = 'form-status error';
    console.error('EmailJS error:', err);
  });
});


/* ----------------------------------------------------------
   BACK TO TOP
---------------------------------------------------------- */
const backTop = document.getElementById('back-top');

backTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});


/* ----------------------------------------------------------
   SMOOTH CURSOR PARALLAX ON HERO
---------------------------------------------------------- */
document.addEventListener('mousemove', (e) => {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const rect   = hero.getBoundingClientRect();
  if (e.clientY > rect.bottom) return;

  const cx = (e.clientX / window.innerWidth  - 0.5) * 24;
  const cy = (e.clientY / window.innerHeight - 0.5) * 14;

  document.querySelectorAll('.hero-orb').forEach((orb, i) => {
    const factor = i === 0 ? 1 : -0.6;
    orb.style.transform = `translate(${cx * factor}px, ${cy * factor}px)`;
  });
});
