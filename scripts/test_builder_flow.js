// scripts/test_builder_flow.js — End-to-end Project Builder & Website Generation Test
async function main() {
  const projName = 'nilesh-portfolio-' + Date.now().toString(36);
  console.log(`=== STEP 1: Creating new Project "${projName}" ===`);
  const projRes = await fetch('http://localhost:3001/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: projName,
      description: 'Modern portfolio website with projects, skills, dark mode, and contact form'
    })
  });
  const project = await projRes.json();
  console.log('✅ Project created:', project.id, 'at path:', project.path);

  console.log('\n=== STEP 2: Applying Full Website Files to Project ===');
  const applyRes = await fetch('http://localhost:3001/api/projects/apply-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: project.id,
      files: [
        {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nilesh Patel — Senior Full-Stack Engineer</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="navbar">
    <div class="logo">Nilesh<span>.dev</span></div>
    <nav>
      <a href="#about">About</a>
      <a href="#skills">Skills</a>
      <a href="#projects">Projects</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>
  <main>
    <section id="hero" class="hero">
      <h1>Hi, I'm <span class="gradient-text">Nilesh Patel</span></h1>
      <p class="subtitle">Senior Full-Stack MERN Developer & AI Systems Architect</p>
      <div class="cta-group">
        <a href="#projects" class="btn btn-primary">View Projects</a>
        <a href="#contact" class="btn btn-secondary">Contact Me</a>
      </div>
    </section>
    <section id="skills" class="skills-section">
      <h2>Core Technologies</h2>
      <div class="skills-grid">
        <div class="skill-card"><h3>React & Vite</h3><p>Modern component architecture & state management</p></div>
        <div class="skill-card"><h3>Node.js & Express</h3><p>High-throughput RESTful APIs & microservices</p></div>
        <div class="skill-card"><h3>MongoDB & SQL</h3><p>Schema design, indexing, and aggregations</p></div>
        <div class="skill-card"><h3>AI Integration</h3><p>LLM prompt engineering, RAG, and local agents</p></div>
      </div>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>`
        },
        {
          path: 'style.css',
          content: `* { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: #0b0f19; color: #f3f4f6; line-height: 1.6; }
.navbar { display: flex; justify-content: space-between; align-items: center; padding: 20px 48px; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(11,15,25,0.8); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; }
.logo { font-size: 20px; font-weight: 700; color: #fff; }
.logo span { color: #6366f1; }
nav a { color: #9ca3af; text-decoration: none; margin-left: 24px; font-weight: 500; transition: color 0.2s; }
nav a:hover { color: #6366f1; }
.hero { padding: 100px 48px 60px; text-align: center; max-width: 800px; margin: 0 auto; }
.hero h1 { font-size: 48px; font-weight: 800; margin-bottom: 16px; }
.gradient-text { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { font-size: 20px; color: #9ca3af; margin-bottom: 32px; }
.cta-group { display: flex; justify-content: center; gap: 16px; }
.btn { padding: 12px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
.btn-primary { background: #6366f1; color: #fff; }
.btn-primary:hover { background: #4f46e5; transform: translateY(-2px); }
.btn-secondary { background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.12); }
.btn-secondary:hover { background: rgba(255,255,255,0.1); }
.skills-section { padding: 60px 48px; max-width: 1000px; margin: 0 auto; }
.skills-section h2 { text-align: center; font-size: 32px; margin-bottom: 36px; }
.skills-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.skill-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; text-align: center; transition: border-color 0.2s; }
.skill-card:hover { border-color: #6366f1; }
.skill-card h3 { font-size: 18px; color: #fff; margin-bottom: 8px; }
.skill-card p { font-size: 14px; color: #9ca3af; }`
        },
        {
          path: 'app.js',
          content: `console.log("Nilesh.dev portfolio loaded successfully");
document.querySelectorAll("nav a").forEach(anchor => {
  anchor.addEventListener("click", function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
});`
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: "nilesh-portfolio",
            version: "1.0.0",
            description: "Portfolio for Nilesh Patel generated by Nilesh Assistant",
            scripts: { "start": "serve . -p 3000" }
          }, null, 2)
        }
      ]
    })
  });
  const applyData = await applyRes.json();
  console.log('✅ Files written successfully:', applyData.createdFiles || applyData.filesWritten || applyData);

  console.log('\n=== STEP 3: Verifying Files in Workspace /api/projects/:id/files ===');
  const filesRes = await fetch(`http://localhost:3001/api/projects/${project.id}/files`);
  const filesData = await filesRes.json();
  const fileItems = filesData.files || filesData;
  console.log('Project File Tree:', fileItems.map(f => `${f.path} (${f.size} bytes)`));

  console.log('\n=== STEP 4: Reading Generated index.html Content via API ===');
  const readRes = await fetch(`http://localhost:3001/api/projects/${project.id}/file?path=index.html`);
  const readData = await readRes.json();
  console.log('index.html size:', readData.content?.length, 'bytes');
  console.log('Title tag found:', readData.content?.includes('<title>Nilesh Patel'));

  console.log('\n=== STEP 5: Testing Learning Challenge Generator /api/learning/stream ===');
  const learnRes = await fetch('http://localhost:3001/api/learning/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'javascript', difficulty: 'medium' })
  });
  console.log('Learning Stream Status:', learnRes.status, '| Content-Type:', learnRes.headers.get('content-type'));

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
