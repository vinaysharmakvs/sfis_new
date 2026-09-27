import fs from 'node:fs';
import path from 'node:path';
const root = import.meta.dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, 'dist', file), value);
const site = JSON.parse(read('content/site.json'));
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const imageFile = name => { const optimized = `${path.parse(name).name}-web.jpg`; return fs.existsSync(path.join(root, 'dist/assets', optimized)) ? optimized : name; };
const card = article => `<a class="founder-card" href="${escape(article.file)}"><img class="founder-photo" src="assets/${escape(imageFile(article.image))}" alt="${escape(article.author)}" loading="lazy" width="400" height="450"><p class="author">BY ${escape(article.author.toUpperCase())}</p><h3>${escape(article.title)}</h3><span class="read-link">READ THE FOUNDER INSIGHT <span aria-hidden="true">↗</span></span></a>`;
const vars = {
  LOCATION:escape(site.location), HERO_TITLE:site.heroTitle, HERO_DESCRIPTION:site.heroDescription,
  CAMPUS_IMAGE:escape(imageFile(site.campusImage)),CAMPUS_VIDEO:escape(site.campusVideo),PHONE_DIGITS:escape(site.phoneDigits),PHONE:escape(site.phone),ADMISSIONS_NOTE:escape(site.admissionsNote),YEAR:new Date().getFullYear(),
  ACTIVITIES:site.activities.map(a=>`<figure class="activity"><img src="assets/${escape(imageFile(a.image))}" alt="${escape(a.title)} — illustrative campus vision" width="800" height="800" loading="lazy" decoding="async"><figcaption>${escape(a.title)}</figcaption></figure>`).join('\n'),
  FOUNDER_CARDS:site.articles.map(card).join('\n'),
  FAQS:site.faqs.map(f=>`<details><summary>${escape(f.question)}</summary><p>${escape(f.answer)}</p></details>`).join('\n')
};
function render(text) { return text.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(!(key in vars))throw new Error(`Unknown field ${key}`);return vars[key]}); }
vars.FOOTER=render(read('src/footer.html'));
vars.HOME_CONTENT=render(read('src/home.html'));
const homepage=render(read('src/index.html'));
write('index.html',homepage);
let header=homepage.match(/<header[\s\S]*?<\/header>/)[0].replaceAll('href="#','href="index.html#');
function page(title,description,body){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} | Stone Field</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#0c392f"><link rel="icon" href="assets/favicon.svg"><link rel="stylesheet" href="styles.css"></head><body><a class="skip" href="#main">Skip to content</a>${header}<main id="main">${body}</main>${vars.FOOTER}<script src="app.js" defer></script></body></html>`;}
const earlyGrades=[['Playway','Playway'],['Nursery','Nursery'],['LKG','L.K.G'],['UKG','U.K.G']];
const primaryGrades=Array.from({length:5},(_,i)=>[`Grade ${i+1}`,`Grade ${i+1}`]);
const gradeOptions=items=>items.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
vars.GRADE_OPTIONS=gradeOptions([...earlyGrades,...primaryGrades]);
vars.UPCOMING_GRADE_OPTIONS=`<optgroup label="Kidsverse Campus">${gradeOptions(earlyGrades)}</optgroup><optgroup label="Stone Field Campus">${gradeOptions(primaryGrades)}</optgroup>`;
write('register.html',page('Register your interest','Begin your child’s Stone Field journey. Register interest for the upcoming session.',render(read('src/register.html'))).replace('</head>','<link rel="stylesheet" href="journey.css"></head>').replace('</body>','<script src="journey.js" defer></script></body>'));
write('blog.html',page('Founder insights','Ideas from Neha Sharma and Vinay Sharma on education, AI and parent-school partnership.',`<section class="article-hero"><a class="back-link" href="index.html">← Back to Stone Field</a><p class="eyebrow">FOUNDER BLOG</p><h1>Ideas for a brighter future.</h1><p class="byline">Practical perspectives on learning, parenting and the world our children will grow into.</p></section><div class="founder-cards blog-list">${vars.FOUNDER_CARDS}</div>`));
for(const article of site.articles){write(article.file,page(article.title,`Founder insights by ${article.author}.`,`<section class="article-hero"><a class="back-link" href="blog.html">← All founder insights</a><p class="eyebrow">FOUNDER BLOG</p><h1>${escape(article.title)}</h1><p class="byline">By ${escape(article.author)}</p></section><article class="article-body">${article.body}<div class="article-end"><a href="index.html#enquire">Talk to the Stone Field team →</a></div></article>`));}
const faq = JSON.parse(read('content/faq.json'));
const faqNav = faq.groups.map(group=>`<a href="#${escape(group.id)}">${escape(group.title)} <span aria-hidden="true">↗</span></a>`).join('');
const faqGroups = faq.groups.map((group,index)=>`<section class="faq-group" id="${escape(group.id)}" aria-labelledby="title-${escape(group.id)}"><div class="faq-group-heading"><span>${String(index+1).padStart(2,'0')}</span><h2 id="title-${escape(group.id)}">${escape(group.title)}</h2></div><div class="faq-list">${group.items.map(item=>`<details><summary>${escape(item.question)}</summary><p>${escape(item.answer)}</p></details>`).join('')}</div></section>`).join('');
write('faq.html',page('Parent FAQ','Clear answers about Stone Field admissions, Kidsverse priority, screening assessments, learning and parent communication.',`<section class="article-hero faq-hero"><a class="back-link" href="index.html">← Back to Stone Field</a><p class="eyebrow">PARENT FAQ</p><h1>A little clarity.<br>A confident next step.</h1><p class="byline">Your questions about joining Stone Field, answered in one place.</p><div class="faq-timeline"><span>LOOKING AHEAD</span><p>${escape(site.admissionsNote)}</p></div></section><div class="section faq-layout"><aside class="faq-sidebar"><p class="eyebrow">FIND YOUR ANSWER</p><nav aria-label="FAQ topics">${faqNav}</nav><div class="faq-help"><h2>Let’s talk it through.</h2><p>Have a question about your child? Our enquiry team is here to help.</p><a class="text-link" href="index.html#enquire">Talk to our team <span aria-hidden="true">→</span></a></div></aside><div>${faqGroups}</div></div><section class="faq-bottom"><h2>Ready for the next conversation?</h2><p>Meet the team at our enquiry office in Kidsverse School, Rehan.</p><a class="button" href="index.html#enquire">Make an enquiry <span aria-hidden="true">↗</span></a></section>`));
for(const file of ['styles.css','app.js'])write(file,read(`src/${file}`));
console.log(`Built SFIS homepage, Parent FAQ and ${site.articles.length+1} blog pages.`);
for(const file of ['founders.html','founders.css','founders.js'])write(file,read('src/'+file));

for(const file of ['journey.css','journey.js'])write(file,read('src/'+file));
